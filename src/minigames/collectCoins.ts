import * as THREE from 'three';
import { Minigame } from '../minigame';
import { Workspace, PlayerRepresentation } from '../client-types';
import { BLOCK_SIZE, MAP_HEIGHT, MAP_WIDTH } from '../constants';
import { ParticleEffect, createParticleEffect } from '../effects/particleEffect';

export class CollectCoinsMinigame implements Minigame {
    public instructions = "Collect all the coins!";
    public name = "Collect Coins";
    public duration = 60; // 1 minute

    private workspaceRef: Workspace;
    private coins: THREE.Mesh[] = [];
    private isActive: boolean = false;
    private coinCount = 10;
    private collectDistance = BLOCK_SIZE * 0.75;
    private startPosition = new THREE.Vector3(0, 0, 0);
    private activeEffects: ParticleEffect[] = [];

    constructor(workspace: Workspace) {
        this.workspaceRef = workspace;
    }

    start(): void {
        if (this.isActive) {
            console.error("Cannot start CollectCoinsMinigame: Already active.");
            return;
        }
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
            if (!coin.parent) {
                this.workspaceRef.scene.add(coin);
            }
        }

        console.log("Collect Coins Minigame Started!");
    }

    update(delta: number): void {
        if (!this.isActive) return;

        this.coins.forEach(coin => {
            coin.rotation.y += delta * 2;
            coin.position.y = BLOCK_SIZE * 0.5 + Math.sin(Date.now() * 0.005) * (BLOCK_SIZE * 0.1);
        });

        this.activeEffects = this.activeEffects.filter(effect => {
            effect.elapsed += delta;
            effect.update();
            if (effect.elapsed >= effect.lifespan) {
                this.workspaceRef.scene.remove(effect.points);
                effect.points.geometry.dispose();
                (effect.points.material as THREE.PointsMaterial).dispose();
                return false;
            }
            return true;
        });

        const allPlayers: PlayerRepresentation[] = [];
        if (this.workspaceRef.localPlayer) {
            allPlayers.push(this.workspaceRef.localPlayer);
        }
        allPlayers.push(...this.workspaceRef.otherPlayers);

        allPlayers.forEach((player: PlayerRepresentation) => {
            const coinsToRemoveIndices: number[] = [];

            this.coins.forEach((coin, index) => {
                if (player.mesh.position.distanceTo(coin.position) < this.collectDistance) {
                    console.log(`Player ${player.id} collected a coin!`);

                    const effect = createParticleEffect(this.workspaceRef.scene, coin.position, 0xffd700, 50, 0.5);
                    this.activeEffects.push(effect);

                    this.workspaceRef.scene.remove(coin);
                    this.workspaceRef.toolbox.removeObject(coin);
                    coinsToRemoveIndices.push(index);

                    if (this.coins.length - coinsToRemoveIndices.length === 0) {
                        console.log("All coins collected! Game might end or reset.");
                    }
                }
            });

            for (let i = coinsToRemoveIndices.length - 1; i >= 0; i--) {
                this.coins.splice(coinsToRemoveIndices[i], 1);
            }
        });
    }

    end(): void {
        console.log("Collect Coins Minigame ended!");
        this.coins.forEach(coin => {
            this.workspaceRef.scene.remove(coin);
            this.workspaceRef.toolbox.removeObject(coin);
        });
        this.coins = [];

        this.activeEffects.forEach(effect => {
            this.workspaceRef.scene.remove(effect.points);
             effect.points.geometry.dispose();
             (effect.points.material as THREE.PointsMaterial).dispose();
        });
        this.activeEffects = [];

        this.isActive = false;
    }

    getStartPosition(): THREE.Vector3 {
        return this.startPosition.clone();
    }

    getScore(clientId: string): number {
        return 0; // Placeholder return
    }

    // Add missing interface methods
    onPlayerDidSpawn(player: THREE.Object3D): void { 
        // console.log("CollectCoins: Player spawned", player.uuid);
    }
    onPlayerDidMove(player: THREE.Object3D): void { 
        // console.log("CollectCoins: Player moved", player.uuid);
    }
    onPlayersDidTouch(player1: THREE.Object3D, player2: THREE.Object3D): void { 
        // console.log("CollectCoins: Players touched", player1.uuid, player2.uuid);
    }
} 