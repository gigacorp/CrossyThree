import * as THREE from 'three';
import { Toolbox, GameObject } from '../client-types';
import { createCoin, CoinOptions } from './objects/Coin';

export class ToolboxImpl implements Toolbox {
    private objects: Map<string, GameObject[]> = new Map();
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    getObject<T extends THREE.Object3D>(type: string): T | undefined {
        const objectsOfType = this.objects.get(type);
        if (!objectsOfType || objectsOfType.length === 0) return undefined;
        return objectsOfType[0].mesh as T;
    }

    createObject<T extends THREE.Object3D>(type: string, options?: any): T {
        let mesh: THREE.Object3D;
        
        switch (type) {
            case 'coin':
                mesh = createCoin(options as CoinOptions);
                break;
            default:
                // Default fallback for unknown types
                mesh = new THREE.Object3D();
        }

        const gameObject: GameObject = {
            mesh,
            type,
            options
        };

        // Add to scene
        this.scene.add(mesh);

        // Store in our map
        if (!this.objects.has(type)) {
            this.objects.set(type, []);
        }
        this.objects.get(type)!.push(gameObject);

        return mesh as T;
    }

    removeObject(object: THREE.Object3D): void {
        // Find and remove from scene
        this.scene.remove(object);

        // Find and remove from our map
        for (const [type, objects] of this.objects.entries()) {
            const index = objects.findIndex(obj => obj.mesh === object);
            if (index !== -1) {
                objects.splice(index, 1);
                break;
            }
        }
    }

    getAllObjects<T extends THREE.Object3D>(type: string): T[] {
        const objectsOfType = this.objects.get(type);
        if (!objectsOfType) return [];
        return objectsOfType.map(obj => obj.mesh as T);
    }
} 