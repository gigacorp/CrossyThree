import { Scene, Object3D } from "three";
import * as THREE from 'three';

// Interface for move commands stored in client-side animation queues
export interface MoveCommand {
    movement: { x: number; z: number };
    startPos: { x: number; z: number };
    targetPos: { x: number; z: number };
    startTime: number | null;
    targetRotation?: number; // Optional: Calculated during animation processing
}

// Define the new PlayerRepresentation interface
export interface PlayerRepresentation {
    id: string; // Player's unique session ID
    mesh: THREE.Group; // The visual representation (using Group for consistency)
}

// Add other client-specific types here in the future if needed 

export interface Workspace {
    scene: THREE.Scene;
    localPlayer: PlayerRepresentation; // Use the new type
    otherPlayers: PlayerRepresentation[]; // Use the new type
}