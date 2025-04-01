import express from 'express';
import { createServer } from 'http';
import { Server, Room, Client } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAP_HALF_HEIGHT, BLOCK_SIZE } from './constants.js';
import { Player, GameState, MoveMessage, PlayerMoveCommand } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname is available directly in CommonJS modules
// When running node dist/server.js, __dirname is /path/to/project/dist

// --- DEBUG: Log __dirname ---
// console.log('>>> Server process starting. __dirname:', __dirname);
// --- END DEBUG ---

const app = express();
const port = parseInt(process.env.PORT || '3000', 10); // Parse port to number

// --- DEBUG: Log all requests ---
// app.use((req, res, next) => {
//   console.log(`>>> Incoming Request: ${req.method} ${req.originalUrl}`);
//   next(); // Pass control to the next middleware
// });
// --- END DEBUG ---

// --- Static Files Configuration --- 

// 1. Serve files from the 'dist' directory specifically for requests starting with '/dist'
// Put this FIRST to ensure it handles /dist/bundle.js
app.use('/dist', express.static(__dirname)); // __dirname is the actual 'dist' folder

// 2. Serve files from the root directory (e.g., index.html) AFTER checking /dist
// path.join goes up one level from dist to the project root
app.use(express.static(path.join(__dirname, '..')));

// --- End Static Files Configuration ---

// Colyseus Monitor
app.use('/colyseus', monitor());

class GameRoom extends Room<GameState> {
    onCreate(options: Record<string, unknown>) {
        this.setState(new GameState());

        this.onMessage('move', (client, message: MoveMessage) => {
            const playerId = client.sessionId;
            const playerState = this.state.players.get(playerId);

            if (playerState) {
                // Update position - targetPos is now guaranteed
                playerState.x = message.targetPos.x;
                playerState.z = message.targetPos.z;
                
                // Update rotation - movement is now guaranteed
                // (Check for non-zero movement still makes sense to avoid atan2(0,0))
                if (message.movement.x !== 0 || message.movement.z !== 0) {
                    playerState.rotation = Math.atan2(message.movement.x, message.movement.z);
                }
            }

            // Broadcast the move command to other clients for animation interpolation
            const commandPayload: PlayerMoveCommand = {
                playerId,
                movement: message.movement, 
                startPos: message.startPos, 
                targetPos: message.targetPos 
            };
            this.broadcast('playerMoveCommand', commandPayload, { except: client });
        });
    }

    onJoin(client: Client, options: any) {
        const playerId = client.sessionId;
        const player = new Player();
        // Set initial Z position
        player.z = MAP_HALF_HEIGHT - BLOCK_SIZE / 2;
        this.state.players.set(playerId, player);
        this.state.playerCount++;
        client.send('playerId', playerId);
    }

    onLeave(client: Client, consented: boolean) {
        const playerId = client.sessionId;
        if (this.state.players.has(playerId)) {
            this.state.players.delete(playerId);
            this.state.playerCount--;
            this.broadcast('playerLeft', playerId, { except: client });
        }
    }

    onDispose() {
        // console.log('Room', this.roomId, 'disposing...');
    }
}

const gameServer = new Server({
    server: createServer(app),
});

// Register your room handlers
gameServer.define('game_room', GameRoom);

gameServer.listen(port).then(() => {
    console.log(`Listening on http://localhost:${port}`);
}); 