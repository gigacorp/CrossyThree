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
import { GameState, Player as PlayerSchema, MoveMessage, PlayerMoveCommand, MinigameObjectState } from './schema.js';
import { MoveCommand, Workspace, PlayerRepresentation, Toolbox } from './client-types';
import { ToolboxImpl } from './studio/ToolboxImpl';

// Add these declarations at the top of the file, after imports
let animationFrameId: number = 0;
let room: Room<GameState> | null = null;

// Event handler declarations
function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    updateCameraFrustum(camera);
}

function onKeyDown(event: KeyboardEvent) {
    if (isMoving) return;
    if (event.repeat) return;
    
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
}

function onKeyUp(event: KeyboardEvent) {
    // No need for keyup handler currently
}

function onTouchStart(event: TouchEvent) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchStartTime = Date.now();
    event.preventDefault();
}

function onTouchMove(event: TouchEvent) {
    event.preventDefault();
}

function onTouchEnd(event: TouchEvent) {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const deltaTime = touchEndTime - touchStartTime;
    
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) {
                queueMove({ x: 1, z: 0 });
            } else {
                queueMove({ x: -1, z: 0 });
            }
        } else {
            if (deltaY > 0) {
                queueMove({ x: 0, z: 1 });
            } else {
                queueMove({ x: 0, z: -1 });
            }
        }
    } else if (deltaTime < TAP_THRESHOLD) {
        queueMove({ x: 0, z: -1 });
    }
    
    event.preventDefault();
}

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

// Create grass field
const grassField = createGrass();
scene.add(grassField);

let localPlayer: PlayerRepresentation | null = null; // Will be populated once ID is received

// Initialize toolbox with implementation
const toolbox: Toolbox = new ToolboxImpl(scene);

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

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

