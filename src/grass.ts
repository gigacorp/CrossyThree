import * as THREE from 'three';
import { MAP_WIDTH, MAP_HEIGHT, BLOCK_SIZE } from './constants';

export function createGrass() {
    const stripeWidth = BLOCK_SIZE; // Width of each stripe
    const numStripes = Math.ceil(MAP_HEIGHT / stripeWidth); // Calculate number of stripes to fill map height
    const grassGroup = new THREE.Group();
    
    // Create alternating stripes starting from origin and going forward
    for (let i = 0; i < numStripes; i++) {
        const stripeGeometry = new THREE.PlaneGeometry(MAP_WIDTH, stripeWidth);
        const stripeMaterial = new THREE.MeshLambertMaterial({ 
            color: i % 2 === 0 ? 0x3a8c3a : 0x4a9c4a, // Alternating shades of green
            side: THREE.DoubleSide
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.rotation.x = -Math.PI / 2; // Rotate to be horizontal

        // Position stripes starting from origin and going forward (negative Z)
        stripe.position.z = -i * stripeWidth;
        stripe.receiveShadow = true;
        grassGroup.add(stripe);
    }
    
    return grassGroup;
} 