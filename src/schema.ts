import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

// Define the Player schema
export class Player extends Schema {
    x = 0;
    y = 0;
    z = 0;
    rotation = 0;
}
defineTypes(Player, {
    x: "number",
    y: "number",
    z: "number",
    rotation: "number"
});

// Define the GameState schema
export class GameState extends Schema {
    players = new MapSchema<Player>();
    playerCount = 0;
}
defineTypes(GameState, {
    players: { map: Player },
    playerCount: "number"
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