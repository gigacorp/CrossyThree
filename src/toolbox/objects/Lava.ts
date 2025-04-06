import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';
import { GameObject } from '../../client-types';
import { MinigameObjectState } from '../../schema';

export class Lava implements GameObject {
    mesh: THREE.Group;
    id: string;
    state: MinigameObjectState;

    constructor(id: string, state: MinigameObjectState) {
        this.id = id;
        this.state = state;

        // Create a flat lava tile
        const lavaGeometry = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
        const lavaMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff4500, 
            emissive: 0xcc3300, 
            roughness: 0.9 
        });
        const lavaMesh = new THREE.Mesh(lavaGeometry, lavaMaterial);

        lavaMesh.receiveShadow = true;

        // Align with the ground
        lavaMesh.rotateX(Math.PI / -2);

        // Position the lava tile slightly above the ground plane
        lavaMesh.position.y = 0.1;
        
        // Create a group to hold the mesh (for potential future additions like particles)
        this.mesh = new THREE.Group();
        this.mesh.add(lavaMesh);

        // Set initial position from state
        this.mesh.position.set(state.position.x, state.position.y, state.position.z);
        this.mesh.visible = state.visible;
    }

    update(delta: number): void {
        // Add any lava-specific update logic here
        // For example, lava flow animation or particle effects
    }
}

export function createLava(id: string, state: MinigameObjectState): Lava {
    return new Lava(id, state);
} 