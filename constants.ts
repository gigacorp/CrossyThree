// The size of a single block/unit in the game world
// Used for player size, movement distances, and map dimensions
export const BLOCK_SIZE = 30;

export const MOVE_DURATION = 150; // milliseconds
export const MOVE_DISTANCE = BLOCK_SIZE; // Player moves two units per move
export const JUMP_HEIGHT = 10;

export const MAP_WIDTH = 17*BLOCK_SIZE; // Width of the play field (X direction)
export const MAP_HEIGHT = 60*BLOCK_SIZE; // Height of the play field (Z direction)
export const MAP_HALF_WIDTH = MAP_WIDTH / 2; // Half width for boundary checks
export const MAP_HALF_HEIGHT = MAP_HEIGHT / 2; // Half height for boundary checks

export const SWIPE_THRESHOLD = 50; // pixels
export const TAP_THRESHOLD = 200; // milliseconds
export const ROTATION_LERP_FACTOR = 0.3; // Rotation interpolation speed

export const MOVE_DURATION_MS = MOVE_DURATION / 1000; // Convert milliseconds to seconds
export const MOVE_DURATION_S = MOVE_DURATION_MS / 1000; // Convert milliseconds to minutes
export const MOVE_DURATION_M = MOVE_DURATION_MS / 60; // Convert milliseconds to hours 