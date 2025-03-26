import * as THREE from './node_modules/three/build/three.module.min.js';

export const CAMERA_OFFSET = new THREE.Vector3(150, 450, 350);
export const CAMERA_LOOK_AT = new THREE.Vector3(0, 0, -75);
export const CAMERA_LERP_FACTOR = 0.015; // Lower = smoother but more lag, higher = faster but less smooth

export function updateCameraFrustum(camera) {
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

export function createCamera() {
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

export function updateCameraPosition(camera, playerPosition) {
    const targetX = playerPosition.x + CAMERA_OFFSET.x;
    const targetZ = playerPosition.z + CAMERA_OFFSET.z;

    camera.position.x += (targetX - camera.position.x) * CAMERA_LERP_FACTOR;
    camera.position.z += (targetZ - camera.position.z) * CAMERA_LERP_FACTOR;
} 