const express = require('express');
const { createServer } = require('http');
const { Server, Room } = require('colyseus');
const { monitor } = require('@colyseus/monitor');
const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the current directory
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
            // Broadcast the move command to all other clients with positions
            this.broadcast('playerMoveCommand', {
                playerId,
                movement: message.movement,
                startPos: message.startPos,
                targetPos: message.targetPos
            });
        });
    }

    onJoin(client, options) {
        const playerId = client.sessionId;
        const player = new Player();
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