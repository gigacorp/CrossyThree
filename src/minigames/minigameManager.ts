import { Scene, Object3D, Vector3 } from "three";
import { Minigame } from "../minigame";
import { GameState } from "../client-types"; // Assuming GameState is defined here
import { CollectCoinsMinigame } from "./collectCoins"; // Import new minigame

export class MinigameManager {
    private currentMinigame: Minigame | null = null;
    private gameStateRef: GameState | null = null; // Reference to the main game state
    private sceneRef: Scene | null = null; // Reference to the scene
    private minigameType: string | null = null;

    constructor() { 
        // Initial state is set when starting a minigame
    }

    startMinigame(type: string, gameState: GameState): void {
        if (this.currentMinigame) {
            console.warn("Minigame already in progress. End the current one first.");
            return;
        }
        if (!gameState || !gameState.scene) {
            console.error("Cannot start minigame without valid GameState and Scene.");
            return;
        }

        this.gameStateRef = gameState;
        this.sceneRef = gameState.scene;
        this.minigameType = type;

        console.log(`Attempting to start minigame: ${type}`);

        switch (type) {
            case "collectCoins":
                this.currentMinigame = new CollectCoinsMinigame();
                break;
            // Add cases for other minigame types here
            default:
                console.error(`Unknown minigame type: ${type}`);
                this.gameStateRef = null; // Clear references if failed
                this.sceneRef = null;
                this.minigameType = null;
                return;
        }

        // Load assets first
        this.currentMinigame.load(this.sceneRef);

        // Then start the game logic
        this.currentMinigame.start(this.gameStateRef);

        // Optional: Move player to start position for this specific minigame
        if (this.currentMinigame instanceof CollectCoinsMinigame) {
            const startPos = this.currentMinigame.getStartPosition();
             console.log(`Minigame requested player start at: ${startPos.toArray().join(", ")}`);
             // Example: gameState.teleportPlayer(gameState.localPlayer.uuid, startPos);
             // For now, just log - player positioning needs careful handling
             if (this.gameStateRef.localPlayer) {
                 this.gameStateRef.localPlayer.mesh.position.copy(startPos);
             }
        }

        console.log(`Minigame "${type}" started. Instructions: ${this.currentMinigame.instructions}`);
    }

    update(delta: number): void {
        if (!this.currentMinigame || !this.gameStateRef) return;

        // Update the minigame internal state
        this.currentMinigame.update(delta, this.gameStateRef);

        // Check conditions using the localPlayer from GameState
        const localPlayer = this.gameStateRef.localPlayer;
        if (localPlayer) { 
             const playerPosition = localPlayer.mesh.position;
             let shouldEnd = false;

             // Update checks for CollectCoinsMinigame
             if (this.currentMinigame instanceof CollectCoinsMinigame) {
                 // Call checkCollection first
                 this.currentMinigame.checkCollection(playerPosition);
                 
                 // Then check if all coins are collected (win condition)
                 if (this.currentMinigame.checkWinCondition()) {
                     console.log("Minigame Win Condition Met! (All coins collected)");
                     shouldEnd = true;
                     // TODO: Handle win 
                 }
                 // No specific fail condition for falling in this game
             }
             
             if (shouldEnd) {
                 this.endMinigame();
             }
        } else {
             console.warn("Local player object not found in GameState during MinigameManager update.");
        }
    }

    endMinigame(): void {
        if (!this.currentMinigame) return;

        console.log(`Ending minigame: ${this.minigameType}`);
        this.currentMinigame.end();
        this.currentMinigame = null;
        this.gameStateRef = null;
        this.sceneRef = null;
        this.minigameType = null;
        // TODO: Return player to a default state or position?
    }

    // --- Forwarding Interface Methods ---
    // These allow the main game loop to notify the active minigame

    onPlayerDidSpawn(player: Object3D): void {
        this.currentMinigame?.onPlayerDidSpawn(player);
    }

    onPlayerDidMove(player: Object3D): void {
        this.currentMinigame?.onPlayerDidMove(player);
    }

    onPlayersDidTouch(player1: Object3D, player2: Object3D): void {
        this.currentMinigame?.onPlayersDidTouch(player1, player2);
    }

    // --- Status Getters ---

    isActive(): boolean {
        return !!this.currentMinigame;
    }

    getCurrentInstructions(): string | null {
        return this.currentMinigame?.instructions ?? null;
    }
} 