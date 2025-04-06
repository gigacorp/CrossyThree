import * as THREE from 'three';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { Client, Room } from 'colyseus.js';
import { createCamera, updateCameraFrustum, updateCameraPosition, focusOnPosition } from './camera';
import { createPlayer, processMoveQueue } from './player';
import { Ground } from './Ground';
import { 
    MAP_WIDTH, MAP_HEIGHT, MAP_HALF_WIDTH, MAP_HALF_HEIGHT,
    MOVE_DURATION, MOVE_DISTANCE, JUMP_HEIGHT,
    SWIPE_THRESHOLD, TAP_THRESHOLD, BLOCK_SIZE,
    ROTATION_LERP_FACTOR
} from './constants';
import { GameState, Player as PlayerSchema, MoveMessage, PlayerMoveCommand, MinigameObjectState, Vector3State } from './schema.js';
import { MoveCommand, PlayerRepresentation, GameObject } from './client-types';
import { Toolbox } from './toolbox/Toolbox';
import { initializeInput, cleanupInput, MoveIntention } from './input';

// Add these declarations at the top of the file, after imports
let animationFrameId: number = 0;
let room: Room<GameState> | null = null;

// Scene setup
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x87CEEB); // REMOVE: Sky Blue background for testing
const camera = createCamera();

// Find the canvas element
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;

// Check if canvas exists before creating renderer
if (!canvas) {
    console.error("CRITICAL: Could not find canvas element with ID 'gameCanvas'!");
}

