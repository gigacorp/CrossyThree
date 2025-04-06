import * as THREE from 'three';
import { BLOCK_SIZE } from '../../constants';
import { GameObject } from '../../client-types';
import { MinigameObjectState } from '../../schema';

export class Button implements GameObject {
    mesh: THREE.Group;
    id: string;
    state: MinigameObjectState;
    private isPressed: boolean = false;

    constructor(id: string, state: MinigameObjectState) {
        this.id = id;
        this.state = state;

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
        this.mesh = new THREE.Group();
        this.mesh.add(buttonMesh);

        // Set initial position from state
        this.mesh.position.set(state.position.x, state.position.y, state.position.z);
        this.mesh.visible = state.visible;
    }

    update(delta: number): void {
        // Add any button-specific update logic here
        // For example, animation when pressed
        if (this.isPressed) {
            const buttonMesh = this.mesh.children[0] as THREE.Mesh;
            buttonMesh.position.y = 0.05; // Sink when pressed
        } else {
            const buttonMesh = this.mesh.children[0] as THREE.Mesh;
            buttonMesh.position.y = 0.1; // Normal position
        }
    }

    press(): void {
        this.isPressed = true;
    }

    release(): void {
        this.isPressed = false;
    }
}

export function createButton(id: string, state: MinigameObjectState): Button {
    return new Button(id, state);
} 