// Multiplayer setup
const client = new Client(window.location.protocol === 'https:' 
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`);

// Update otherPlayers Map to store PlayerRepresentation
const otherPlayers = new Map<string, PlayerRepresentation>(); 
const otherPlayersMoveQueues = new Map<string, MoveCommand[]>(); 
const clock = new THREE.Clock(); 

// Keep track of minigame object visuals
const minigameObjectMeshes: Map<string, THREE.Object3D> = new Map();

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

// Modify the queueMove function 
function queueMove(movement: { x: number; z: number }) {
    if (!room || !localPlayer) { // Check for localPlayer representation
        console.warn('Cannot queue move, room or localPlayer representation not available.');
        return;
    }
    
    // Use localPlayer.mesh position if queue is empty
    const startPos = moveQueue.length > 0 
        ? moveQueue[moveQueue.length - 1].targetPos 
        : { x: localPlayer.mesh.position.x, z: localPlayer.mesh.position.z }; 
    
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

    // Send movement intention to server
    const movePayload: MoveMessage = {
        movement,
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

// Update the animate function to remove logging
function animate() {
    animationFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // ... (Debug logs removed)

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

// Update the cleanup function to be more specific
function cleanupGame() {
    // Stop the animation loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Disconnect from the server
    if (room) {
        room.leave();
    }

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

    // Clear event listeners
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
}

// Add event listeners
window.addEventListener('resize', onWindowResize);
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('touchstart', onTouchStart);
window.addEventListener('touchmove', onTouchMove);
window.addEventListener('touchend', onTouchEnd);

// Start connection and animation loop
connectToServer();
animate();

// Add exit button handler
document.getElementById('exitButton')?.addEventListener('click', () => {
    cleanupGame();
    window.location.href = '/';
}); 

// Creates the visual representation for a minigame object
function createMinigameObjectVisual(id: string, objState: MinigameObjectState): THREE.Object3D | null {
    let objectVisual: THREE.Object3D | null = null;

    // TODO: Replace with your actual visual creation logic using Toolbox or similar
    const placeholderMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });

    if (objState.type === 'Tile') {
        // Example: Create visuals based on tileType
        let geometry: THREE.BufferGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE * 0.2, BLOCK_SIZE); // Default tile
        let material = placeholderMaterial;
        let yOffset = -BLOCK_SIZE * 0.4; // Position pivot at top center

        switch (objState.tileType) {
            case 'Coin':
                geometry = new THREE.CylinderGeometry(BLOCK_SIZE * 0.4, BLOCK_SIZE * 0.4, BLOCK_SIZE * 0.1, 16);
                material = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.5, roughness: 0.3 });
                yOffset = BLOCK_SIZE * 0.5; // Center coin vertically
                break;
            case 'Lava':
                material = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xcc3300, roughness: 0.9 });
                yOffset = -BLOCK_SIZE * 0.45; // Slightly lower
                break;
            case 'Grass':
                 material = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9 });
                 break;
            case 'Button':
                 geometry = new THREE.CylinderGeometry(BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.15, 24);
                 material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.5 });
                 yOffset = BLOCK_SIZE * 0.075; 
                 break;
             case 'Bridge':
                  geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE * 0.15, BLOCK_SIZE);
                  material = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
                  yOffset = -BLOCK_SIZE * (0.5 - 0.15/2);
                  break;
             // Add more cases for other tileTypes (Water, etc.)
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(objState.position.x, objState.position.y + yOffset, objState.position.z);
        // Optional: Add rotation or specific adjustments based on tileType
        if (objState.tileType === 'Coin') {
             mesh.rotation.x = Math.PI / 2;
        }
        objectVisual = mesh;

    } else if (objState.type === 'Text') {
        // TODO: Implement text rendering (e.g., using TextGeometry, Sprites, or HTML)
        // Placeholder visual
        const textMesh = new THREE.Mesh(
             new THREE.BoxGeometry(BLOCK_SIZE*2, BLOCK_SIZE*0.5, 0.1), 
             new THREE.MeshBasicMaterial({ color: objState.color || 0xffffff, wireframe: true })
        );
        textMesh.position.set(objState.position.x, objState.position.y, objState.position.z);
        console.log(`Text object added: "${objState.text}" at ${objState.position.x},${objState.position.y},${objState.position.z}`);
        objectVisual = textMesh;
    }
    // Add cases for other types (Platform, etc.)

    if (objectVisual) {
        objectVisual.name = `minigame_${id}`; // Set name for debugging
        objectVisual.visible = objState.visible; // Set initial visibility
        scene.add(objectVisual); // Add to the main scene
        minigameObjectMeshes.set(id, objectVisual);
        console.log(`Created visual for minigame object: ${id} (${objState.type} - ${objState.tileType || objState.text})`);
    }
    return objectVisual;
}

// Removes the visual representation of a minigame object
function removeMinigameObjectVisual(id: string) {
    if (minigameObjectMeshes.has(id)) {
        const objectVisual = minigameObjectMeshes.get(id)!;
        scene.remove(objectVisual);

        // Dispose of geometry and material to free up memory
        if (objectVisual instanceof THREE.Mesh) {
            objectVisual.geometry?.dispose();
            if (Array.isArray(objectVisual.material)) {
                objectVisual.material.forEach(mat => mat.dispose());
            } else {
                objectVisual.material?.dispose();
            }
        }
        // Handle disposal for other types if necessary (Groups, Sprites)

        minigameObjectMeshes.delete(id);
        console.log(`Removed visual for minigame object: ${id}`);
    }
}

// Performs a full synchronization - ensuring local visuals match server state
function syncMinigameObjects(state: GameState) {
    // Check if the minigame has changed
    if (state.currentMinigameId !== lastProcessedMinigameId) {
        console.log(`Minigame changed from ${lastProcessedMinigameId} to ${state.currentMinigameId}. Clearing visuals.`);
        // Remove all existing minigame visuals
        minigameObjectMeshes.forEach((mesh, id) => {
            removeMinigameObjectVisual(id);
        });
        minigameObjectMeshes.clear();
        lastProcessedMinigameId = state.currentMinigameId;
        if (lastProcessedMinigameId === null) {
             console.log("Minigame ended or cleared.");
             return; 
        }
    }

    // If no minigame is active, ensure no objects are present locally
    if (!state.currentMinigameId || !state.minigameObjects) {
         if (minigameObjectMeshes.size > 0) {
             console.log("No active minigame, clearing stray visuals...");
              minigameObjectMeshes.forEach((mesh, id) => removeMinigameObjectVisual(id));
              minigameObjectMeshes.clear();
         }
        return; 
    }

    // --- Sync existing and add new objects ---
    const currentServerIds = new Set(state.minigameObjects.keys());

    state.minigameObjects.forEach((objState, id) => {
        let mesh = minigameObjectMeshes.get(id);

        if (!mesh) {
            // Create visual if it doesn't exist locally
            const newMesh = createMinigameObjectVisual(id, objState);
            // We don't need to assign to mesh var here as create adds to map
            // mesh = newMesh; // This line caused the type error
        } else {
            // Visual exists, update its properties (e.g., visibility)
            if (mesh.visible !== objState.visible) {
                mesh.visible = objState.visible;
            }
            // TODO: Sync other potentially changing properties
        }
    });

    // --- Remove objects that are no longer in the server state ---
    minigameObjectMeshes.forEach((mesh, id) => {
        if (!currentServerIds.has(id)) {
            console.log(`Sync: Removing stale object ${id}`);
            removeMinigameObjectVisual(id);
        }
    });
} 