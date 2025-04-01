# Minigames

Info
- An orthogonal camera following the player is set up
- The player is around 1 to 2 BLOCK_SIZEs in width and height
- Ground already exists
- The game scene is progressing from start to end

Rules
- Don't touch camera
- Don't do additional input handling

Constants:
- MAP_WIDTH
- MAP_HEIGHT
- MAP_HALF_WIDTH
- MAP_HALF_HEIGHT
- BLOCK_SIZE

Workspace:
- scene
- localPlayer
- otherPlayers

Minigame interface
- instructions: string
- onPlayerDidSpawn(:player)
- onPlayerDidMove(:player)
- onPlayersDidTouch(:player1, player2)
- load(:scene)
- start(:workspace)
- update(:delta, :workspace)