import * as THREE from 'three';
import { BLOCK_SIZE } from '../constants';
import { createCoin } from './objects/Coin';
import { createLava } from './objects/Lava';
import { createButton } from './objects/Button';
import { GameObject } from '../client-types';
import { MinigameObjectState } from '../schema';

export class Toolbox {
    constructor() { }

    // Method to create objects based on type
    createObject(id: string, state: MinigameObjectState): GameObject | null {
        let object: GameObject | null = null;

        switch (state.tileType) {
            case 'Coin':
                object = createCoin(id, state);
                break;
            case 'Lava':
                object = createLava(id, state);
                break;
            case 'Button':
                object = createButton(id, state);
                break;
            default:
                console.warn(`Toolbox: Unknown object type requested: ${state.tileType}`);
                return null;
        }

        return object;
    }
} 