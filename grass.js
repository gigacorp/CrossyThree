import * as THREE from './node_modules/three/build/three.module.min.js';
import { MAP_WIDTH, MAP_HEIGHT } from './constants.js';

export function createGrass() {
    const stripeWidth = 100; // Width of each stripe
    const numStripes = Math.ceil(MAP_HEIGHT / stripeWidth); // Calculate number of stripes to fill map height
    const grassGroup = new THREE.Group();
    
    // Create alternating stripes
    for (let i = -numStripes/2; i < numStripes/2; i++) {
        const stripeGeometry = new THREE.PlaneGeometry(MAP_WIDTH, stripeWidth);
        const stripeMaterial = new THREE.MeshLambertMaterial({ 
            color: i % 2 === 0 ? 0x3a8c3a : 0x4a9c4a, // Alternating shades of green
            side: THREE.DoubleSide
        });
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        stripe.position.y = 0;
        // Center the stripes by offsetting by half a stripe width
        stripe.position.z = (i * stripeWidth) + (stripeWidth / 2);
        stripe.receiveShadow = true;
        grassGroup.add(stripe);
    }
    
    return grassGroup;
} 