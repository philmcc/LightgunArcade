# Lightgun Arcade SDK Reference

**Version**: 1.1  
**Last Updated**: 2025-11-28  
**Status**: Implementation Guide

This document describes the SDK components available for game development. All games extend `BaseGame` and have access to these features automatically.

---

## Quick Start: Creating a New Game

```javascript
import { BaseGame } from '../../arcade/interfaces/BaseGame.js';

export class Game extends BaseGame {
    constructor(canvas, uiLayer, system) {
        super(canvas, uiLayer, system);
        
        // Bind input handler
        this.input.on("shoot", (coords) => this.handleShoot(coords));
    }

    static getManifest() {
        return {
            id: 'my-game',
            name: 'My Game',
            version: '1.0.0',
            description: 'A lightgun game',
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

    async init() {
        this.enableKeyboardEvents();
        this.enableStartButton();
        this.showMenu();
    }

    update(dt) { /* Called every frame */ }
    draw(ctx) { /* Render game */ }
    
    handleShoot({ x, y, gunIndex }) {
        const playerIndex = this.getPlayerIndexFromGun(gunIndex);
        // Handle shot at (x, y) from player
    }
}
```

---

## File Structure

```
src/arcade/
├── core/
│   ├── ArcadeSystem.js      # Main platform orchestrator
│   ├── GameRegistry.js      # Game registration & manifest validation
│   ├── GunManager.js        # Multi-gun device management
│   ├── PlayerManager.js     # Multiplayer player state
│   └── ...
├── interfaces/
│   └── BaseGame.js          # Base class all games extend
├── sdk/
│   ├── index.js             # SDK exports (import from here)
│   ├── UIComponents.js      # MenuBuilder, HUDBuilder, OverlayBuilder
│   ├── GameStateMachine.js  # State management helper
│   ├── SettingsScreen.js    # Centralized settings UI
│   ├── AssetLoader.js       # Asset loading/caching
│   └── PlayerSelectScreen.js # Multiplayer player selection
└── services/
    └── GameHighScores.js    # Per-game high score storage
```

---

## BaseGame - What You Get Automatically

When your game extends `BaseGame`, you have access to:

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `this.canvas` | HTMLCanvasElement | Game canvas |
| `this.ctx` | CanvasRenderingContext2D | 2D drawing context |
| `this.uiLayer` | HTMLElement | DOM element for UI overlays |
| `this.input` | InputManager | Handles mouse/touch/gun input |
| `this.sound` | SoundManager | Audio playback |
| `this.highScores` | GameHighScores | Per-game score storage |
| `this.settings` | Settings | User settings (fullscreen, Sinden, etc.) |
| `this.ui` | Object | UI component builders (see below) |
| `this.assets` | AssetLoader | Load images, audio, JSON |
| `this.players` | PlayerManager | Multiplayer player management |

### Single Player Gun Management

When multiple guns are connected, you can lock input to a specific gun for single-player modes:

```javascript
// Lock to the gun that started the game
const activeGun = this.getLastTriggerGunIndex();
this.setSinglePlayerGun(activeGun >= 0 ? activeGun : -1);

// Check if gun input should be processed
if (!this.isGunInputAllowed(gunIndex)) {
    return; // Wrong gun, ignore
}

// Get active gun index
const activeGun = this.getActiveGunIndex(); // null = all guns, number = specific gun

// Reset to allow all guns (for multiplayer or menu)
this.setSinglePlayerGun(null);
```

The SDK automatically hides inactive gun cursors during gameplay and shows all cursors in menus.

### UI Components (`this.ui`)

```javascript
this.ui.menu      // MenuBuilder - create menu screens
this.ui.hud       // HUDBuilder - in-game HUD
this.ui.overlay   // OverlayBuilder - pause, results, etc.
this.ui.highScores // HighScoreDisplay - score tables
```

---

## UI Components Reference

### MenuBuilder

```javascript
// Create a menu screen
this.ui.menu.create({
    title: 'GAME TITLE',
    buttons: [
        { id: 'play', text: 'PLAY', primary: true, onClick: () => this.startGame() },
        { id: 'settings', text: 'SETTINGS', onClick: () => this.showSettings() }
    ]
});

// Clear the menu
this.ui.menu.clear();
```

### HUDBuilder

