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

// Base interface for all game objects that can be stored in the Toolbox
export interface GameObject {
    mesh: THREE.Object3D;
    type: string;
    options?: any;
}

// Roblox-inspired Toolbox for managing game objects
export interface Toolbox {
    // Generic method to get any type of game object
    getObject<T extends THREE.Object3D>(type: string): T | undefined;
    
    // Generic method to create and add a new game object
    createObject<T extends THREE.Object3D>(type: string, options?: any): T;
    
    // Generic method to remove a game object
    removeObject(object: THREE.Object3D): void;
    
    // Method to get all objects of a specific type
    getAllObjects<T extends THREE.Object3D>(type: string): T[];
}

export interface Workspace {
    scene: THREE.Scene;
    localPlayer: PlayerRepresentation; // Use the new type
    otherPlayers: PlayerRepresentation[]; // Use the new type
    toolbox: Toolbox; // Add the toolbox to the workspace
}

// Add other client-specific types here in the future if needed 