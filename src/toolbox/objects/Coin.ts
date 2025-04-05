import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';

export function createCoin(): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.3, 0.1, 16);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0xffcc00,
        emissiveIntensity: 0.3
    });
    
    const coin = new THREE.Mesh(geometry, material);
    coin.castShadow = true;

    // Set position to be above the ground
    coin.position.y = BLOCK_SIZE * 0.5;
    
    // Rotate to lay flat like before
    coin.rotateX(Math.PI / 2);
    
    return coin;
} 