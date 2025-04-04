import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

// Basic structure for 3D coordinates
export class Vector3State extends Schema {
    x: number = 0;
    y: number = 0;
    z: number = 0;
}
defineTypes(Vector3State, { x: "number", y: "number", z: "number" });

// Represents the parameters for an action defined in the minigame JSON
export class ActionState extends Schema {
    type: string = "None"; // Default action type

    // Parameters for specific action types (optional)
    score?: number;
    respawn?: string;       // "StartZone", "LastCheckpoint"
    targetId?: string;
    setVisible?: boolean;  // If present, set explicitly; if absent/null, implies toggle
    requiredCollectibles?: number;
    // Potential future params
    // effect?: string;
    // duration?: number;
    // targetPosition?: Vector3State;
}
defineTypes(ActionState, {
    type: "string",
    score: "number",
    respawn: "string",
    targetId: "string",
    setVisible: "boolean",
    requiredCollectibles: "number",
    // effect: "string",
    // duration: "number",
    // targetPosition: Vector3State,
});

// Represents a single object loaded from the minigame definition JSON
export class MinigameObjectState extends Schema {
    // ID is the key in the MapSchema
    type: string = "Tile"; // "Tile", "Text", "Platform" etc. from JSON
    position = new Vector3State();
    visible: boolean = true; // Current visibility state

    // --- Tile specific ---
    tileType?: string;    // e.g., "Lava", "Coin", "Grass"
    action?: ActionState; // Action associated with a tile

    // --- Text specific ---
    text?: string;
    color?: string;       // e.g., "#FF0000"

    // --- Platform/Sized Object specific ---
    // size?: Vector3State; // If objects can have non-default sizes
}
defineTypes(MinigameObjectState, {
    // id: "string", // ID is the key
    type: "string",
    position: Vector3State,
    visible: "boolean",
    tileType: "string",
    action: ActionState,
    text: "string",
    color: "string",
    // size: Vector3State,
});

// Define the Player schema
export class Player extends Schema {
    name: string = "Initial name";
    x: number = Math.random() * 3;
    y: number = 0; // Add Y back
    z: number = Math.random() * 3;
    rotation: number = 0;
    score: number = 0;
    // Add other player-specific states as needed
    // currentCheckpointId?: string;
    // finished: boolean = false;
}
defineTypes(Player, {
    name: "string",
    x: "number",
    y: "number", // Add Y back
    z: "number",
    rotation: "number",
    score: "number",
});

// Define the GameState schema
export class GameState extends Schema {
    players = new MapSchema<Player>();
    playerCount = 0;

    // Current active minigame ID (from JSON) or null if none
    currentMinigameId: string | null = null;

    // Holds all the objects for the currently loaded minigame
    minigameObjects = new MapSchema<MinigameObjectState>();
}
defineTypes(GameState, {
    players: { map: Player },
    playerCount: "number",

    // Added minigame fields back
    currentMinigameId: "string",
    minigameObjects: { map: MinigameObjectState }
});

// --- Message Interfaces ---

export interface MoveMessage {
    movement: { x: number; z: number };
    startPos: { x: number; z: number };
    targetPos: { x: number; z: number };
}

export interface PlayerMoveCommand {
    playerId: string;
    movement: { x: number; z: number };
    startPos: { x: number; z: number };
    targetPos: { x: number; z: number };
}

// Interface for move commands stored in client-side animation queues
// MOVED TO client-types.ts
// export interface MoveCommand { ... }

export interface PlayerMessage {
    name: string;
    x: number;
    y: number;
}

export interface PlayerLeftMessage {
    id: string;
} 