```javascript
// Single player HUD
this.ui.hud.create({
    score: 0,
    lives: 3,
    round: 'ROUND 1',
    ammo: 3  // optional
});

// Update values
this.ui.hud.update('score', 1500);
this.ui.hud.updateAmmo(2);

// Multiplayer HUD
this.ui.hud.createMultiplayer(this.players.players, {
    round: 'ROUND 1',
    ammo: 3
});
this.ui.hud.updatePlayerScore(0, 1500);  // Player 0
this.ui.hud.updatePlayerLives(1, 2);     // Player 1

// Clear HUD
this.ui.hud.clear();
```

### OverlayBuilder

```javascript
// Pause menu
this.ui.overlay.showPauseMenu({
    onResume: () => this.togglePause(),
    onSettings: () => this.showSettings(),
    onQuitMenu: () => this.showMenu(),
    onQuitArcade: () => this.returnToArcade()
});
this.ui.overlay.hidePauseMenu();

// Round intro
this.ui.overlay.showIntro({
    title: 'ROUND 1',
    subtitle: 'GET READY',
    info: 'LIVES: 3',
    duration: 2000,
    borderColor: '#ffd700',  // optional
    onComplete: () => this.startRound()
});

// Round result
this.ui.overlay.showResult({
    success: true,  // or false
    stats: [
        { label: 'HITS:', value: '8 / 10' },
        { label: 'BONUS:', value: '+500' }
    ],
    autoAdvance: 2000,
    onNext: () => this.nextRound()
});

// Game over
this.ui.overlay.showGameOver({
    cleared: false,  // true for victory
    score: 15000,
    onRetry: () => this.startGame(),
    onMenu: () => this.showMenu()
});

// Name entry for high score
this.ui.overlay.showNameEntry({
    score: 15000,
    defaultName: this.getCurrentUser().name,
    onSubmit: (name) => {
        this.highScores.addScore(name, 15000, 'normal');
        this.showGameOverScreen();
    }
});

// Multiplayer results
this.ui.overlay.showMultiplayerResults({
    players: this.players.getFinalResults(),
    mode: 'coop',  // or 'versus'
    cleared: true,
    teamStats: this.players.getTeamStats(),  // for coop
    onRetry: () => this.startGame(),
    onMenu: () => this.showMenu()
});
```

### HighScoreDisplay

```javascript
this.ui.highScores.show({
    scores: this.highScores.getScores(),
    title: 'HIGH SCORES',
    onBack: () => this.showMenu(),
    badges: [
        { field: 'difficulty', format: (v) => v.charAt(0).toUpperCase() },
        { field: 'gameMode', format: (v) => v === 'campaign' ? 'C' : 'E', color: '#00ccff' }
    ]
});
```

---

## Settings Screen

Use the SDK's centralized settings screen instead of building your own:

```javascript
// In your game
this.showSettings({
    onBack: () => {
        if (this.state === 'PAUSED_SETTINGS') {
            this.state = 'PAUSED';
            this.uiLayer.innerHTML = '';
            this.showHUD();
            this.showPauseMenu();
        } else {
            this.showMenu();
        }
    }
});
```

The settings screen handles:
- Fullscreen toggle
- Sinden border toggle + thickness/color
- Gun setup button

---

## Multiplayer Support

### Showing Player Select Screen

```javascript
showPlayerSelectMenu(multiplayerMode = 'coop') {
    this.showPlayerSelect({
        minPlayers: 2,      // Force minimum 2 players for 2-player modes
        defaultPlayers: 2,  // Default selection
        onStart: (playerCount, mode, gunAssignments) => {
            this.players.initSession(playerCount, { 
                mode: multiplayerMode === 'coop' ? 'coop' : 'versus',
                simultaneous: true,
                gunAssignments 
            });
            this.players.resetGame(3);  // 3 lives each
            this.startGame();
        },
        onBack: () => this.showMenu()
    });
}
```

### Checking Multiplayer State

```javascript
if (this.isMultiplayer()) {
    // Show multiplayer HUD
    this.showMultiplayerHUD({ round: 'ROUND 1' });
} else {
    // Show single player HUD
    this.ui.hud.create({ score: 0, lives: 3 });
}
```

### Routing Input to Players

