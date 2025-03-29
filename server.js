const express = require('express');
const { createServer } = require('http');
const { Server, Room } = require('colyseus');
const { monitor } = require('@colyseus/monitor');
const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');
const path = require('path');
const { MAP_HALF_HEIGHT, BLOCK_SIZE } = require('./constants.js');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the dist directory first (for bundle.js)
app.use(express.static(path.join(__dirname, 'dist')));

// Then serve static files from the root directory (for index.html)
app.use(express.static(__dirname));

// Define the Player schema
class Player extends Schema {
    constructor() {
        super();
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.rotation = 0;
    }
}
defineTypes(Player, {
    x: "number",
    y: "number",
    z: "number",
    rotation: "number"
});

// Define the GameState schema
class GameState extends Schema {
    constructor() {
        super();
        this.players = new MapSchema();
        this.playerCount = 0;
    }
}
defineTypes(GameState, {
    players: { map: Player },
    playerCount: "number"
});

class GameRoom extends Room {
    onCreate(options) {
        this.setState(new GameState());

        this.onMessage('move', (client, message) => {
            const playerId = client.sessionId;
            const playerState = this.state.players.get(playerId);

            if (!playerState) return;

            // Update position if targetPos is provided
            if (message.targetPos) {
                playerState.x = message.targetPos.x;
                playerState.z = message.targetPos.z;
                // Y position (jumping) is handled client-side for animation
            }

            // Update rotation based on movement direction if movement is provided
            if (message.movement && (message.movement.x !== 0 || message.movement.z !== 0)) {
                // Calculate rotation based on the direction vector
                // atan2(x, z) gives angle relative to positive Z axis (clockwise)
                playerState.rotation = Math.atan2(message.movement.x, message.movement.z);
            }

            // Broadcast the move command to other clients for animation interpolation
            this.broadcast('playerMoveCommand', {
                playerId,
                movement: message.movement, // Original movement vector
                startPos: message.startPos, // Where the client started the move
                targetPos: message.targetPos // Where the player should end up
            }, { except: client }); // Don't send back to the sender
        });
    }

    onJoin(client, options) {
        const playerId = client.sessionId;
        const player = new Player();
        
        // Set initial spawn position to match game.js
        player.x = 0;
        player.y = 0;
        player.z = MAP_HALF_HEIGHT-BLOCK_SIZE/2;

        player.rotation = 0;
        this.state.players.set(playerId, player);
        this.state.playerCount++;
        client.send('playerId', playerId);
    }

    onLeave(client) {
        const playerId = client.sessionId;
        this.state.players.delete(playerId);
        this.state.playerCount--;
        this.broadcast('playerLeft', playerId);
    }
}

const gameServer = new Server({
    server: createServer(app),
    express: app
});

// Register your room handlers
gameServer.define('game_room', GameRoom);

// Register colyseus monitor AFTER registering your room handlers
app.use('/colyseus', monitor());

gameServer.listen(port).then(() => {
    console.log(`Listening on http://localhost:${port}`);
}); 