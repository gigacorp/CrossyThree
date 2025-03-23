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
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

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

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(300, 300, 300);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 2000;
directionalLight.shadow.camera.left = -1000;
directionalLight.shadow.camera.right = 1000;
directionalLight.shadow.camera.top = 1000;
directionalLight.shadow.camera.bottom = -1000;

// Create a target for the directional light
const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0, 300);
scene.add(lightTarget);
directionalLight.target = lightTarget;
directionalLight.target.updateMatrixWorld();

scene.add(directionalLight);

// Keyboard controls and movement queue
const moveQueue = [];
const MOVE_DURATION = 100; // 0.1 second
const MOVE_DISTANCE = 30; // 15 units per move
const JUMP_HEIGHT = 10; // Maximum jump height
let isMoving = false;

// Camera setup
const CAMERA_LERP_FACTOR = 0.015; // Lower = smoother but more lag, higher = faster but less smooth
const ROTATION_LERP_FACTOR = 0.3; // Much faster than movement for snappy rotation

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

            // Calculate target rotation angle based on movement direction
            const targetAngle = Math.atan2(currentMove.movement.x, currentMove.movement.z);
            currentMove.targetRotation = targetAngle;
            
            console.log("Starting new move:", currentMove);
        }

        const elapsed = Date.now() - currentMove.startTime;
        const progress = Math.min(elapsed / MOVE_DURATION, 1);

        // Lerp between start and target positions
        player.position.x = currentMove.startPos.x + (currentMove.targetPos.x - currentMove.startPos.x) * progress;
        player.position.z = currentMove.startPos.z + (currentMove.targetPos.z - currentMove.startPos.z) * progress;

        // Add jumping motion using sine wave
        player.position.y = currentMove.startPos.y + Math.sin(progress * Math.PI) * JUMP_HEIGHT;

        // Smooth rotation animation
        const currentRotation = player.rotation.y;
        const targetRotation = currentMove.targetRotation;
        
        // Handle rotation wrapping around 2π
        let rotationDiff = targetRotation - currentRotation;
        if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
        if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
        
        player.rotation.y += rotationDiff * ROTATION_LERP_FACTOR;

        if (progress === 1) {
            moveQueue.shift();
            isMoving = false;
            // Reset y position when movement is complete
            player.position.y = currentMove.startPos.y;
            player.rotation.y = currentMove.targetRotation;
        }
    }

    // Smooth camera following
    const targetX = player.position.x + 300;
    const targetZ = player.position.z + 300;

    camera.position.x += (targetX - camera.position.x) * CAMERA_LERP_FACTOR;
    camera.position.z += (targetZ - camera.position.z) * CAMERA_LERP_FACTOR;

    renderer.render(scene, camera);
}

animate(); 