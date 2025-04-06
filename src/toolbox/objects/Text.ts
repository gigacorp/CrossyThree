import * as THREE from 'three';
import { GameObject } from '../../client-types';
import { MinigameObjectState } from '../../schema';

export class Text implements GameObject {
    id: string;
    state: MinigameObjectState;
    mesh: THREE.Object3D;

    constructor(id: string, state: MinigameObjectState) {
        this.id = id;
        this.state = state;
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context: CanvasRenderingContext2D | null = canvas.getContext('2d');

        if (!context) {
            console.error('Failed to get 2D context');
            this.mesh = new THREE.Group(); // Fallback empty group
            return;
        }

        canvas.width = 2048; // Doubled canvas width
        canvas.height = 512; // Doubled canvas height

        // Set text style
        context.font = 'bold 192px Arial'; // Doubled font size
        context.fillStyle = state.color || '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Measure text width
        const metrics = context.measureText(state.text || '');
        const textWidth = metrics.width;

        // Scale canvas width based on text width if needed
        if (textWidth > canvas.width * 0.8) {
            canvas.width = textWidth * 1.25;
            // Reset context properties after resize
            context.font = 'bold 192px Arial'; // Doubled font size
            context.fillStyle = state.color || '#ffffff';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
        }

        // Draw text
        context.fillText(state.text || '', canvas.width / 2, canvas.height / 2);

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        // Create plane geometry with aspect ratio matching the canvas
        const aspectRatio = canvas.width / canvas.height;
        const height = 40; // Doubled height
        const width = height * aspectRatio;
        const geometry = new THREE.PlaneGeometry(width, height);

        // Create material with the text texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });

        // Create mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 0.1; // Slightly above ground
        this.mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat on the ground
        this.mesh.receiveShadow = true;

        // Position the mesh
        if (state.position) {
            this.mesh.position.set(
                state.position.x,
                state.position.y,
                state.position.z
            );
        }
    }

    update(delta: number): void {
        // Text objects don't need updates
    }
}

export function createText(id: string, state: MinigameObjectState): Text {
    return new Text(id, state);
} 