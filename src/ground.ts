import * as THREE from 'three';
import { MAP_WIDTH, BLOCK_SIZE } from './constants';
import { Toolbox } from './toolbox/Toolbox';
import { MinigameObjectState, Vector3State, RowData } from './schema';

export class Ground {
    mesh: THREE.Group;
    height: number;
    rows: RowData[];
    toolbox: Toolbox;

    constructor(rows: RowData[] = []) {
        this.rows = rows;
        this.toolbox = new Toolbox();
        this.mesh = this.createGroundMesh();
        this.height = rows.length * BLOCK_SIZE;
    }

    private createGroundMesh(): THREE.Group {
        const rowWidth = BLOCK_SIZE; // Width of each row
        const groundGroup = new THREE.Group();

        console.log("Creating ground with", this.rows.length, "rows");
        
        // Create alternating rows starting from origin and going forward
        for (let i = 0; i < this.rows.length; i++) {
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

            // If we have row data for this position, we can use it here
            const rowData = this.rows[i];
            if (rowData && rowData.text) {
                // Create text object for this row
                const textState = new MinigameObjectState();
                textState.type = 'Text';
                textState.position = new Vector3State();
                textState.position.x = 0;
                textState.position.y = 0.1;
                textState.position.z = -i * rowWidth;
                textState.visible = true;
                textState.text = rowData.text;
                textState.color = '#FFFFFF';

                const textObject = this.toolbox.createObject(`row_text_${i}`, textState);
                if (textObject) {
                    groundGroup.add(textObject.mesh);
                }
            }
        }
        
        return groundGroup;
    }

    update(delta: number): void {
        // Ground doesn't need to update
    }
} 