```javascript
handleShoot({ x, y, gunIndex }) {
    // In single player, filter by active gun
    if (!this.isGunInputAllowed(gunIndex)) {
        return; // Wrong gun for single player
    }
    
    // gunIndex is -1 for mouse, 0-3 for guns
    const playerIndex = this.getPlayerIndexFromGun(gunIndex);
    
    // Record hit/miss for multiplayer stats
    if (this.isMultiplayer()) {
        if (hitTarget) {
            this.players.recordHit(playerIndex, points);
        } else {
            this.players.recordMiss(playerIndex);
        }
    }
}
```

### PlayerManager Methods

```javascript
// Initialize session
this.players.initSession(2, { mode: 'coop', simultaneous: true });

// Reset for new game
this.players.resetGame(3);  // 3 lives each

// Get player
const player = this.players.getPlayer(0);
const player = this.players.getPlayerByGun(gunIndex);

// Update stats
this.players.recordHit(playerIndex, points);
this.players.recordMiss(playerIndex);
this.players.loseLife(playerIndex);  // returns true if eliminated
this.players.addScore(playerIndex, points);

// Check state
this.players.isMultiplayer();
this.players.isCooperative();
this.players.isCompetitive();
const { isOver, winner, reason } = this.players.checkGameOver();

// Get results
const results = this.players.getFinalResults();  // sorted by score
const teamStats = this.players.getTeamStats();   // for coop mode
```

---

## Game Manifest Schema

```javascript
static getManifest() {
    return {
        // Required
        id: 'my-game',           // Unique identifier
        name: 'My Game',         // Display name
        
        // Optional (defaults shown)
        version: '1.0.0',
        author: 'Unknown',
        description: '',
        isAvailable: true,       // false to hide from arcade
        thumbnail: null,         // Path to thumbnail image
        banner: null,            // Path to banner image
        
        // Game modes
        modes: ['arcade'],       // e.g., ['campaign', 'endless', 'practice']
        difficulties: ['normal'], // e.g., ['beginner', 'medium', 'hard']
        
        // Multiplayer config
        multiplayer: {
            minPlayers: 1,
            maxPlayers: 1,       // Set to 2-4 for multiplayer
            supportedModes: [],  // Array of mode objects
            defaultMode: null
        },
        
        // Feature flags
        features: {
            requiresReload: false,
            hasAchievements: false,
            hasPowerUps: false
        }
    };
}
```

### Multiplayer Mode Objects

```javascript
supportedModes: [
    { 
        id: 'coop', 
        name: 'Co-op', 
        type: 'cooperative',  // or 'competitive'
        simultaneous: true    // both play at once vs turn-based
    },
    { 
        id: 'versus', 
        name: 'Versus', 
        type: 'competitive', 
        simultaneous: true 
    }
]
```

---

## Input Handling

### Shoot Events

```javascript
// In constructor
this.input.on("shoot", (coords) => this.handleShoot(coords));

// Handler receives:
handleShoot({ x, y, gunIndex, source }) {
    // x, y: Canvas coordinates (scaled to canvas resolution)
    // gunIndex: -1 for mouse, 0-3 for guns
    // source: 'mouse' or 'gun'
}
```

### Keyboard Events

```javascript
// In init()
this.enableKeyboardEvents();

// Override these methods
onKeyDown(event) {
    if (event.code === 'Space') {
        this.togglePause();
    }
}

onKeyUp(event) { }
```

### Start Button (Lightgun)

```javascript
// In init()
this.enableStartButton();

// Override this method
onStartButton(gunIndex) {
    this.togglePause();
}
```

---

## System Integration Methods

```javascript
// Return to arcade menu
this.returnToArcade();

// Show gun setup screen
this.showGunSetup(() => {
    // Called when user returns from gun setup
    this.showSettings();
});

// Get current user info
const user = this.getCurrentUser();
// { name: 'Player', isGuest: true }

// Save to global leaderboard
this.saveGlobalScore(name, score, difficulty);

// Control cursor visibility
this.setInGame(true);   // Hide cursors (gameplay)
this.setInGame(false);  // Show cursors (menus)
```

---

## Asset Loading

```javascript
// Load single assets
const img = await this.assets.loadImage('/path/to/image.png');
const sound = await this.assets.loadAudio('/path/to/sound.mp3');
const data = await this.assets.loadJSON('/path/to/data.json');

// Preload multiple assets with progress
await this.assets.preload({
    images: {
        player: '/sprites/player.png',
        enemy: '/sprites/enemy.png'
    },
    audio: {
        shoot: '/sounds/shoot.mp3',
        hit: '/sounds/hit.mp3'
    }
}, (progress) => {
    console.log(`Loading: ${Math.round(progress * 100)}%`);
});

// Get cached assets
const playerImg = this.assets.get('player');
```

