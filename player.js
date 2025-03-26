import * as THREE from './node_modules/three/build/three.module.min.js';
import { MAP_HALF_WIDTH, MAP_HALF_HEIGHT, MOVE_DURATION, JUMP_HEIGHT } from './constants.js';

export function createPlayer() {
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

export function processMoveQueue(queue, targetPlayer, options = {}) {
    const {
        moveDuration = MOVE_DURATION,
        jumpHeight = JUMP_HEIGHT,
        rotationLerpFactor = 0.3  // Much faster than movement for snappy rotation
    } = options;

    const currentMove = queue[0];
    
    if (!currentMove.startTime) {
        currentMove.startTime = Date.now();
        
        // Calculate target rotation angle based on movement direction
        const targetAngle = Math.atan2(currentMove.movement.x, currentMove.movement.z);
        currentMove.targetRotation = targetAngle;

        // Check if target position is within bounds
        const targetX = currentMove.targetPos.x;
        const targetZ = currentMove.targetPos.z;
        
        if (Math.abs(targetX) > MAP_HALF_WIDTH || Math.abs(targetZ) > MAP_HALF_HEIGHT) {
            // If out of bounds, keep the current position as target
            currentMove.targetPos = { ...currentMove.startPos };
            currentMove.movement = { x: 0, z: 0 };
        }
    }

    const elapsed = Date.now() - currentMove.startTime;
    const progress = Math.min(elapsed / moveDuration, 1);

    // Lerp between start and target positions
    targetPlayer.position.x = currentMove.startPos.x + (currentMove.targetPos.x - currentMove.startPos.x) * progress;
    targetPlayer.position.z = currentMove.startPos.z + (currentMove.targetPos.z - currentMove.startPos.z) * progress;

    // Add jumping motion using sine wave
    targetPlayer.position.y = Math.sin(progress * Math.PI) * jumpHeight;

    // Smooth rotation animation
    const currentRotation = targetPlayer.rotation.y;
    const targetRotation = currentMove.targetRotation;
    
    // Handle rotation wrapping around 2π
    let rotationDiff = targetRotation - currentRotation;
    if (rotationDiff > Math.PI) rotationDiff -= 2 * Math.PI;
    if (rotationDiff < -Math.PI) rotationDiff += 2 * Math.PI;
    
    targetPlayer.rotation.y += rotationDiff * rotationLerpFactor;

    if (progress === 1) {
        queue.shift();
        // Reset y position when movement is complete
        targetPlayer.position.y = 0;
        targetPlayer.rotation.y = currentMove.targetRotation;
    }
} 