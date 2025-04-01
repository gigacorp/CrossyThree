import * as THREE from 'three';
import { Minigame } from "../minigame";
import { Workspace } from "../client-types";
import { BLOCK_SIZE, MAP_WIDTH, MAP_HEIGHT } from "../constants";
import { Toolbox } from "../client-types";

// --- Particle Effect Helper --- 

interface ParticleEffect {
    points: THREE.Points;
    velocities: THREE.Vector3[];
    lifespan: number; // Total time in seconds
    elapsed: number;  // Time elapsed
    initialOpacity: number;
}

function createCoinCollectEffect(position: THREE.Vector3): ParticleEffect {
    const particleCount = 40;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    const lifespan = 0.6; // Slightly longer lifespan
    const velocityScale = 100; // Increased from 3

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;

        // Increase velocity magnitude
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * velocityScale,
            (Math.random() - 0.5) * velocityScale + 1.5, // Stronger upward bias
            (Math.random() - 0.5) * velocityScale
        );
        velocities.push(velocity);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0xffeb3b, // Bright yellow
        size: 10.0, // Increased from 0.5
        transparent: true,
        opacity: 0.9, // Start slightly less transparent
        blending: THREE.AdditiveBlending, 
        sizeAttenuation: false,
        depthWrite: false 
    });

    const points = new THREE.Points(particles, material);

    return {
        points,
        velocities,
        lifespan,
        elapsed: 0,
        initialOpacity: material.opacity
    };
}

// --- Minigame Class --- 

export class CollectCoinsMinigame implements Minigame {
    instructions = "Collect all the coins!";

    private sceneRef: THREE.Scene | null = null;
    private workspaceRef: Workspace | null = null;
    private coins: THREE.Mesh[] = [];
    private isActive: boolean = false;
    private coinCount = 10;
    private collectDistance = BLOCK_SIZE * 0.75;
    private startPosition = new THREE.Vector3(0, 0, 0);
    private activeEffects: ParticleEffect[] = [];

    load(scene: THREE.Scene): void {
        console.log("CollectCoinsMinigame assets loaded (if any).");
    }

    start(workspace: Workspace): void {
        if (this.isActive || !workspace || !workspace.scene) {
            console.error("Cannot start CollectCoinsMinigame: Already active or invalid workspace.");
            return;
        }
        this.sceneRef = workspace.scene;
        this.workspaceRef = workspace;
        this.isActive = true;
        this.coins = [];
        this.activeEffects = [];

        console.log("Starting Collect Coins Minigame...");

        for (let i = 0; i < this.coinCount; i++) {
            const coin = this.workspaceRef.toolbox.createObject<THREE.Mesh>('coin', {
                position: new THREE.Vector3(
                    (Math.random() - 0.5) * MAP_WIDTH,
                    BLOCK_SIZE * 0.5,
                    (Math.random() - 0.5) * MAP_HEIGHT
                )
            });
            this.coins.push(coin);
        }

        console.log("Collect Coins Minigame Started!");
    }

    update(delta: number, workspace: Workspace): void {
        if (!this.isActive) return;

        // Animate coins (e.g., rotate)
        this.coins.forEach(coin => {
            coin.rotation.z += delta * 1.5;
        });

        // Update active particle effects
        this.activeEffects = this.activeEffects.filter(effect => {
            effect.elapsed += delta;
            if (effect.elapsed >= effect.lifespan) {
                // Remove effect from scene
                this.sceneRef?.remove(effect.points);
                effect.points.geometry.dispose();
                (effect.points.material as THREE.PointsMaterial).dispose();
                return false; // Filter out this effect
            }

            // Update particle positions and fade out
            const positions = effect.points.geometry.getAttribute('position') as THREE.BufferAttribute;
            const progress = effect.elapsed / effect.lifespan;
            (effect.points.material as THREE.PointsMaterial).opacity = effect.initialOpacity * (1 - progress);

            for (let i = 0; i < effect.velocities.length; i++) {
                const i3 = i * 3;
                positions.setX(i3, positions.getX(i3) + effect.velocities[i].x * delta);
                positions.setY(i3 + 1, positions.getY(i3 + 1) + effect.velocities[i].y * delta);
                positions.setZ(i3 + 2, positions.getZ(i3 + 2) + effect.velocities[i].z * delta);
            }
            positions.needsUpdate = true; // Important!

            return true; // Keep effect in list
        });
    }

    end(): void {
        if (!this.isActive || !this.sceneRef || !this.workspaceRef) return;
        console.log("Collect Coins Minigame Ended.");

        this.coins.forEach(coin => {
            this.workspaceRef!.toolbox.removeObject(coin);
        });
        this.coins = [];

        // Clean up any remaining particle effects
        this.activeEffects.forEach(effect => {
            this.sceneRef?.remove(effect.points);
            effect.points.geometry.dispose();
            (effect.points.material as THREE.PointsMaterial).dispose();
        });
        this.activeEffects = [];

        this.sceneRef = null;
        this.workspaceRef = null;
        this.isActive = false;
    }

    // --- Interface Methods --- 
    onPlayerDidSpawn(player: THREE.Object3D): void { }
    onPlayerDidMove(player: THREE.Object3D): void { }
    onPlayersDidTouch(player1: THREE.Object3D, player2: THREE.Object3D): void { }

    // --- Game Logic Methods --- 

    // Returns true if all coins are collected
    public checkWinCondition(): boolean {
        return this.isActive && this.coins.length === 0;
    }

    // Call this from the manager/game loop to check if the player collected a coin
    public checkCollection(playerPosition: THREE.Vector3): void {
        if (!this.isActive || !this.sceneRef || !this.workspaceRef) return;

        const playerPosXZ = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);

        this.coins = this.coins.filter(coin => {
            const coinPos = coin.position.clone();
            const coinPosXZ = new THREE.Vector3(coinPos.x, 0, coinPos.z);
            const distance = playerPosXZ.distanceTo(coinPosXZ);
            
            if (distance < this.collectDistance) {
                console.log("Coin collected!");

                // Create particle effect at coin's position
                const effect = createCoinCollectEffect(coinPos);
                this.activeEffects.push(effect);
                this.sceneRef?.add(effect.points);

                // Remove coin using toolbox
                this.workspaceRef!.toolbox.removeObject(coin);
                return false;
            }
            return true;
        });
    }

    public getStartPosition(): THREE.Vector3 {
        return this.startPosition.clone();
    }
} 