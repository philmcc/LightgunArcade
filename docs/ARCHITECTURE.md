# Lightgun Arcade - Architecture Overview

**Last Updated**: 2025-11-28

This document provides a high-level overview of the codebase architecture for LLM coding assistants and developers.

---

## Directory Structure

```
src/
├── arcade/                    # Core platform code
│   ├── core/                  # System-level managers
│   │   ├── ArcadeSystem.js    # Main orchestrator - starts here
│   │   ├── GameRegistry.js    # Registers games, validates manifests
│   │   ├── GunManager.js      # Multi-gun device management
│   │   ├── GunCursorManager.js # Virtual cursor rendering
│   │   ├── GunCalibration.js  # Gun calibration wizard
│   │   ├── HIDDeviceManager.js # WebHID API for Gun4IR devices
│   │   ├── Gun.js             # Individual gun state/config
│   │   └── PlayerManager.js   # Multiplayer player state
│   │
│   ├── interfaces/
│   │   └── BaseGame.js        # Abstract base class for all games
│   │
│   ├── sdk/                   # SDK components for game developers
│   │   ├── index.js           # Central exports
│   │   ├── UIComponents.js    # MenuBuilder, HUDBuilder, OverlayBuilder
│   │   ├── SettingsScreen.js  # Centralized settings UI
│   │   ├── PlayerSelectScreen.js # Multiplayer player selection
│   │   ├── GameStateMachine.js # State management helper
│   │   └── AssetLoader.js     # Asset loading/caching
│   │
│   ├── services/
│   │   ├── GameHighScores.js  # Per-game score storage
│   │   └── AuthService.js     # User authentication (stub)
│   │
│   ├── ui/
│   │   └── GunSetupMenu.js    # Gun configuration UI
│   │
│   └── GlobalHighScores.js    # Cross-game leaderboard
│
├── games/                     # Individual games
│   ├── not-duck-hunt/         # Duck Hunt clone
│   │   ├── NotDuckHuntGame.js # Main game class (extends BaseGame)
│   │   ├── RoundManager.js    # Round/target logic
│   │   ├── BackgroundManager.js
│   │   └── targets/           # Target classes (Duck, Pheasant, etc.)
│   │
│   └── point-gun/             # Point Blank clone
│       ├── PointGunGame.js    # Main game class (extends BaseGame)
│       ├── LevelManager.js    # Stage progression
│       └── minigames/         # Individual minigame classes
│
├── shared/                    # Shared utilities
│   ├── InputManager.js        # Mouse/touch/gun input routing
│   ├── SoundManager.js        # Audio playback
│   └── Settings.js            # User preferences (fullscreen, Sinden)
│
├── platform/
│   ├── detect.js              # Platform detection
│   └── storage.js             # localStorage wrapper
│
├── main.js                    # Entry point
└── style.css                  # Global styles
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ArcadeSystem                              │
│  - Manages game lifecycle                                        │
│  - Owns: Settings, SoundManager, GunManager, GameRegistry       │
│  - Shows arcade menu, launches games                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BaseGame                                 │
│  - Abstract class all games extend                              │
│  - Provides: input, sound, highScores, settings, ui, players    │
│  - Handles: init, update, draw lifecycle                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Game Implementation                           │
│  (NotDuckHuntGame, PointGunGame, etc.)                          │
│  - Implements game-specific logic                               │
│  - Uses SDK components for UI                                   │
│  - Defines manifest with multiplayer config                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Input Flow

```
Physical Device (Gun/Mouse)
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  HIDDeviceManager│     │  Browser Events  │
│  (WebHID API)   │     │  (PointerEvents) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │   GunManager    │
            │ - Routes input  │
            │ - Calibration   │
            │ - Button mapping│
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ GunCursorManager│     │  InputManager   │
│ - Virtual cursor│     │ - Game input    │
│ - UI clicks     │     │ - Shoot events  │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │     Game        │
                        │ handleShoot()   │
                        │ { x, y, gunIndex}│
                        └─────────────────┘
