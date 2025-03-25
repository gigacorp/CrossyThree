import * as THREE from './node_modules/three/build/three.module.min.js';

const CAMERA_OFFSET = new THREE.Vector3(150, 450, 350);
const CAMERA_LOOK_AT = new THREE.Vector3(0, 0, -75);

function updateCameraFrustum(camera) {
    const size = 300; // Smaller size for tighter view
    const viewRatio = window.innerWidth / window.innerHeight;
    const width = viewRatio < 1 ? size : size * viewRatio;
    const height = viewRatio < 1 ? size / viewRatio : size;

    camera.left = width / -2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = height / -2;
    camera.updateProjectionMatrix();
}

function createCamera() {
    const camera = new THREE.OrthographicCamera(
        0, // left (will be updated)
        0, // right (will be updated)
        0, // top (will be updated)
        0, // bottom (will be updated)
        100, // near
        900 // far
    );

    camera.position.copy(CAMERA_OFFSET);
    camera.lookAt(CAMERA_LOOK_AT);
    
    // Initialize camera frustum
    updateCameraFrustum(camera);

    return camera;
}

function createPlayer() {
    // Create main player body (white box)
    const playerGeometry = new THREE.BoxGeometry(15, 20, 15);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: "white" });
    const playerBody = new THREE.Mesh(playerGeometry, playerMaterial);
    playerBody.castShadow = true;
    playerBody.receiveShadow = true;
    playerBody.position.set(0, 10, 0);

    // Create small red box on top
    const hatGeometry = new THREE.BoxGeometry(4, 4, 8);
    const hatMaterial = new THREE.MeshLambertMaterial({ color: "red" });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.castShadow = true;
    hat.receiveShadow = true;
    hat.position.set(0, 20, 0); // Position on top of player

    // Create yellow beak in front
    const beakGeometry = new THREE.BoxGeometry(2, 2, 2);
    const beakMaterial = new THREE.MeshLambertMaterial({ color: "orange" });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.castShadow = true;
    beak.receiveShadow = true;
    beak.position.set(0, 12, 7.5); // Position on front of player

    // Create group to hold all meshes
    const player = new THREE.Group();
    player.add(playerBody);
    player.add(hat);
    player.add(beak);

    return player;
}

function createGrass() {
    const grassGeometry = new THREE.PlaneGeometry(2000, 2000);
    const grassMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x3a8c3a,  // Dark green color
        side: THREE.DoubleSide
    });
    const grassField = new THREE.Mesh(grassGeometry, grassMaterial);
    grassField.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    grassField.position.y = 0; // Place at ground level
    grassField.receiveShadow = true;
    return grassField;
}

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

// Grid setup - made much larger and more visible
const gridSize = 1500; // Much larger overall size
const gridDivisions = 100; // More divisions for detail
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x888888);
gridHelper.scale.set(2, 2, 2); // Scale down the grid to make each cell 15x15
scene.add(gridHelper);

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
const MOVE_DURATION = 100; // 0.1 second
const MOVE_DISTANCE = 30; // 15 units per move
const JUMP_HEIGHT = 10; // Maximum jump height
let isMoving = false;

// Camera setup
const CAMERA_LERP_FACTOR = 0.015; // Lower = smoother but more lag, higher = faster but less smooth
const ROTATION_LERP_FACTOR = 0.3; // Much faster than movement for snappy rotation

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
const TAP_THRESHOLD = 200; // Maximum time for tap (ms)

// Multiplayer setup
const client = new window.Colyseus.Client(window.location.protocol === 'https:' 
    ? 'wss://crossy-three-multiplayer.appspot.com'
    : 'ws://localhost:3000');
let room = null;
let playerId = null;
const otherPlayers = new Map();
const otherPlayersMoveQueues = new Map();

// Connect to server
async function connectToServer() {
    try {
        room = await client.joinOrCreate('game_room');
        console.log('Connected to room:', room);
        
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
        processMoveQueue(moveQueue, player);
    }

    // Process other players' movement queues
    otherPlayersMoveQueues.forEach((queue, playerId) => {
        if (queue.length > 0) {
            const otherPlayer = otherPlayers.get(playerId);
            if (otherPlayer) {
                processMoveQueue(queue, otherPlayer);
            }
        }
    });

    // Smooth camera following
    const targetX = player.position.x + CAMERA_OFFSET.x;
    const targetZ = player.position.z + CAMERA_OFFSET.z;

    camera.position.x += (targetX - camera.position.x) * CAMERA_LERP_FACTOR;
    camera.position.z += (targetZ - camera.position.z) * CAMERA_LERP_FACTOR;

    // Update directional light position to follow player
    directionalLight.position.x = player.position.x -200;
    directionalLight.position.z = player.position.z;
    directionalLight.target.position.set(player.position.x, 0, player.position.z);

    renderer.render(scene, camera);
}

// Extract move queue processing into a separate function
function processMoveQueue(queue, targetPlayer) {
    const currentMove = queue[0];
    
    if (!currentMove.startTime) {
        currentMove.startTime = Date.now();
        
        // Calculate target rotation angle based on movement direction
        const targetAngle = Math.atan2(currentMove.movement.x, currentMove.movement.z);
        currentMove.targetRotation = targetAngle;
    }

    const elapsed = Date.now() - currentMove.startTime;
    const progress = Math.min(elapsed / MOVE_DURATION, 1);

    // Lerp between start and target positions
    targetPlayer.position.x = currentMove.startPos.x + (currentMove.targetPos.x - currentMove.startPos.x) * progress;
    targetPlayer.position.z = currentMove.startPos.z + (currentMove.targetPos.z - currentMove.startPos.z) * progress;

    // Add jumping motion using sine wave
    targetPlayer.position.y = Math.sin(progress * Math.PI) * JUMP_HEIGHT;

    // Smooth rotation animation
    const currentRotation = targetPlayer.rotation.y;
    const targetRotation = currentMove.targetRotation;
    
    // Handle rotation wrapping around 2π
    let rotationDiff = targetRotation - currentRotation;
    if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
    if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
    
    targetPlayer.rotation.y += rotationDiff * ROTATION_LERP_FACTOR;

    if (progress === 1) {
        queue.shift();
        // Reset y position when movement is complete
        targetPlayer.position.y = 0;
        targetPlayer.rotation.y = currentMove.targetRotation;
    }
}

animate(); 