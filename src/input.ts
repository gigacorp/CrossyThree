import { SWIPE_THRESHOLD, TAP_THRESHOLD, MOVE_DISTANCE } from './constants';

// Define the type for movement intention
export type MoveIntention = { x: number; z: number };

// Define the callback function type
export type MoveCallback = (intention: MoveIntention) => void;

// --- Module State ---
let moveCallback: MoveCallback | null = null;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isAttached = false;

// --- Event Handlers ---
function handleKeyDown(event: KeyboardEvent) {
    // Access isMoving - this dependency needs to be handled.
    // For now, assume it's less critical or managed externally.
    // if (isMoving) return; 
    if (event.repeat) return;
    
    let intention: MoveIntention | null = null;
    switch(event.key) {
        case 'ArrowLeft':
            intention = {x: -1, z: 0};
            break;
        case 'ArrowRight':
            intention = {x: 1, z: 0};
            break;
        case 'ArrowUp':
            intention = {x: 0, z: -1};
            break;
        case 'ArrowDown':
            intention = {x: 0, z: 1};
            break;
    }
    
    if (intention && moveCallback) {
        moveCallback(intention);
    }
}

function handleKeyUp(event: KeyboardEvent) {
    // No keyup logic currently needed
}

function handleTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) { // Ensure there are touches
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchStartTime = Date.now();
    }
    // Prevent default scroll/zoom behavior
    event.preventDefault(); 
}

function handleTouchMove(event: TouchEvent) {
    // Prevent default scroll/zoom behavior during move
    event.preventDefault(); 
}

function handleTouchEnd(event: TouchEvent) {
    if (event.changedTouches.length === 0) return; // Check if there are changed touches

    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const deltaTime = touchEndTime - touchStartTime;
    
    let intention: MoveIntention | null = null;

    if (deltaTime < 10) return; // Ignore tiny touch durations

    if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
        // Swipe detected
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            intention = (deltaX > 0) ? { x: 1, z: 0 } : { x: -1, z: 0 }; // Right or Left
        } else {
            intention = (deltaY > 0) ? { x: 0, z: 1 } : { x: 0, z: -1 }; // Down or Up
        }
    } else if (deltaTime < TAP_THRESHOLD) {
        // Tap detected (treat as move forward)
        intention = { x: 0, z: -1 };
    }
    
    if (intention && moveCallback) {
        moveCallback(intention);
    }
    // Prevent default actions on touchend if needed
    event.preventDefault(); 
}

// --- Setup and Teardown ---
export function initializeInput(callback: MoveCallback) {
    console.log("Initializing input listeners...");
    if (isAttached) {
        console.warn("Input listeners already attached.");
        return;
    }
    moveCallback = callback;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: false }); // Use non-passive for preventDefault
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    isAttached = true;
}

export function cleanupInput() {
    console.log("Cleaning up input listeners...");
    if (!isAttached) {
        return;
    }
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);

    moveCallback = null;
    isAttached = false;
} 