```

---

## Key Classes

### ArcadeSystem (`src/arcade/core/ArcadeSystem.js`)
The main platform orchestrator. Entry point for the application.

**Responsibilities:**
- Initialize all core services
- Show arcade menu with game list
- Launch and manage game instances
- Handle system-level settings
- Coordinate gun setup

**Key Methods:**
- `launchGame(gameId)` - Start a game
- `returnToArcade()` - Exit current game
- `showSettings()` - Show system settings
- `showGunSetup()` - Show gun configuration

---

### BaseGame (`src/arcade/interfaces/BaseGame.js`)
Abstract base class that all games must extend.

**Provides to games:**
- `this.canvas`, `this.ctx` - Rendering
- `this.input` - InputManager instance
- `this.sound` - SoundManager instance
- `this.highScores` - GameHighScores instance
- `this.settings` - Settings reference
- `this.ui` - UI component builders
- `this.players` - PlayerManager instance

**Lifecycle Methods (implement in your game):**
- `init()` - Called once when game starts
- `update(dt)` - Called every frame
- `draw(ctx)` - Render the game
- `destroy()` - Cleanup (optional)

**Event Hooks (override as needed):**
- `onKeyDown(event)`, `onKeyUp(event)`
- `onStartButton(gunIndex)`
- `onPause()`, `onResume()`
- `onResize(width, height)`

---

### GunManager (`src/arcade/core/GunManager.js`)
Manages multiple lightgun devices.

**Features:**
- WebHID support for Gun4IR devices
- Pointer event fallback for mice
- Per-gun calibration
- Button mapping (trigger, reload, start)
- Virtual cursor management

**Key Methods:**
- `requestHIDDevices()` - Open device picker
- `startCalibration(gunIndex, onComplete, onCancel)`
- `setInGame(inGame)` - Control cursor visibility
- `on('startButton', callback)` - Listen for start button

---

### PlayerManager (`src/arcade/core/PlayerManager.js`)
Manages multiplayer sessions.

**Features:**
- 1-4 player support
- Per-player state (score, lives, hits, accuracy)
- Game modes: single, coop, versus
- Player colors for visual identification

**Key Methods:**
- `initSession(playerCount, options)`
- `resetGame(lives)`
- `recordHit(playerIndex, points)`
- `recordMiss(playerIndex)`
- `getFinalResults()` - Sorted by score
- `getTeamStats()` - Combined stats for coop

---

### InputManager (`src/shared/InputManager.js`)
Routes input events to games.

**Events:**
- `shoot` - `{ x, y, gunIndex, source }`

**Usage:**
```javascript
this.input.on("shoot", ({ x, y, gunIndex }) => {
    // Handle shot
});
```

---

## SDK Components

### UIComponents (`src/arcade/sdk/UIComponents.js`)

| Class | Purpose |
|-------|---------|
| `MenuBuilder` | Create menu screens with buttons |
| `HUDBuilder` | In-game HUD (score, lives, ammo) |
| `OverlayBuilder` | Pause menu, intros, results, game over |
| `HighScoreDisplay` | High score tables |

### Other SDK Files

| File | Purpose |
|------|---------|
| `SettingsScreen.js` | Centralized settings UI |
| `PlayerSelectScreen.js` | Multiplayer player/mode selection |
| `GameStateMachine.js` | State management helper |
| `AssetLoader.js` | Load and cache images/audio/JSON |

---

## Game Manifest

Every game must implement `static getManifest()`:

```javascript
static getManifest() {
    return {
        id: 'game-id',           // Unique, used for storage keys
        name: 'Display Name',
        version: '1.0.0',
        description: 'Game description',
        isAvailable: true,
        
        multiplayer: {
            minPlayers: 1,
            maxPlayers: 2,
            supportedModes: [
                { id: 'coop', name: 'Co-op', type: 'cooperative', simultaneous: true }
            ]
        }
    };
}
```

The `GameRegistry` validates manifests and applies defaults for missing fields.

---

## Adding a New Game

1. Create folder: `src/games/my-game/`
2. Create main file: `MyGame.js` extending `BaseGame`
3. Implement `getManifest()`, `init()`, `update()`, `draw()`
4. Register in `src/main.js`:
   ```javascript
   import { Game as MyGame } from './games/my-game/MyGame.js';
   system.registry.register(MyGame);
   ```

---

## CSS Classes

Key CSS classes for UI components:

| Class | Used For |
|-------|----------|
| `.screen` | Full-screen overlay container |
| `.diff-btn` | Difficulty/mode selection buttons |
| `.toggle-btn` | On/off toggle buttons |
| `.setting-row` | Settings label + control row |
| `.btn-primary` | Primary action button |
| `.player-slot` | Player selection card |
| `.player-hud-section` | Multiplayer HUD section |
| `.result-row` | Results screen player row |

---

## Common Patterns

### Showing Settings from Pause Menu

```javascript
_showSettingsScreen() {
    this.showSettings({
        onBack: () => {
            if (this.state === "PAUSED_SETTINGS") {
                this.state = "PAUSED";
                this.uiLayer.innerHTML = '';  // Clear first!
                this.showHUD();
                this.showPauseMenu();
            } else {
                this.showMenu();
            }
        }
    });
}
```

### Multiplayer-Aware HUD

```javascript
showHUD() {
    if (this.isMultiplayer()) {
        this.showMultiplayerHUD({ round: `ROUND ${this.round}` });
    } else {
        this.ui.hud.create({ score: this.score, lives: this.lives });
    }
}
```

### Multiplayer-Aware Game Over

```javascript
handleGameOver(cleared) {
    if (this.isMultiplayer()) {
        this.showMultiplayerResults({
            cleared,
            onRetry: () => { this.players.resetGame(3); this.startGame(); },
            onMenu: () => this.showMenu()
        });
    } else {
        // Single player high score flow
    }
}
```
