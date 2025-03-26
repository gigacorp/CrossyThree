import * as THREE from 'three';
import { Client } from 'colyseus.js';
import { createCamera, updateCameraFrustum, updateCameraPosition } from './camera.js';
import { createPlayer, processMoveQueue } from './player.js';
import { createGrass } from './grass.js';
import { 
    MAP_WIDTH, MAP_HEIGHT, MAP_HALF_WIDTH, MAP_HALF_HEIGHT,
    MOVE_DURATION, MOVE_DISTANCE, JUMP_HEIGHT,
    SWIPE_THRESHOLD, TAP_THRESHOLD
} from './constants.js';

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
scene.add(player);

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

// Movement queue
const moveQueue = [];
let isMoving = false;

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

// Multiplayer setup
const client = new Client(window.location.protocol === 'https:' 
    ? `wss://${window.location.host}`
    : `ws://${window.location.host}`);
let room = null;
let playerId = null;
const otherPlayers = new Map();
const otherPlayersMoveQueues = new Map();

// Connect to server
async function connectToServer() {
    try {
        room = await client.joinOrCreate('game_room');
        console.log('Connected to room:', room);
        
        // Update room ID display
        document.getElementById('roomId').textContent = `Room: ${room.roomId}`;
        
        // Listen for player ID
        room.onMessage('playerId', (id) => {
            playerId = id;
            console.log('Received player ID:', playerId);
        });

        // Listen for player move commands
        room.onMessage('playerMoveCommand', (data) => {
            if (data.playerId !== playerId) {
                queueOtherPlayerMove(data.playerId, data.movement, data.startPos, data.targetPos);
            }
        });

        // Listen for players leaving
        room.onMessage('playerLeft', (playerId) => {
            removeOtherPlayer(playerId);
        });

        // Listen for state changes
        room.onStateChange((state) => {
            updatePlayerCount(state.playerCount);
            
            // Only process other players if we have our playerId
            if (playerId) {
                // Create other players that are already in the room
                state.players.forEach((player, id) => {
                    if (id !== playerId) {
                        updateOtherPlayer(id, {
                            x: player.x,
                            y: player.y,
                            z: player.z,
                            rotation: player.rotation
                        });
                    }
                });
            }
        });

    } catch (error) {
        console.error('Failed to connect to server:', error);
    }
}

function updateOtherPlayer(playerId, position) {
    let otherPlayer = otherPlayers.get(playerId);
    if (!otherPlayer) {
        otherPlayer = createPlayer();
        scene.add(otherPlayer);
        otherPlayers.set(playerId, otherPlayer);
    }
    otherPlayer.position.set(position.x, position.y, position.z);
    otherPlayer.rotation.y = position.rotation;
}

function removeOtherPlayer(playerId) {
    const otherPlayer = otherPlayers.get(playerId);
    if (otherPlayer) {
        scene.remove(otherPlayer);
        otherPlayers.delete(playerId);
    }
}

function updatePlayerCount(count) {
    document.getElementById('playerCount').textContent = `Players: ${count}`;
}

function queueOtherPlayerMove(playerId, movement, startPos, targetPos) {
    let otherPlayer = otherPlayers.get(playerId);
    if (!otherPlayer) {
        otherPlayer = createPlayer();
        scene.add(otherPlayer);
        otherPlayers.set(playerId, otherPlayer);
    }

    // Initialize or get the move queue for this player
    if (!otherPlayersMoveQueues.has(playerId)) {
        otherPlayersMoveQueues.set(playerId, []);
    }
    const moveQueue = otherPlayersMoveQueues.get(playerId);

    // Add the move command to the queue
    moveQueue.push({
        movement,
        startPos,
        targetPos,
        startTime: null
    });
}

// Modify the queueMove function to send movement to server
function queueMove(movement) {
    // Use the target position of the current move as the start position for the next move
    const startPos = moveQueue.length > 0 ? moveQueue[moveQueue.length - 1].targetPos : {
        x: player.position.x,
        z: player.position.z
    };
    
    const targetPos = {
        x: startPos.x + movement.x * MOVE_DISTANCE,
        z: startPos.z + movement.z * MOVE_DISTANCE
    };

    moveQueue.push({
        movement: {
            x: movement.x * MOVE_DISTANCE,
            z: movement.z * MOVE_DISTANCE
        },
        startPos,
        targetPos,
        startTime: null
    });

    // Send movement to server
    if (room) {
        // Send the movement command to the server with positions
        room.send('move', {
            movement: {
                x: movement.x,
                z: movement.z
            },
            startPos,
            targetPos
        });
    }
}

// Connect to server when the page loads
connectToServer();

// Handle keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Prevent key repeat
    
    let movement = null;
    switch(e.key) {
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

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Process local player movement queue
    if (moveQueue.length > 0) {
        processMoveQueue(moveQueue, player, {
            moveDuration: MOVE_DURATION,
            jumpHeight: JUMP_HEIGHT
        });
    }

    // Process other players' movement queues
    otherPlayersMoveQueues.forEach((queue, playerId) => {
        if (queue.length > 0) {
            const otherPlayer = otherPlayers.get(playerId);
            if (otherPlayer) {
                processMoveQueue(queue, otherPlayer, {
                    moveDuration: MOVE_DURATION,
                    jumpHeight: JUMP_HEIGHT
                });
            }
        }
    });

    // Update camera position
    updateCameraPosition(camera, player.position);

    // Update directional light position to follow player
    directionalLight.position.x = player.position.x -200;
    directionalLight.position.z = player.position.z;
    directionalLight.target.position.set(player.position.x, 0, player.position.z);

    renderer.render(scene, camera);
}

animate(); 