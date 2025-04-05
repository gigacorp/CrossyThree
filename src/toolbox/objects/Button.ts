import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';

// Function to create a button
export function createButton(): THREE.Object3D {
    const buttonGeometry = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
    const buttonMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xaaaaaa, 
        metalness: 0.2, 
        roughness: 0.5 
    });
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);

    // Align with the ground
    buttonMesh.rotateX(Math.PI / -2);

    // Position the lava tile slightly above the ground plane
    buttonMesh.position.y = 0.1;
    
    // Create a group to hold the mesh (for potential future additions like animations)
    const group = new THREE.Group();
    group.add(buttonMesh);
    
    return group;
} 