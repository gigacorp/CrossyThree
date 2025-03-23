function createCamera() {
    const size = 300;
    const viewRatio = window.innerWidth / window.innerHeight;
    const width = viewRatio < 1 ? size : size * viewRatio;
    const height = viewRatio < 1 ? size / viewRatio : size;

    const camera = new THREE.OrthographicCamera(
        width / -2, // left
        width / 2, // right
        height / 2, // top
        height / -2, // bottom
        100, // near
        900 // far
    );

    // camera.up.set(0, 0, 1);
    camera.position.set(300, 300, 300);
    camera.lookAt(0, 0, 0);

    window.addEventListener('resize', () => {
        const viewRatio = window.innerWidth / window.innerHeight;
        const width = viewRatio < 1 ? size : size * viewRatio;
        const height = viewRatio < 1 ? size / viewRatio : size;

        camera.left = width / -2, // left
        camera.right = width / 2, // right
        camera.top = height / 2, // top
        camera.bottom = height / -2, // bottom

        camera.updateProjectionMatrix();
    });

    return camera;
}

function createPlayer() {
    // Create main player body (white box)
    const playerGeometry = new THREE.BoxGeometry(15, 20, 15);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: "white" });
    const playerBody = new THREE.Mesh(playerGeometry, playerMaterial);
    playerBody.position.set(0, 10, 0);

    // Create small red box on top
    const hatGeometry = new THREE.BoxGeometry(4, 4, 8);
    const hatMaterial = new THREE.MeshLambertMaterial({ color: "red" });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.set(0, 20, 0); // Position on top of player

    // Create yellow beak in front
    const beakGeometry = new THREE.BoxGeometry(2, 2, 2);
    const beakMaterial = new THREE.MeshLambertMaterial({ color: "orange" });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 12, 7.5); // Position on front of player

    // Create group to hold all meshes
    const player = new THREE.Group();
    player.add(playerBody);
    player.add(hat);
    player.add(beak);

    return player;
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
document.body.appendChild(renderer.domElement);

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
const ambientLight = new THREE.AmbientLight();
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight();
directionalLight.position.set(300, 300, 300);
directionalLight.target = player;
scene.add(directionalLight);

// Movement variables - adjusted to match new scale
const moveSpeed = 15;
let moveX = 0;
let moveZ = 0;

// Keyboard controls and movement queue
const moveQueue = [];
const MOVE_DURATION = 100; // 0.1 second
const MOVE_DISTANCE = 30; // 15 units per move
const JUMP_HEIGHT = 10; // Maximum jump height
let isMoving = false;

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
        moveQueue.push({
            movement,
            startPos: null,
            targetPos: null,
            startTime: null
        });
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Process movement queue
    if (moveQueue.length > 0) {
        const currentMove = moveQueue[0];
        
        if (!isMoving) {
            currentMove.startTime = Date.now();
            currentMove.startPos = {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z
            };
            currentMove.targetPos = {
                x: currentMove.startPos.x + currentMove.movement.x,
                z: currentMove.startPos.z + currentMove.movement.z
            };
            isMoving = true;

            // Calculate rotation angle based on movement direction
            const angle = Math.atan2(currentMove.movement.x, currentMove.movement.z);
            player.rotation.y = angle;
            
            console.log("Starting new move:", currentMove);
        }

        const elapsed = Date.now() - currentMove.startTime;
        const progress = Math.min(elapsed / MOVE_DURATION, 1);

        // Lerp between start and target positions
        player.position.x = currentMove.startPos.x + (currentMove.targetPos.x - currentMove.startPos.x) * progress;
        player.position.z = currentMove.startPos.z + (currentMove.targetPos.z - currentMove.startPos.z) * progress;

        // Add jumping motion using sine wave
        player.position.y = currentMove.startPos.y + Math.sin(progress * Math.PI) * JUMP_HEIGHT;

        if (progress === 1) {
            moveQueue.shift();
            isMoving = false;
            // Reset y position when movement is complete
            player.position.y = currentMove.startPos.y;
        }
    }

    renderer.render(scene, camera);
}

animate(); 