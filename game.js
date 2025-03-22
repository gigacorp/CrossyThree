// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
    window.innerWidth / -4,
    window.innerWidth / 4,
    window.innerHeight / 4,
    window.innerHeight / -4,
    1,
    1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera position - moved closer and angled
camera.position.set(10, 8, 10);
camera.lookAt(0, 0, 0);

// Player setup - made much larger
const playerGeometry = new THREE.BoxGeometry(8, 8, 8);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(player);

// Grid setup - made much larger and more visible
const gridSize = 1000; // Much larger overall size
const gridDivisions = 100; // More divisions for detail
const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x888888);
scene.add(gridHelper);

// Movement variables - adjusted to match new scale
const moveSpeed = 8;
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

// Handle window resize
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.left = width / -4;
    camera.right = width / 4;
    camera.top = height / 4;
    camera.bottom = height / -4;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
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