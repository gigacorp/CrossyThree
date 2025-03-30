import * as THREE from 'three';
import { BLOCK_SIZE, MAP_HALF_WIDTH, MAP_HALF_HEIGHT, MOVE_DURATION, JUMP_HEIGHT, ROTATION_LERP_FACTOR } from './constants';
import { MoveCommand } from './client-types'; // Import from new file

export function createPlayer(): THREE.Group {
    // Create main player body (white box)
    const playerGeometry = new THREE.BoxGeometry(BLOCK_SIZE/2, BLOCK_SIZE*0.7, BLOCK_SIZE/2);
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

// Define interface for processMoveQueue options
interface ProcessMoveOptions {
    moveDuration?: number;
    jumpHeight?: number;
    rotationLerpFactor?: number;
}

// Function to process the movement queue for a player
export function processMoveQueue(queue: MoveCommand[], targetPlayer: THREE.Group, options: ProcessMoveOptions = {}) {
    if (queue.length === 0) {
        return;
    }

    const { 
        moveDuration = MOVE_DURATION,
        jumpHeight = JUMP_HEIGHT,
        rotationLerpFactor = ROTATION_LERP_FACTOR
    } = options;

    const move = queue[0];

    if (!move.startTime) {
        move.startTime = Date.now();
        // Calculate target rotation only once when the move starts
        if (move.movement.x !== 0 || move.movement.z !== 0) {
            move.targetRotation = Math.atan2(move.movement.x, move.movement.z);
        }
    }

    const elapsed = Date.now() - move.startTime;
    const progress = Math.min(elapsed / moveDuration, 1); // Ensure progress doesn't exceed 1

    // Calculate current position using lerp
    const currentX = THREE.MathUtils.lerp(move.startPos.x, move.targetPos.x, progress);
    const currentZ = THREE.MathUtils.lerp(move.startPos.z, move.targetPos.z, progress);

    // Apply jump height using a parabolic curve (or sine for simplicity)
    const jumpProgress = Math.sin(progress * Math.PI);
    const currentY = jumpProgress * jumpHeight;

    targetPlayer.position.set(currentX, currentY, currentZ);

    // Interpolate rotation if targetRotation is set
    if (move.targetRotation !== undefined) {
        targetPlayer.rotation.y = THREE.MathUtils.lerp(targetPlayer.rotation.y, move.targetRotation, rotationLerpFactor);
    }

    // If move is complete, remove it from the queue
    if (progress >= 1) {
        // Ensure final position and rotation are set exactly
        targetPlayer.position.set(move.targetPos.x, 0, move.targetPos.z); // Reset Y to 0
        if (move.targetRotation !== undefined) {
            targetPlayer.rotation.y = move.targetRotation;
        }
        queue.shift(); 
    }
} 