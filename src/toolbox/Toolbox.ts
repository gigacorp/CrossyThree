import * as THREE from 'three';
import { BLOCK_SIZE } from '../constants';
import { createCoin } from './objects/Coin';
import { createLava } from './objects/Lava';
import { createButton } from './objects/Button';
import { createText } from './objects/Text';
import { GameObject } from '../client-types';
import { MinigameObjectState } from '../schema';

export class Toolbox {
    constructor() { }

    // Method to create objects based on type
    createObject(id: string, state: MinigameObjectState): GameObject | null {
        switch (state.type) {
            case 'Coin':
                return createCoin(id, state);
            case 'Lava':
                return createLava(id, state);
            case 'Button':
                return createButton(id, state);
            case 'Text':
                return createText(id, state);
            default:
                console.warn(`Toolbox: Unknown object type requested: ${state.type}`);
                return null;
        }
    }
} 