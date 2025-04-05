import * as THREE from 'three';
import { BLOCK_SIZE } from '../constants';
import { createCoin } from './objects/Coin';
import { createLava } from './objects/Lava';
import { createButton } from './objects/Button';

export class Toolbox {
    constructor() { }

    // Method to create objects based on type
    // Remove options parameter
    createObject(type: string): THREE.Object3D | null {
        let object: THREE.Object3D | null = null;

        switch (type) {
            case 'Coin':
                object = createCoin();
                break;
            case 'Lava':
                object = createLava();
                break;
            case 'Button':
                object = createButton();
                break;
            default:
                console.warn(`Toolbox: Unknown object type requested: ${type}`);
                return null;
        }

        // Wrap the object in a group to make its position relative to the group's position
        let group = new THREE.Group();
        group.add(object);

        return group;
    }
} 