---

## High Scores

```javascript
// Add a score
this.highScores.addScore(name, score, difficulty, gameMode);

// Check if score qualifies
if (this.highScores.isHighScore(score)) {
    this.showNameEntry(score);
}

// Get scores
const scores = this.highScores.getScores();
const filtered = this.highScores.getScoresByDifficulty('hard');

// Clear scores
this.highScores.clearScores();
```

---

## Game State Machine (Optional Helper)

```javascript
import { GameStateMachine } from '../../arcade/sdk/GameStateMachine.js';

// Create state machine
this.stateMachine = new GameStateMachine({
    onEnter: (state, prevState) => console.log(`Entered ${state}`),
    onExit: (state, nextState) => console.log(`Exiting ${state}`),
    onTransition: (from, to) => console.log(`${from} -> ${to}`)
});

// Change state
this.stateMachine.setState('PLAYING');

// Check state
if (this.stateMachine.isPlaying()) { }
if (this.stateMachine.isPaused()) { }
if (this.stateMachine.isInMenu()) { }

// Toggle pause
this.stateMachine.togglePause();

// Get current state
const state = this.stateMachine.getState();
```

---

## Sound Manager

```javascript
// Play sounds (provided by SDK)
this.sound.playShoot();
this.sound.playHit();
this.sound.playMiss();
this.sound.playCombo();     // For combo achievements
this.sound.playGameOver();
this.sound.playGameClear();
this.sound.playDogLaugh();  // For Not Duck Hunt

// Play custom sound
this.sound.play('customSound');
```

---

## Best Practices

1. **Always use SDK UI components** instead of raw HTML manipulation
2. **Use `this.setInGame(true/false)`** to control cursor visibility
3. **Route input through `getPlayerIndexFromGun()`** for multiplayer support
4. **Use `isGunInputAllowed()`** to filter input in single-player with multiple guns
5. **Clear `uiLayer.innerHTML`** before rebuilding UI after settings
6. **Implement `onKeyDown` and `onStartButton`** for pause functionality
7. **Use the manifest** to declare multiplayer support
8. **Call `this.players.resetGame()`** when starting a new game
9. **Call `setSinglePlayerGun(null)`** when returning to menu to reset gun lock
10. **Re-apply cursor hiding** after `setInGame(true)` in single-player mode

---

## Single Player Gun Management (New in 1.1)

When multiple lightguns are connected, single-player games should only respond to one gun:

### Starting a Single Player Game

```javascript
startGame(mode) {
    this.setInGame(true);
    
    // Lock to the gun that clicked the start button
    const activeGun = this.getLastTriggerGunIndex();
    this.setSinglePlayerGun(activeGun >= 0 ? activeGun : -1);
    
    // ... start game logic
}
```

### Filtering Input

```javascript
handleShoot({ x, y, gunIndex }) {
    if (!this.isGunInputAllowed(gunIndex)) {
        return; // Ignore input from inactive gun
    }
    // Process shot...
}
```

### Returning to Menu

```javascript
showMenu() {
    this.setInGame(false);
    this.setSinglePlayerGun(null); // Allow all guns in menu
    // ... show menu
}
```

### Re-applying After setInGame

When resuming from pause or starting a new round, re-apply cursor hiding:

```javascript
onRoundStart() {
    this.setInGame(true);
    
    // Re-apply single player cursor hiding
    const activeGun = this.getActiveGunIndex();
    if (!this.isMultiplayer() && activeGun !== null) {
        this._updateSinglePlayerCursors(activeGun);
    }
}
```

### Available Methods

| Method | Description |
|--------|-------------|
| `setSinglePlayerGun(gunIndex)` | Lock to specific gun (-1=mouse, null=all) |
| `getActiveGunIndex()` | Get current active gun (null if all allowed) |
| `isGunInputAllowed(gunIndex)` | Check if gun input should be processed |
| `getLastTriggerGunIndex()` | Get last gun that fired (for game start) |
| `_updateSinglePlayerCursors(gunIndex)` | Hide inactive cursors (internal) |
| `_resetCursorVisibility()` | Show all cursors (internal) |
