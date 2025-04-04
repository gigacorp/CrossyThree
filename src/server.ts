import express from 'express';
import { createServer } from 'http';
import { Server, Room, Client } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAP_HALF_HEIGHT as IMPORTED_MAP_HALF_HEIGHT, BLOCK_SIZE as IMPORTED_BLOCK_SIZE } from './constants.js'; // Use aliases to avoid conflict
import { Player, GameState, MoveMessage, PlayerMoveCommand, MinigameObjectState, Vector3State, ActionState } from './schema.js';
import * as THREE from 'three'; // Keep if needed, remove if not
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname is available directly in CommonJS modules
// When running node dist/server.js, __dirname is /path/to/project/dist

// --- DEBUG: Log __dirname ---
// console.log('>>> Server process starting. __dirname:', __dirname);
// --- END DEBUG ---

// --- Constants ---
// Define constants locally for clarity and control within this file
const MAP_WIDTH = 40;
const MAP_HEIGHT = 40; // Depth (Z axis)
const MAP_HALF_WIDTH = MAP_WIDTH / 2;
const MAP_HALF_HEIGHT = MAP_HEIGHT / 2; // Use this local constant
const BLOCK_SIZE = IMPORTED_BLOCK_SIZE; // Use imported block size
const START_ZONE_POS = { x: 0, y: 0.5, z: MAP_HALF_HEIGHT - BLOCK_SIZE / 2 };
const FINISH_ZONE_MIN_Z = -MAP_HALF_HEIGHT; // Furthest Z extent of the finish zone
const FINISH_ZONE_MAX_Z = -MAP_HALF_HEIGHT + 10; // Closest Z edge of the finish zone (Adjust size as needed)
const INTERACTION_RADIUS_SQ = 1.5 * 1.5; // Squared radius for proximity checks (e.g., radius 1.5)
const PLAYER_DEFAULT_Y = 0.5; // Ensure this matches START_ZONE_POS.y

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
app.use(express.json()); // Keep json body parser if needed

// --- DEBUG: Log all requests ---
// app.use((req, res, next) => {
//   console.log(`>>> Incoming Request: ${req.method} ${req.originalUrl}`);
//   next(); // Pass control to the next middleware
// });
// --- END DEBUG ---

// --- Static Files Configuration --- 

// 1. Serve files from the 'dist' directory specifically for requests starting with '/dist'
// Put this FIRST to ensure it handles /dist/bundle.js
app.use('/dist', express.static(__dirname)); // __dirname is the actual 'dist' folder

// 2. Serve files from the root directory (e.g., index.html) AFTER checking /dist
// path.join goes up one level from dist to the project root
app.use(express.static(path.join(__dirname, '..')));

// --- End Static Files Configuration ---

// Colyseus Monitor
app.use('/colyseus', monitor());

interface MinigameDefinition {
    minigameId: string;
    displayName: string;
    description: string;
    objects: Array<{
        id: string;
        type: string;
        position: { x: number; y: number; z: number };
        visible: boolean;
        tileType?: string;
        text?: string;
        color?: string;
        action?: {
            type: string;
            score?: number;
            respawn?: string;
            targetId?: string;
            setVisible?: boolean;
            requiredCollectibles?: number;
        };
    }>;
}

