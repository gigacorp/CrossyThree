import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';
import { GameObject } from '../../client-types';
import { MinigameObjectState } from '../../schema';

export class Coin implements GameObject {
    mesh: THREE.Mesh;
    id: string;
    state: MinigameObjectState;

    constructor(id: string, state: MinigameObjectState) {
        this.id = id;
        this.state = state;

        const geometry = new THREE.CylinderGeometry(BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.1, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.2,
            emissive: 0xffcc00,
            emissiveIntensity: 0.3
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;

        // Set position to be above the ground
        this.mesh.position.y = BLOCK_SIZE * 0.5;
        
        // Rotate to lay flat like before
        this.mesh.rotateX(Math.PI / 2);

        // Set initial position from state
        this.mesh.position.set(state.position.x, state.position.y, state.position.z);
        this.mesh.visible = state.visible;
    }

    update(delta: number): void {
        this.mesh.position.y = BLOCK_SIZE * 0.5;
        this.mesh.rotation.z += delta * 2; // Rotate 2 radians per second
    }
}

export function createCoin(id: string, state: MinigameObjectState): Coin {
    return new Coin(id, state);
} 