import { Scene, Object3D, Vector3 } from "three";
import { Minigame } from "../minigame";
import { Workspace } from "../client-types";
import { CollectCoinsMinigame } from "./collectCoins"; // Import new minigame

export class MinigameManager {
    private currentMinigame: Minigame | null = null;
    private workspaceRef: Workspace | null = null; // Reference to the main game state
    private sceneRef: Scene | null = null; // Reference to the scene
    private minigameType: string | null = null;

    constructor() { 
        // Initial state is set when starting a minigame
    }

    startMinigame(type: string, workspace: Workspace): void {
        if (this.currentMinigame) {
            console.warn("Minigame already in progress. End the current one first.");
            return;
        }
        if (!workspace || !workspace.scene) {
            console.error("Cannot start minigame without valid workspace and Scene.");
            return;
        }

        this.workspaceRef = workspace;
        this.sceneRef = workspace.scene;
        this.minigameType = type;

        console.log(`Attempting to start minigame: ${type}`);

        // Ensure refs are valid before proceeding
        if (!this.sceneRef || !this.workspaceRef) {
            console.error("SceneRef or WorkspaceRef became null unexpectedly during minigame start.");
            return;
        }

        switch (type) {
            case "collectCoins":
                // Only pass workspace, scene is accessed through it
                this.currentMinigame = new CollectCoinsMinigame(this.workspaceRef);
                break;
            // Add cases for other minigame types here
            default:
                console.error(`Unknown minigame type: ${type}`);
                this.workspaceRef = null; // Clear references if failed
                this.sceneRef = null;
                this.minigameType = null;
                return;
        }

        // Add null check for currentMinigame before loading/starting
        if (!this.currentMinigame) {
            console.error("Failed to instantiate minigame.");
            this.workspaceRef = null; // Clear references if failed
            this.sceneRef = null;
            this.minigameType = null;
            return;
        }

        // Then start the game logic, no longer passing workspaceRef
        this.currentMinigame.start();

        // Optional: Move player to start position
        // Check instanceof and ensure currentMinigame is not null
        if (this.currentMinigame instanceof CollectCoinsMinigame) {
            const startPos = this.currentMinigame.getStartPosition();
            console.log(`Minigame requested player start at: ${startPos.toArray().join(", ")}`);
            if (this.workspaceRef?.localPlayer) {
                this.workspaceRef.localPlayer.mesh.position.copy(startPos);
            }
        }

        console.log(`Minigame "${type}" started. Instructions: ${this.currentMinigame.instructions}`);
    }

    update(delta: number): void {
        if (!this.currentMinigame || !this.workspaceRef) return;

        // Update the minigame internal state, no longer passing workspaceRef
        this.currentMinigame.update(delta);
    }

    endMinigame(): void {
        if (!this.currentMinigame) return;

        console.log(`Ending minigame: ${this.minigameType}`);
        this.currentMinigame.end();
        this.currentMinigame = null;
        this.workspaceRef = null;
        this.sceneRef = null;
        this.minigameType = null;
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