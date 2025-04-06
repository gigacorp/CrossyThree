import * as THREE from 'three';
import { MAP_WIDTH, BLOCK_SIZE } from './constants';

export class Ground {
    mesh: THREE.Group;
    numRows: number;
    height: number;

    constructor(numRows: number) {
        this.numRows = numRows;
        this.mesh = this.createGroundMesh(numRows);
        this.height = numRows * BLOCK_SIZE;
    }

    private createGroundMesh(numRows: number): THREE.Group {
        const rowWidth = BLOCK_SIZE; // Width of each row
        const groundGroup = new THREE.Group();

        console.log("Creating ground with", numRows, "rows");
        
        // Create alternating rows starting from origin and going forward
        for (let i = 0; i < numRows; i++) {
            const rowGeometry = new THREE.PlaneGeometry(MAP_WIDTH, rowWidth);
            const rowMaterial = new THREE.MeshLambertMaterial({ 
                color: i % 2 === 0 ? 0x3a8c3a : 0x4a9c4a, // Alternating shades of green
                side: THREE.DoubleSide
            });
            const row = new THREE.Mesh(rowGeometry, rowMaterial);
            row.rotation.x = -Math.PI / 2; // Rotate to be horizontal

            // Position rows starting from origin and going forward (negative Z)
            row.position.z = -i * rowWidth;
            row.receiveShadow = true;
            groundGroup.add(row);
        }
        
        return groundGroup;
    }

    update(delta: number): void {
        // Ground doesn't need to update
    }
} 