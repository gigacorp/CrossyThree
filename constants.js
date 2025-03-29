// The size of a single block/unit in the game world
// Used for player size, movement distances, and map dimensions
export const BLOCK_SIZE = 30;

export const MOVE_DURATION = 100; // 0.1 second
export const MOVE_DISTANCE = BLOCK_SIZE; // Player moves two units per move
export const JUMP_HEIGHT = 10; // Maximum jump height

export const MAP_WIDTH = 17*BLOCK_SIZE; // Width of the play field (X direction)
export const MAP_HEIGHT = 60*BLOCK_SIZE; // Height of the play field (Z direction)
export const MAP_HALF_WIDTH = MAP_WIDTH / 2; // Half width for boundary checks
export const MAP_HALF_HEIGHT = MAP_HEIGHT / 2; // Half height for boundary checks

export const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
export const TAP_THRESHOLD = 200; // Maximum time for tap (ms) 