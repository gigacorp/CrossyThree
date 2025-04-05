# Minigames

## Concept

Minigames are self-contained game modes within the main experience.

For minigames using the data-driven structure below (e.g., `ReachTheEnd` type), the objective is generally to navigate from a standardized **Start Zone** (typically at the "bottom" or maximum Z extent of the playable area) to a standardized **Finish Zone** (typically at the "top" or minimum Z extent). The path between these zones contains various interactive elements defined by **Objects**.

## Data-Driven Structure (Based on User Ideas)

To enhance security and simplify server logic, minigames are defined using a declarative JSON structure. The server interprets this structure and manages the authoritative state based on player interactions with defined objects. The Start and Finish zones are predefined based on the minigame type and are not specified within this JSON.

### Core JSON Schema

```json
{
  "minigameId": "unique-game-identifier",
  "displayName": "Minigame Name",
  "description": "Instructions for the player.",
  // Start Zone and Finish Zone are now implicitly defined by the game engine
  // for this type of minigame. For example, Start might always be a region
  // around z = MAX_MAP_DEPTH/2 and Finish around z = -MAX_MAP_DEPTH/2.
  "objects": [
    // Array defining all distinct objects in the minigame world
    // Example: A collectible coin tile
    {
      "id": "coin_1", // Unique identifier for this object
      "type": "Tile", // Specifies the object category
      "position": { "x": 5, "y": 0, "z": 10 }, // World coordinates
      "visible": true, // Initial visibility state
      "tileType": "Coin", // Visual/functional type for the client (e.g., "Coin", "Lava", "Grass", "Water", "Button")
      "action": { // Action triggered upon interaction (e.g., player enters tile)
        "type": "Collect",
        "score": 10 // Optional: Score awarded
      }
    },
    // Example: A lava tile that destroys the player
    {
      "id": "lava_patch_1",
      "type": "Tile",
      "position": { "x": -2, "y": -0.5, "z": 20 }, // Slightly lower?
      "visible": true,
      "tileType": "Lava",
      "action": {
        "type": "DestroyTouchingPlayer",
        "respawn": "StartZone" // Options: "StartZone", "Checkpoint" - Refers to the predefined zones now
      }
    },
    // Example: A button that toggles a bridge
    {
      "id": "bridge_toggle_button",
      "type": "Tile",
      "position": { "x": 0, "y": 0, "z": 5 },
      "visible": true,
      "tileType": "Button",
      "action": {
        "type": "ToggleVisibility",
        "targetId": "bridge_section_1", // ID of the object to toggle
        "setVisible": null // Optional: Explicitly set true/false, null means toggle
      }
    },
    // Example: The bridge section itself
    {
      "id": "bridge_section_1",
      "type": "Tile", // Or maybe "Platform"
      "position": { "x": 0, "y": 0, "z": 0 },
      "size": {"width": 2, "height": 0.2, "depth": 5}, // Tiles might need dimensions
      "visible": false, // Starts invisible/retracted
      "tileType": "Bridge",
      "action": { // Bridge itself might have no action or be walkable
          "type": "None"
      }
    },
    // Example: Display text with color
    {
        "id": "welcome_text",
        "type": "Text",
        "position": { "x": 0, "y": 2, "z": 40 }, // Near the typical start area
        "visible": true,
        "text": "Reach the end!",
        "color": "#FFFF00" // Optional: Text color (e.g., hex code)
    },
    // Example: A tile within the implicit finish zone to trigger completion
    {
        "id": "finish_trigger_tile",
        "type": "Tile",
        "position": { "x": 0, "y": 0, "z": -45 }, // Needs to be within the predefined finishZone bounds
        "visible": false, // Usually invisible
        "tileType": "None", // No specific visual type needed usually
        "action": {
            "type": "FinishTrigger"
            // Add conditions? "requiredCollectibles": 5
        }
    }
    // ... more objects
  ]
}
```

### Object Types

*   **`Object`** (Base concept):
    *   `id`: Unique string identifier.
    *   `type`: String defining the category (e.g., "Tile", "Text", "Platform").
    *   `position`: `{x, y, z}` world coordinates.
    *   `visible`: Boolean, current visibility state (managed by server).
*   **`Tile`** (Extends Object):
    *   `tileType`: String hint for client rendering and potentially server logic. Examples: `"Lava"`, `"Coin"`, `"Button"`.
    *   `action`: Defines the interaction when a player enters this tile's space.
    *   *(Optional)* `size`: `{width, height, depth}` if the tile isn't a standard 1x1x1 block.
*   **`Text`** (Extends Object):
    *   `text`: The string to display.
    *   `color`: (Optional) String representing the text color (e.g., "#FF0000", "red"). Defaults to a standard color (e.g., white or black) if omitted.

### Action Types (`action.type`)

These define the server-side logic executed on interaction. The parameters are specified within the `action` object alongside the `type`.

*   **`None`**: No action occurs. Default if `action` is omitted.
*   **`Collect`**: Marks the object as collected (e.g., sets `visible` to `false`), potentially awards score.
    *   *Parameters*: `score` (Optional number).
*   **`DestroyTouchingPlayer`**: Triggers a player "death" or reset.
    *   *Parameters*: `respawn` (Optional string: "StartZone", "LastCheckpoint"). Defaults to "StartZone".
*   **`ToggleVisibility`**: Changes the `visible` state of another object.
    *   *Parameters*: `targetId` (Required string), `setVisible` (Optional boolean: `true`, `false`, or `null` to toggle).
*   **`FinishTrigger`**: When a player interacts with this object *and* is within the predefined `finishZone`, the server checks win conditions and marks the player as finished.
    *   *Parameters*: `requiredCollectibles` (Optional number).
*   *(Potential Additions based on previous discussion)*
    *   **`ApplyEffect`**: (`effect`: string, `duration`: number)
    *   **`Teleport`**: (`targetPosition`: {x,y,z})
    *   **`Checkpoint`**: (No parameters needed, sets respawn for current player)

### Server Responsibilities

1.  Load and validate the minigame JSON.
2.  Instantiate the game state based on the `objects` array (tracking positions, initial visibility, etc.).
3.  Spawn players within the **predefined** `startZone`.
4.  Track authoritative player positions.
5.  Detect player interactions with object bounding boxes (especially `Tile` types).
6.  Execute the server-side logic associated with the object's `action.type`, potentially modifying game state (player score, object visibility, player position). Check for `FinishTrigger` actions specifically when a player is within the **predefined** `finishZone`.
7.  Synchronize relevant state changes (object visibility, player score, etc.) via Colyseus.

### Client Responsibilities

1.  Receive the initial object list (or relevant parts via state) and subsequent state updates.
2.  Render objects based on their `type`, `position`, `visible` state, `tileType` (for Tiles), and `color` (for Text). Understand the **predefined** start and finish zone locations for context.
3.  Send player input to the server.
4.  Play effects/animations based on state changes (e.g., coin disappearing, player respawning).

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
- start(:workspace)
- update(:delta, :workspace)

## Minigame format

## Minigame
- objects

### Object
- id
- position
- visible

### Tile: Object
- tileType
- action

### Text: Object
- text
- color

### Style:
- Lava
- Water
- Grass 

### Action:
- None
- Collect
- DestroyTouchingPlayer
- ToggleVisiblity(id:, :visible)