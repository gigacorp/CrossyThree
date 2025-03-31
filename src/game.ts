import * as THREE from 'three';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { Client, Room } from 'colyseus.js';
import { createCamera, updateCameraFrustum, updateCameraPosition, focusOnPosition } from './camera';
import { createPlayer, processMoveQueue } from './player';
import { createGrass } from './grass';
import { createGroundText } from './text';
import { 
    MAP_WIDTH, MAP_HEIGHT, MAP_HALF_WIDTH, MAP_HALF_HEIGHT,
    MOVE_DURATION, MOVE_DISTANCE, JUMP_HEIGHT,
    SWIPE_THRESHOLD, TAP_THRESHOLD, BLOCK_SIZE,
    ROTATION_LERP_FACTOR
} from './constants';
import { GameState as ColyseusGameState, Player as PlayerSchema, MoveMessage, PlayerMoveCommand } from './schema'; // Renamed Colyseus GameState
import { MoveCommand, GameState as ClientGameState } from './client-types'; // Import client-side GameState definition
import { MinigameManager } from './minigames/minigameManager'; // Import MinigameManager

// Scene setup
const scene = new THREE.Scene();
const camera = createCamera();
const renderer = new THREE.WebGLRenderer({
    // alpha: true,
    antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Add some instructions text (Will be overridden by minigame)
// const instructionsText = createGroundText('Use arrow keys to move', new THREE.Vector3(0, 0, MAP_HALF_HEIGHT+10), '#ffffff')
// if (instructionsText) {
//     scene.add(instructionsText);
// }

// Add finish line text (Will be overridden by minigame)
// const finishText = createGroundText('The end', new THREE.Vector3(0, 0, -MAP_HALF_HEIGHT-10), '#ffffff');
// if (finishText) {
//     scene.add(finishText);
// }

// Handle window resize
window.addEventListener('resize', () => {
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Update camera aspect ratio and frustum
    updateCameraFrustum(camera);
});

// Create grass field
const grassField = createGrass();
scene.add(grassField);

// Player setup
const player = createPlayer();
player.position.set(0, 0, MAP_HALF_HEIGHT-BLOCK_SIZE/2); // Start at the bottom of the map
focusOnPosition(camera, player.position); // Focus camera on player's initial position
scene.add(player);

// Minigame Setup
const minigameManager = new MinigameManager();

// Function to create the ClientGameState object
function getCurrentGameState(): ClientGameState {
    return {
        scene: scene,
        localPlayer: player,
        otherPlayers: Array.from(otherPlayers.values()) // Convert Map values to Array
    };
}

// Call minigame manager when local player spawns (initially)
minigameManager.onPlayerDidSpawn(player); 

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
lightTarget.position.copy(player.position);
scene.add(lightTarget);
directionalLight.target = lightTarget;

const ambientLight2 = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight2);

scene.add(directionalLight);

// Movement queue for the local player
const moveQueue: MoveCommand[] = [];
let isMoving = false;

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

// Multiplayer setup
const client = new Client(window.location.protocol === 'https:' 
    ? `wss://${window.location.hostname}`
    : `ws://${window.location.hostname}:3000`);

let room: Room<ColyseusGameState> | null = null; // Use the Renamed Colyseus GameState here
let playerId: string | null = null;
const otherPlayers = new Map<string, THREE.Group>(); // Map sessionId to player mesh
const otherPlayersMoveQueues = new Map<string, MoveCommand[]>(); // Type the move queue map
const clock = new THREE.Clock(); // Add clock for delta time

// Function to synchronize local player meshes with server state
function syncPlayerState(state: ColyseusGameState) { // Use Renamed Colyseus GameState
    if (!playerId || !room) { // Also check if room exists
        console.warn('syncPlayerState called before playerId or room was set. Skipping update.');
        return; 
    }
    updatePlayerCount(state.playerCount);

    const playersInServerState = new Set<string>();

    // Create or update players based on server state
    state.players.forEach((playerSchema: PlayerSchema, id: string) => { 
        playersInServerState.add(id); 

        if (id === playerId) { 
            return;
        }

        let otherPlayerMesh = otherPlayers.get(id);
        let isNewPlayer = false; // Flag to track if player is new
        if (!otherPlayerMesh) {
            isNewPlayer = true; // Mark as new
            console.log(`Sync: Creating mesh for player ${id}`);
            otherPlayerMesh = createPlayer();
            scene.add(otherPlayerMesh);
            otherPlayers.set(id, otherPlayerMesh);
            if (!otherPlayersMoveQueues.has(id)) {
                otherPlayersMoveQueues.set(id, []);
            }
        }
        // Update position and rotation from schema
        otherPlayerMesh.position.set(playerSchema.x, playerSchema.y, playerSchema.z);
        otherPlayerMesh.rotation.y = playerSchema.rotation;

        // If it's a new player, notify the minigame manager
        if (isNewPlayer) {
            minigameManager.onPlayerDidSpawn(otherPlayerMesh);
        }
    });

    // Remove local players that are NOT in the current server state
    otherPlayers.forEach((otherPlayerMesh, id) => {
        if (!playersInServerState.has(id)) { 
            console.log(`Sync: Removing mesh for player ${id} (not in server state)`);
            scene.remove(otherPlayerMesh);
            otherPlayers.delete(id);
            otherPlayersMoveQueues.delete(id);
        }
    });
}

// Connect to server
async function connectToServer() {
    try {
        // Explicitly type the room on join/create
        room = await client.joinOrCreate<ColyseusGameState>('game_room'); // Use Renamed Colyseus GameState
        console.log('Connected to room:', room.roomId, 'SessionId:', room.sessionId);
        
        // Update room ID display
        const roomIdElement = document.getElementById('roomId');
        if (roomIdElement) {
            roomIdElement.textContent = `Room: ${room.roomId}`;
        }
        
        // Listen for player ID and process initial state *after* receiving ID
        room.onMessage('playerId', (id: string) => { 
            playerId = id;
            console.log('Received player ID:', playerId);

            if (room) { 
                 console.log('Processing initial state after receiving playerId...');
                 syncPlayerState(room.state); // Initial sync
                 console.log('Finished processing initial state.');

                 // START THE MINIGAME HERE
                 console.log("Attempting to start default minigame...");
                 minigameManager.startMinigame('collectCoins', getCurrentGameState());
            } else {
                console.error('Room object became null unexpectedly after join.')
            }
        });

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
        room.onStateChange(syncPlayerState); 

    } catch (error) {
        console.error('Failed to connect to server:', error);
    }
}

function removeOtherPlayer(playerIdToRemove: string) { // Renamed parameter
    console.log(`Removing player ${playerIdToRemove} due to playerLeft message.`);
    const otherPlayer = otherPlayers.get(playerIdToRemove);
    if (otherPlayer) {
        scene.remove(otherPlayer);
        otherPlayers.delete(playerIdToRemove);
        otherPlayersMoveQueues.delete(playerIdToRemove); // Remove move queue too
    }
}

function updatePlayerCount(count: number) {
    const playerCountElement = document.getElementById('playerCount');
    if (playerCountElement) {
        playerCountElement.textContent = `Players: ${count}`;
    }
}

function queueOtherPlayerMove(playerId: string, movement: { x: number; z: number }, startPos: { x: number; z: number }, targetPos: { x: number; z: number }) {
    let otherPlayer = otherPlayers.get(playerId);
    if (!otherPlayer) {
        // Should ideally not happen if syncPlayerState runs first, but good failsafe
        console.warn(`queueOtherPlayerMove: Player ${playerId} mesh not found. Creating.`);
        otherPlayer = createPlayer(); 
        scene.add(otherPlayer);
        otherPlayers.set(playerId, otherPlayer);
        otherPlayersMoveQueues.set(playerId, []); // Ensure queue exists
    }

    const moveQueue = otherPlayersMoveQueues.get(playerId);
    if (moveQueue) { // Check if queue exists
        const command: MoveCommand = { // Use the interface
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

// Modify the queueMove function to send movement to server
function queueMove(movement: { x: number; z: number }) {
    if (!room || !playerId) {
        console.warn('Cannot queue move, room or playerId not available.');
        return;
    }
    
    // Determine start position based on the *local* player's move queue
    const startPos = moveQueue.length > 0 
        ? moveQueue[moveQueue.length - 1].targetPos 
        : { x: player.position.x, z: player.position.z }; // Use global `player` mesh position if queue is empty
    
    const targetPos = {
        x: startPos.x + movement.x * MOVE_DISTANCE,
        z: startPos.z + movement.z * MOVE_DISTANCE
    };

    // Add to the local player's visual queue
    const command: MoveCommand = { 
        movement: {
            x: movement.x * MOVE_DISTANCE,
            z: movement.z * MOVE_DISTANCE
        },
        startPos,
        targetPos,
        startTime: null
    };
    moveQueue.push(command); 

    // Send movement intention to server using the MoveMessage type
    const movePayload: MoveMessage = {
        movement, // Send the original direction vector
        startPos,
        targetPos
    };
    room.send('move', movePayload);
}

// Override processMoveQueue to notify minigame manager on move completion
const originalProcessMoveQueue = processMoveQueue; // Keep reference to original

// New wrapper function with corrected signature and logic
const processMoveQueueWithNotify = (
    queue: MoveCommand[], 
    object: THREE.Group, // Expecting a Group
    delta: number // Delta is passed to the wrapper, but not used in the call below
): boolean => { // Returns boolean: true if still moving, false otherwise
    const wasMoving = queue.length > 0;
    
    // Call the original function with 2 arguments based on the persistent linter error
    originalProcessMoveQueue(queue, object); 
    
    const stillMoving = queue.length > 0;
    const justFinishedMoving = wasMoving && !stillMoving;

    if (justFinishedMoving) {
        // Notify minigame manager that this object finished a move
        console.log(`Player ${object.uuid} finished moving.`); 
        minigameManager.onPlayerDidMove(object);
    }
    return stillMoving; // Return whether the queue still has moves
};

// Add event listeners (keyboard)
window.addEventListener('keydown', (event) => {
    if (minigameManager.isActive()) {
        // Potentially handle minigame-specific input here later
        // For now, allow normal movement during minigame
    }
    
    // Allow movement even if minigame is active for now
    // if (isMoving || minigameManager.isActive()) return; // Prevent queuing new move if already moving OR minigame active

    if (isMoving) return; // Original check: Prevent queuing new move if already moving

    if (event.repeat) return; // Prevent key repeat
    
    let movement: { x: number; z: number } | null = null;
    switch(event.key) {
        case 'ArrowLeft':
            movement = {x: -MOVE_DISTANCE, z: 0};
            break;
        case 'ArrowRight':
            movement = {x: MOVE_DISTANCE, z: 0};
            break;
        case 'ArrowUp':
            movement = {x: 0, z: -MOVE_DISTANCE};
            break;
        case 'ArrowDown':
            movement = {x: 0, z: MOVE_DISTANCE};
            break;
    }
    
    if (movement) {
        queueMove({
            x: movement.x / MOVE_DISTANCE,
            z: movement.z / MOVE_DISTANCE
        });
    }
});

// Handle touch start
document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    e.preventDefault(); // Prevent scrolling
});

// Handle touch move
document.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling
});

