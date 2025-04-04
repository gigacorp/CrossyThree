interface Game {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    instructions: string;
}

const games: Game[] = [
    {
        id: 'test_course_1',
        title: 'Test Course Alpha',
        description: 'A simple test course with a collectable and a hazard.',
        thumbnail: '🚧',
        instructions: 'Get to the other side! Collect the coin, avoid the lava.'
    }
    // Add more games here if you create more JSON files
];

function createGameCard(game: Game): HTMLElement {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
        <div class="game-thumbnail">${game.thumbnail}</div>
        <div class="game-info">
            <h2 class="game-title">${game.title}</h2>
            <p class="game-description">${game.description}</p>
        </div>
    `;
    
    card.addEventListener('click', () => showGameDetails(game));
    return card;
}

function showGameDetails(game: Game): void {
    const modal = document.getElementById('gameModal');
    const details = document.getElementById('gameDetails');
    
    if (!modal || !details) return;
    
    details.innerHTML = `
        <h2>${game.title}</h2>
        <div class="game-details">
            <p>${game.description}</p>
            <p><strong>Instructions:</strong> ${game.instructions}</p>
            <a href="game.html" class="play-button">Play Now</a>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeModal(): void {
    const modal = document.getElementById('gameModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    const gamesGrid = document.getElementById('gamesGrid');
    if (!gamesGrid) return;
    
    // Add all games to the grid
    games.forEach(game => {
        gamesGrid.appendChild(createGameCard(game));
    });
    
    // Add close button functionality
    const closeButton = document.getElementById('closeModal');
    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('gameModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}); 