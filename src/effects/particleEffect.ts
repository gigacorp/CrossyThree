import * as THREE from 'three';

// Interface for managing particle effects
export interface ParticleEffect {
    points: THREE.Points;
    velocities: THREE.Vector3[];
    lifespan: number; // Total time in seconds
    elapsed: number;  // Time elapsed
    initialOpacity: number;
    update: () => void; // Function to update particle positions/opacity
}

// Helper function to create a particle effect (e.g., for coin collection)
export function createParticleEffect(
    scene: THREE.Scene, 
    position: THREE.Vector3, 
    color: number | string | THREE.Color,
    particleCount: number,
    lifespan: number,
    velocityScale: number = 50, // Default velocity scale
    size: number = 5
): ParticleEffect {
    
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = position.x;
        positions[i3 + 1] = position.y;
        positions[i3 + 2] = position.z;

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * velocityScale,
            (Math.random() - 0.5) * velocityScale + (velocityScale * 0.3), // Add slight upward bias
            (Math.random() - 0.5) * velocityScale
        );
        velocities.push(velocity);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: color,
        size: size,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true, // Particles shrink with distance
        depthWrite: false
    });

    const points = new THREE.Points(particles, material);
    scene.add(points); // Add points to the scene immediately

    const effect: ParticleEffect = {
        points,
        velocities,
        lifespan,
        elapsed: 0,
        initialOpacity: material.opacity,
        update: () => { // Define the update logic within the effect object
            const delta = 1/60; // Approximate delta time, consider passing actual delta
            const positions = effect.points.geometry.getAttribute('position') as THREE.BufferAttribute;
            const progress = effect.elapsed / effect.lifespan;
            (effect.points.material as THREE.PointsMaterial).opacity = effect.initialOpacity * (1 - progress);

            for (let i = 0; i < effect.velocities.length; i++) {
                const i3 = i * 3;
                positions.setX(i3, positions.getX(i3) + effect.velocities[i].x * delta);
                positions.setY(i3 + 1, positions.getY(i3 + 1) + effect.velocities[i].y * delta);
                positions.setZ(i3 + 2, positions.getZ(i3 + 2) + effect.velocities[i].z * delta);
            }
            positions.needsUpdate = true;
        }
    };

    return effect;
} 