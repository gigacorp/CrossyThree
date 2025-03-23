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

// Camera position - moved closer and angled
// camera.position.set(10, 8, 10);
// camera.lookAt(0, 0, 0);

// Player setup - made much larger
const playerGeometry = new THREE.BoxGeometry(15, 20, 15);
const playerMaterial = new THREE.MeshLambertMaterial({ color: "white" });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 10, 0);
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

// Keyboard controls
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});
document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Handle movement
    if (keys['ArrowLeft']) moveX = -moveSpeed;
    else if (keys['ArrowRight']) moveX = moveSpeed;
    else moveX = 0;

    if (keys['ArrowUp']) moveZ = -moveSpeed;
    else if (keys['ArrowDown']) moveZ = moveSpeed;
    else moveZ = 0;

    // Update player position
    player.position.x += moveX;
    player.position.z += moveZ;

    renderer.render(scene, camera);
}

animate(); 