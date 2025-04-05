import * as THREE from 'three';
import { BLOCK_SIZE } from './constants';

// Function to create 2D text sprite
export function createGroundText(text: string, color = '#ffffff'): THREE.Mesh | null {
    // Create canvas
    const canvas = document.createElement('canvas');
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');

    if (!context) {
        console.error('Failed to get 2D context');
        return null;
    }

    canvas.width = 2048; // Doubled canvas width
    canvas.height = 512; // Doubled canvas height

    // Set text style
    context.font = 'bold 192px Arial'; // Doubled font size
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Measure text width
    const metrics = context.measureText(text);
    const textWidth = metrics.width;

    // Scale canvas width based on text width if needed
    if (textWidth > canvas.width * 0.8) {
        canvas.width = textWidth * 1.25;
        // Reset context properties after resize
        context.font = 'bold 192px Arial'; // Doubled font size
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
    }

    // Draw text
    context.fillText(text, canvas.width / 2, canvas.height / 2);

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
    const textMesh = new THREE.Mesh(geometry, material);
    textMesh.position.y = 0.1; // Slightly above ground
    textMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat on the ground

    // Wrap in group
    const group = new THREE.Group();
    group.add(textMesh);

    return textMesh;
} 