const renderer = new THREE.WebGLRenderer({
    canvas: canvas || undefined, // Pass canvas element directly
    antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

let ground: Ground | null = null; // Will be populated once game is initialized
let localPlayer: PlayerRepresentation | null = null; // Will be populated once ID is received

// Initialize toolbox with implementation
const toolbox: Toolbox = new Toolbox();

// Call minigame manager when local player spawns - REMOVE
// minigameManager.onPlayerDidSpawn(player); 

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight();
directionalLight.position.set(-200, 200, 0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 50;
directionalLight.shadow.camera.far = 400;
directionalLight.shadow.camera.left = -400;
directionalLight.shadow.camera.right = 400;
directionalLight.shadow.camera.top = 400;
directionalLight.shadow.camera.bottom = -400;
directionalLight.target.updateMatrixWorld();

const lightTarget = new THREE.Object3D();
scene.add(lightTarget);
directionalLight.target = lightTarget;

const ambientLight2 = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight2);

scene.add(directionalLight);

// Movement queue for the local player
const moveQueue: MoveCommand[] = [];
let isMoving = false;

// Multiplayer setup
const client = new Client(window.location.protocol === 'https:' 
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`);

// Update otherPlayers Map to store PlayerRepresentation
const otherPlayers = new Map<string, PlayerRepresentation>(); 
const otherPlayersMoveQueues = new Map<string, MoveCommand[]>(); 
const clock = new THREE.Clock(); 

// Keep track of minigame objects
const minigameObjects: Map<string, GameObject> = new Map();

// Track the last processed minigame ID to detect changes
let lastProcessedMinigameId: string | null = null; 

// Function to synchronize local player meshes with server state
function syncPlayerState(state: GameState) { 
    if (!localPlayer || !room) { 
        console.warn('syncPlayerState called before playerId or room was set. Skipping update.');
        return; 
    }
    updatePlayerCount(state.playerCount);
    
    const playersInServerState = new Set<string>();

    console.log('Syncing player state:', state);
    if (!state.players) {
        console.warn('No players in server state. Skipping sync.');
        return;
    }

    if (state.rows && !ground) {
        ground = new Ground(state.rows);
        scene.add(ground.mesh);
    }

    // Create or update players based on server state
    state.players.forEach((playerSchema: PlayerSchema, id: string) => { 
        playersInServerState.add(id); 

        if (id === localPlayer?.id) {
            return;
        }

        // Handle other players
        let otherPlayerRep = otherPlayers.get(id);
        if (!otherPlayerRep) {
            console.log(`Sync: Creating representation for player ${id}`);
            const newMesh = createPlayer(); // Create a new mesh
            otherPlayerRep = { id: id, mesh: newMesh }; // Create representation
            scene.add(otherPlayerRep.mesh); // Add mesh to scene
            otherPlayers.set(id, otherPlayerRep); // Store representation
            if (!otherPlayersMoveQueues.has(id)) {
                otherPlayersMoveQueues.set(id, []);
            }
        }
        // Update position and rotation from schema using the mesh inside the representation
        otherPlayerRep.mesh.position.set(playerSchema.x, playerSchema.y, playerSchema.z);
        otherPlayerRep.mesh.rotation.y = playerSchema.rotation;
    });

    // Remove local representations for players NOT in the current server state
    otherPlayers.forEach((playerRep, id) => { // Iterate over representations
        if (!playersInServerState.has(id)) { 
            console.log(`Sync: Removing representation for player ${id} (not in server state)`);
            scene.remove(playerRep.mesh); // Remove the mesh
            otherPlayers.delete(id);
            otherPlayersMoveQueues.delete(id);
        }
    });
}

// Connect to server
async function connectToServer() {
    try {
        room = await client.joinOrCreate<GameState>('game_room'); 
        console.log('Connected to room:', room.roomId, 'SessionId:', room.sessionId);
        console.log('Local player ID:', room.sessionId);
        console.log('Local player:', localPlayer);
        
        // Update room ID display
        const roomIdElement = document.getElementById('roomId');
        if (roomIdElement) {
            roomIdElement.textContent = `Room: ${room.roomId}`;
        }
        
        // Initialize localPlayer Representation now that we have the ID
        if (!localPlayer) { // Check prevents re-initialization on reconnect/message duplication
            const localPlayerMesh = createPlayer(); // Create the mesh first
            scene.add(localPlayerMesh); // Add mesh to scene
            localPlayer = { id: room.sessionId, mesh: localPlayerMesh };
            console.log(`Initialized local PlayerRepresentation from playerId message: ${room.sessionId}`);
            focusOnPosition(camera, localPlayer.mesh.position); // Ensure camera focuses after ID received
        }

        syncPlayerState(room.state); // Initial sync
        console.log('Finished processing initial state.');

        // Listen for player move commands from broadcast
        room.onMessage('playerMoveCommand', (data: PlayerMoveCommand) => { // Use PlayerMoveCommand interface
            // Server already excludes sender, so no need to check playerId === data.playerId
            queueOtherPlayerMove(data.playerId, data.movement, data.startPos, data.targetPos);
        });

        // Listen for players leaving
        room.onMessage('playerLeft', (playerIdToRemove: string) => { // Type the ID
            removeOtherPlayer(playerIdToRemove);
        });

        // Listen for state changes (Handles subsequent updates)
        room.onStateChange((state) => {
            console.log("New state received:", state);
            // Ensure player sync is called
            syncPlayerState(state);
            // Call minigame object sync
            syncMinigameObjects(state);
        });
    } catch (error) {
        console.error('Failed to connect to server:', error);
    }
}

function removeOtherPlayer(playerIdToRemove: string) { 
    console.log(`Removing player ${playerIdToRemove} due to playerLeft message.`);
    const playerRep = otherPlayers.get(playerIdToRemove); // Get representation
    if (playerRep) {
        scene.remove(playerRep.mesh); // Remove mesh from representation
        otherPlayers.delete(playerIdToRemove);
        otherPlayersMoveQueues.delete(playerIdToRemove); 
    }
}

function updatePlayerCount(count: number) {
    const playerCountElement = document.getElementById('playerCount');
    if (playerCountElement) {
        playerCountElement.textContent = `Players: ${count}`;
    }
}

function queueOtherPlayerMove(playerId: string, movement: { x: number; z: number }, startPos: { x: number; z: number }, targetPos: { x: number; z: number }) {
    let playerRep = otherPlayers.get(playerId); // Get representation
    if (!playerRep) {
        console.warn(`queueOtherPlayerMove: Player representation ${playerId} not found. Creating.`);
        const newMesh = createPlayer(); 
        playerRep = { id: playerId, mesh: newMesh }; // Create representation
        scene.add(playerRep.mesh); // Add mesh
        otherPlayers.set(playerId, playerRep); // Store representation
        otherPlayersMoveQueues.set(playerId, []); 
    }

    const moveQueue = otherPlayersMoveQueues.get(playerId);
    if (moveQueue) { 
        const command: MoveCommand = { 
            movement,
            startPos,
            targetPos,
            startTime: null
        };
        moveQueue.push(command);
    } else {
        console.error(`Move queue not found for player ${playerId} in queueOtherPlayerMove`);
    }
}

// Modify the queueMove function to accept MoveIntention
function queueMove(intention: MoveIntention) { // Changed parameter type
    if (!room || !localPlayer) { 
        console.warn('Cannot queue move, room or localPlayer representation not available.');
        return;
    }
    
    // Prevent queuing new moves while already moving
    if (isMoving) {
         console.log("Already moving, ignoring new move intention.");
         return;
    }

    const startPos = moveQueue.length > 0 
        ? moveQueue[moveQueue.length - 1].targetPos 
        : { x: localPlayer.mesh.position.x, z: localPlayer.mesh.position.z }; 
    
    const targetPos = {
        x: startPos.x + intention.x * MOVE_DISTANCE,
        z: startPos.z + intention.z * MOVE_DISTANCE
    };

    const command: MoveCommand = { 
        movement: { // Calculate world-space movement for command
            x: intention.x * MOVE_DISTANCE,
            z: intention.z * MOVE_DISTANCE
        },
        startPos,
        targetPos,
        startTime: null
    };
    moveQueue.push(command); 

    const movePayload: MoveMessage = {
        movement: intention, // Send the raw intention {x,z} = {-1,0,1}
        startPos,
        targetPos
    };
    room.send('move', movePayload);
}

// Override processMoveQueue to notify minigame manager - REMOVE Notify
const originalProcessMoveQueue = processMoveQueue; 

// Wrapper function remains the same signature, takes Group
const processMoveQueueWithNotify = (
    queue: MoveCommand[], 
    object: THREE.Group, 
    delta: number 
): boolean => {
    const wasMoving = queue.length > 0;
    
    originalProcessMoveQueue(queue, object); // Calls original with 2 args
    
    const stillMoving = queue.length > 0;
    const justFinishedMoving = wasMoving && !stillMoving;

    return stillMoving; 
};

// Creates the visual representation for a minigame object
function createMinigameObjectVisual(id: string, objState: MinigameObjectState): GameObject | null {
    let gameObject: GameObject | null = null;

    // Try to create the object using the toolbox
    gameObject = toolbox.createObject(id, objState);

    if (!gameObject) {
        // Fallback placeholder creation if toolbox fails
        console.error(`Failed to create any visual for minigame object: ${id}`, objState);
        const placeholderGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE * 0.2, BLOCK_SIZE);
        const placeholderMat = new THREE.MeshBasicMaterial({color: 0xff00ff, wireframe: true});
        const placeholderMesh = new THREE.Mesh(placeholderGeo, placeholderMat);
        
        gameObject = {
            id,
            state: objState,
            mesh: placeholderMesh,
            update: () => {}
        };
    }

    // Common logic for any created object
    gameObject.mesh.position.set(objState.position.x, objState.position.y, objState.position.z);
    gameObject.mesh.name = `minigame_${id}`; // Set name for debugging
    gameObject.mesh.visible = objState.visible; // Set initial visibility
    scene.add(gameObject.mesh); // Add to the main scene
    minigameObjects.set(id, gameObject);
    console.log(`Created visual for minigame object: ${id} (${objState.type})`);
    
    return gameObject;
}

// Removes the visual representation of a minigame object
function removeMinigameObjectVisual(id: string) {
    if (minigameObjects.has(id)) {
        const gameObject = minigameObjects.get(id)!;
        scene.remove(gameObject.mesh);

        // Dispose of geometry and material to free up memory
        if (gameObject.mesh instanceof THREE.Mesh) {
            gameObject.mesh.geometry?.dispose();
            if (Array.isArray(gameObject.mesh.material)) {
                gameObject.mesh.material.forEach(mat => mat.dispose());
            } else {
                gameObject.mesh.material?.dispose();
            }
        }
        // Handle disposal for other types if necessary (Groups, Sprites)

        minigameObjects.delete(id);
        console.log(`Removed visual for minigame object: ${id}`);
    }
}

// Performs a full synchronization - ensuring local visuals match server state
function syncMinigameObjects(state: GameState) {
    // Check if the minigame has changed
    if (state.currentMinigameId !== lastProcessedMinigameId) {
        console.log(`Minigame changed from ${lastProcessedMinigameId} to ${state.currentMinigameId}. Clearing visuals.`);
        // Remove all existing minigame visuals
        minigameObjects.forEach((obj, id) => {
            removeMinigameObjectVisual(id);
        });
        minigameObjects.clear();
        lastProcessedMinigameId = state.currentMinigameId;
        if (lastProcessedMinigameId === null) {
             console.log("Minigame ended or cleared.");
             return; 
        }
    }

    // If no minigame is active, ensure no objects are present locally
    if (!state.currentMinigameId || !state.minigameObjects) {
         if (minigameObjects.size > 0) {
             console.log("No active minigame, clearing stray visuals...");
              minigameObjects.forEach((obj, id) => removeMinigameObjectVisual(id));
              minigameObjects.clear();
         }
        return; 
    }

    // --- Sync existing and add new objects ---
    const currentServerIds = new Set(state.minigameObjects.keys());

    state.minigameObjects.forEach((objState, id) => {
        let gameObject = minigameObjects.get(id);

        if (!gameObject) {
            // Create visual if it doesn't exist locally
            createMinigameObjectVisual(id, objState);
        } else {
            // Visual exists, update its properties (e.g., visibility)
            if (gameObject.mesh.visible !== objState.visible) {
                gameObject.mesh.visible = objState.visible;
            }
            // Update the state
            gameObject.state = objState;
        }
    });

    // --- Remove objects that are no longer in the server state ---
    minigameObjects.forEach((gameObject, id) => {
        if (!currentServerIds.has(id)) {
            console.log(`Sync: Removing stale object ${id}`);
            removeMinigameObjectVisual(id);
        }
    });
}

// Update the animation loop to include GameObject updates
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Process movement for local player if representation exists
    if (localPlayer) {
        isMoving = processMoveQueueWithNotify(moveQueue, localPlayer.mesh, delta);
    } else {
        isMoving = false;
    }

    // Process movement for other players
    otherPlayersMoveQueues.forEach((queue, id) => {
        const playerRep = otherPlayers.get(id);
        if (playerRep) {
            processMoveQueueWithNotify(queue, playerRep.mesh, delta);
        }
    });

    // Update all minigame objects
    minigameObjects.forEach(gameObject => {
        gameObject.update(delta);
    });

    // Update camera position
    if (localPlayer) {
        updateCameraPosition(camera, localPlayer.mesh.position);
    }

    // Update directional light position
    if (localPlayer) {
        directionalLight.position.x = localPlayer.mesh.position.x - 200;
        directionalLight.position.z = localPlayer.mesh.position.z;
        lightTarget.position.copy(localPlayer.mesh.position);
        lightTarget.updateMatrixWorld();
    }

    renderer.render(scene, camera);
}

// Modify the cleanup function
function cleanupGame() {
    // Stop the animation loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Disconnect from the server
    if (room) {
        room.leave();
    }

    cleanupInput(); // Call input cleanup

    // Clean up Three.js resources
    if (renderer) {
        renderer.dispose();
    }
    if (scene) {
        scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (object.material instanceof THREE.Material) {
                    object.material.dispose();
                } else if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                }
            }
        });
    }
}

// Initialize Input Handling
initializeInput(queueMove); // Pass queueMove as the callback

// Start connection and animation loop
connectToServer();
animate();

// Add exit button handler
document.getElementById('exitButton')?.addEventListener('click', () => {
    cleanupGame();
    window.location.href = '/';
}); 