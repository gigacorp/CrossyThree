import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';

// Function to create a lava tile
export function createLava(): THREE.Object3D {
    // Create a flat lava tile
    const lavaGeometry = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
    const lavaMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff4500, 
        emissive: 0xcc3300, 
        roughness: 0.9 
    });
    const lavaMesh = new THREE.Mesh(lavaGeometry, lavaMaterial);

    // Align with the ground
    lavaMesh.rotateX(Math.PI / -2);

    // Position the lava tile slightly above the ground plane
    lavaMesh.position.y = 0.1;
    
    // Create a group to hold the mesh (for potential future additions like particles)
    const group = new THREE.Group();
    group.add(lavaMesh);
    
    return group;
} 