class GameRoom extends Room<GameState> {
    onCreate(options: Record<string, unknown>) {
        console.log("GameRoom created!", options);
        this.setState(new GameState());

        // Load the default test minigame on creation
        try {
            this.loadMinigame("test_course_1");
        } catch (error) {
            console.error(`Failed to load initial minigame: ${error}`);
            // Handle error appropriately - maybe shut down room or load a default empty state
        }

        this.onMessage("move", (client, message: MoveMessage) => {
            const player = this.state.players.get(client.sessionId);
            if (player && message.movement) {
                console.log(
                    `${client.sessionId} at (${player.x.toFixed(2)}, ${player.z.toFixed(2)})`,
                    `moving by (${message.movement.x.toFixed(2)}, ${message.movement.z.toFixed(2)})`
                );

                player.x += message.movement.x * BLOCK_SIZE;
                player.z += message.movement.z * BLOCK_SIZE;

                if (message.movement.x !== 0 || message.movement.z !== 0) {
                    player.rotation = Math.atan2(message.movement.x, message.movement.z);
                }

                this.checkPlayerInteractions(player);
            } else {
                console.warn("Received move message but player or movement data missing:", client.sessionId, message);
            }
        });

        this.onMessage("updateRotation", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && typeof message.rotation === 'number') {
                player.rotation = message.rotation;
            }
        });
    }

    // Method to load and populate minigame state from JSON
    loadMinigame(minigameId: string) {
        console.log(`Loading minigame: ${minigameId}...`);
        const filePath = path.join(__dirname, `../minigames/${minigameId}.json`);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Minigame definition file not found: ${filePath}`);
        }

        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const definition: MinigameDefinition = JSON.parse(fileContent);

        // --- Validation (Basic Example) ---
        if (!definition || !definition.minigameId || !definition.objects) {
            throw new Error(`Invalid minigame definition format in ${filePath}`);
        }

        // --- Populate State ---
        this.state.minigameObjects.clear(); // Clear previous objects
        this.state.currentMinigameId = definition.minigameId;

        definition.objects.forEach(objData => {
            const objState = new MinigameObjectState();
            objState.type = objData.type;
            objState.visible = objData.visible ?? true; // Default to true if undefined

            // Populate position
            if (objData.position) {
                objState.position = new Vector3State();
                objState.position.x = objData.position.x ?? 0;
                objState.position.y = objData.position.y ?? 0;
                objState.position.z = objData.position.z ?? 0;
            }

            // Populate type-specific fields
            if (objData.type === "Tile") {
                objState.tileType = objData.tileType ?? "None";
                if (objData.action) {
                    objState.action = new ActionState();
                    objState.action.type = objData.action.type ?? "None";
                    // Assign optional action parameters carefully
                    if (objData.action.score !== undefined) objState.action.score = objData.action.score;
                    if (objData.action.respawn !== undefined) objState.action.respawn = objData.action.respawn;
                    if (objData.action.targetId !== undefined) objState.action.targetId = objData.action.targetId;
                    if (objData.action.setVisible !== undefined) objState.action.setVisible = objData.action.setVisible;
                    if (objData.action.requiredCollectibles !== undefined) objState.action.requiredCollectibles = objData.action.requiredCollectibles;
                }
            } else if (objData.type === "Text") {
                objState.text = objData.text ?? "";
                objState.color = objData.color ?? "#FFFFFF";
            }
            // Add handling for other types like "Platform" if needed

            // Add to the state map, using the ID from JSON as the key
            this.state.minigameObjects.set(objData.id, objState);
        });

        console.log(`Successfully loaded minigame: ${this.state.currentMinigameId}. ${this.state.minigameObjects.size} objects loaded.`);
    }

    // Placeholder for checking interactions (called after player moves)
    checkPlayerInteractions(player: Player) {
        let interactedThisCheck = false;

        this.state.minigameObjects.forEach((obj, id) => {
            if (interactedThisCheck) return;

            if (obj.type === "Tile" && obj.visible && obj.action && obj.action.type !== "None") {
                const dx = player.x - obj.position.x;
                const dy = player.y - obj.position.y;
                const dz = player.z - obj.position.z;
                const distSq = dx*dx + dy*dy + dz*dz;

                if (distSq < INTERACTION_RADIUS_SQ) {
                    if (obj.action.type === 'FinishTrigger') {
                        if (player.z <= FINISH_ZONE_MAX_Z && player.z >= FINISH_ZONE_MIN_Z) {
                            this.handleFinishAction(player, id, obj);
                            interactedThisCheck = true;
                        }
                    } else {
                        this.handleObjectInteraction(player, id, obj);
                        interactedThisCheck = true;
                    }
                }
            }
        });
    }

    // Handles interactions with objects based on their action type
    handleObjectInteraction(player: Player, objectId: string, obj: MinigameObjectState) {
        if (!obj.action) return;

        console.log(`Player ${player.name} interacting with ${obj.tileType} object ${objectId} (Action: ${obj.action.type})`);

        switch (obj.action.type) {
            case "Collect":
                obj.visible = false;
                if (obj.action.score !== undefined) {
                    player.score += obj.action.score;
                    console.log(`Player ${player.name} score: ${player.score}`);
                }
                // this.broadcast("playSound", { sound: "collect", position: obj.position, sourceId: objectId });
                break;

            case "DestroyTouchingPlayer":
                console.log(`Player ${player.name} touched hazard ${objectId}. Respawning...`);
                // TODO: Checkpoint logic using obj.action.respawn
                this.respawnPlayer(player);
                break;

            case "ToggleVisibility":
                if (obj.action.targetId) {
                    const targetObj = this.state.minigameObjects.get(obj.action.targetId);
                    if (targetObj) {
                        if (obj.action.setVisible !== undefined && obj.action.setVisible !== null) {
                            targetObj.visible = obj.action.setVisible;
                        } else {
                            targetObj.visible = !targetObj.visible;
                        }
                        console.log(`Toggled visibility of ${obj.action.targetId} to ${targetObj.visible}`);
                    } else {
                        console.warn(`ToggleVisibility action on ${objectId} failed: Target object ${obj.action.targetId} not found.`);
                    }
                } else {
                     console.warn(`ToggleVisibility action on ${objectId} has no targetId defined.`);
                }
                // Maybe make the button itself invisible briefly?
                // obj.visible = false;
                // this.clock.setTimeout(() => { if (this.state.minigameObjects.has(objectId)) this.state.minigameObjects.get(objectId).visible = true; }, 500);
                break;

            // --- Add cases for future actions like ApplyEffect, Teleport, Checkpoint ---\
            // case "ApplyEffect":
            //     // Apply effect logic to player
            //     break;
            // case "Teleport":
            //     // Move player to targetPosition
            //     break;
            // case "Checkpoint":
            //     // Store obj.id as player.currentCheckpointId
            //     break;

            default:
                console.log(`Unhandled action type: ${obj.action.type} on object ${objectId}`);
                break;
        }
    }

    // Handles triggering the finish condition
    handleFinishAction(player: Player, objectId: string, triggerObject: MinigameObjectState) {
        let canFinish = true;
        if (triggerObject.action?.requiredCollectibles !== undefined && triggerObject.action.requiredCollectibles > 0) {
            let collectedCount = 0;
            this.state.minigameObjects.forEach((objToCheck, idToCheck) => {
                if (objToCheck.action?.type === 'Collect' && !objToCheck.visible) {
                    collectedCount++;
                }
            });
            if (collectedCount < triggerObject.action.requiredCollectibles) {
                canFinish = false;
                console.log(`Player ${player.name} tried to finish via ${objectId}, but needs ${triggerObject.action.requiredCollectibles} items (has ${collectedCount}).`);
            }
        }

        if (canFinish) {
            console.log(`Player ${player.name} reached the finish via ${objectId}!`);
            // TODO: Proper game end logic
            this.respawnPlayer(player);
        }
    }

    // Helper to respawn player at start zone
    respawnPlayer(player: Player) {
        player.x = START_ZONE_POS.x;
        player.y = START_ZONE_POS.y;
        player.z = START_ZONE_POS.z;
        player.rotation = 0;
        // player.score = 0; // Reset score?
        console.log(`Respawned player ${player.name}`);
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
        const player = new Player();
        player.name = options.name || `Player_${client.sessionId.substring(0, 3)}`;
        this.respawnPlayer(player);

        this.state.players.set(client.sessionId, player);
        this.state.playerCount = this.state.players.size;
        console.log(`Player ${player.name} added. Total players: ${this.state.playerCount}`);
    }

    async onLeave(client: Client, consented: boolean) {
        const player = this.state.players.get(client.sessionId);
        let name = player ? player.name : client.sessionId;
        console.log(name, "left! (consented: ", consented, ")");

        if (this.state.players.has(client.sessionId)) {
            this.state.players.delete(client.sessionId);
            this.state.playerCount = this.state.players.size;
            console.log(`Player removed. Total players: ${this.state.playerCount}`);
        }
    }

    onDispose() {
        console.log("Disposing GameRoom...");
    }
}

const gameServer = new Server({
    server: createServer(app),
});

// Register your room handlers
gameServer.define('game_room', GameRoom);

gameServer.listen(port).then(() => {
    console.log(`Listening on http://localhost:${port}`);
}); 