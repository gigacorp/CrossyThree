import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';

export interface CoinOptions {
    value?: number;
    position?: THREE.Vector3;
}

export function createCoin(options: CoinOptions = {}): THREE.Mesh {
    // Use cylinder geometry like before, with proper size based on BLOCK_SIZE
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
    
    // Set position if provided, otherwise default to (0,0,0)
    if (options.position) {
        coin.position.copy(options.position);
    }
    
    // Rotate to lay flat like before
    coin.rotateX(Math.PI / 2);
    
    return coin;
} 