// Handle touch end
document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const deltaTime = touchEndTime - touchStartTime;
    
    // Check if it's a swipe
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
        // Determine swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 0) {
                queueMove({ x: 1, z: 0 }); // Right
            } else {
                queueMove({ x: -1, z: 0 }); // Left
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                queueMove({ x: 0, z: 1 }); // Down
            } else {
                queueMove({ x: 0, z: -1 }); // Up
            }
        }
    } else if (deltaTime < TAP_THRESHOLD) {
        // It's a tap, always move up
        queueMove({ x: 0, z: -1 }); // Up
    }
    
    e.preventDefault(); // Prevent scrolling
});

// Game loop
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Construct current GameState (needed for minigame update)
    const currentClientState = getCurrentGameState();

    // Update minigame manager IF active
    if (minigameManager.isActive()) {
        // Correct call: MinigameManager.update only needs delta
        minigameManager.update(delta); 
    } 
    
    // Process movement for local player using the wrapper (passing delta to wrapper)
    isMoving = processMoveQueueWithNotify(moveQueue, player as THREE.Group, delta);

    // Process movement for other players using the wrapper (passing delta to wrapper)
    otherPlayersMoveQueues.forEach((queue, id) => {
         const otherPlayerMesh = otherPlayers.get(id);
         if (otherPlayerMesh) {
             processMoveQueueWithNotify(queue, otherPlayerMesh as THREE.Group, delta); 
         }
    });

    // Update camera position to follow the local player
    updateCameraPosition(camera, player.position);

    // Update directional light target
    lightTarget.position.copy(player.position);
    directionalLight.target = lightTarget; // Ensure target is updated

    // TODO: Add collision check for onPlayersDidTouch and call minigameManager.onPlayersDidTouch(...)

    renderer.render(scene, camera);
}

// Start connection and animation loop
connectToServer();
animate(); 