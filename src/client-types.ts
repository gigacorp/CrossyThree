import { Scene, Object3D } from "three";

// Interface for move commands stored in client-side animation queues
export interface MoveCommand {
    movement: { x: number; z: number };
    startPos: { x: number; z: number };
    targetPos: { x: number; z: number };
    startTime: number | null;
    targetRotation?: number; // Optional: Calculated during animation processing
}

// Add other client-specific types here in the future if needed 

export interface GameState {
    scene: Scene;
    localPlayer: Object3D;
    otherPlayers: Object3D[];
}