import { InputManager } from '../../shared/InputManager.js';
import { SoundManager } from '../../shared/SoundManager.js';
import { GameHighScores } from '../services/GameHighScores.js';
import { MenuBuilder, HUDBuilder, OverlayBuilder, HighScoreDisplay } from '../sdk/UIComponents.js';
import { SettingsScreen } from '../sdk/SettingsScreen.js';
import { AssetLoader } from '../sdk/AssetLoader.js';
import { PlayerManager } from '../core/PlayerManager.js';
import { PlayerSelectScreen } from '../sdk/PlayerSelectScreen.js';
import { GameServices } from '../sdk/GameServices.js';

/**
 * Abstract base class for all Lightgun Arcade games.
 * All games must extend this class and implement the required methods.
 * 
 * The SDK provides:
 * - this.canvas, this.ctx - Canvas and 2D context
 * - this.uiLayer - DOM element for UI overlays
 * - this.input - InputManager for mouse/touch/gun input
 * - this.sound - SoundManager for audio
 * - this.highScores - Per-game high score manager (local)
 * - this.settings - User settings reference
 * - this.ui - UI component builders (menu, hud, overlay, highScores)
 * - this.assets - AssetLoader for loading images, audio, JSON
 * - this.services - GameServices for online scores, leaderboards, sessions
 * - Convenience methods for system integration
 */
export class BaseGame {
    /**
     * @param {HTMLCanvasElement} canvas - The game canvas
     * @param {HTMLElement} uiLayer - The UI overlay layer
     * @param {ArcadeSystem} system - Reference to the main ArcadeSystem
     */
    constructor(canvas, uiLayer, system) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;
        this.system = system;
        this.ctx = canvas.getContext('2d');

        if (this.constructor === BaseGame) {
            throw new Error("BaseGame is an abstract class and cannot be instantiated directly.");
        }

        // Get game ID from manifest for services
        const manifest = this.constructor.getManifest();
        this._gameId = manifest.id;

        // Phase 2: Provide shared services via SDK
        this.input = new InputManager(canvas, system.gunManager);
        this.sound = system.soundManager; // Shared SoundManager
        this.highScores = new GameHighScores(this._gameId);
        this.settings = system.settings;

        // Phase 3: Internal state for event management
        this._startButtonHandler = null;
        this._keydownHandler = null;
        this._keyupHandler = null;
        this._isPaused = false;

        // SDK UI Components
        this.ui = {
            menu: new MenuBuilder(uiLayer),
            hud: new HUDBuilder(uiLayer),
            overlay: new OverlayBuilder(uiLayer),
            highScores: new HighScoreDisplay(uiLayer)
        };

        // Asset loader (per-game instance)
        this.assets = new AssetLoader();

        // Online services (scores, leaderboards, sessions, activity)
        this.services = new GameServices(system);

        // Multiplayer support
        this.players = new PlayerManager();
        this._multiplayerConfig = null; // Set when starting multiplayer game
        
        // Single player gun locking (when multiple guns connected)
        this._activeGunIndex = null; // null = all guns allowed, number = only that gun
    }

    // =========================================================================
    // REQUIRED METHODS (must be implemented by subclass)
    // =========================================================================

    /**
     * Called when the game is first initialized.
     * Use this to setup game state, load assets, etc.
     * Note: Input, sound, and highScores are already available.
     */
    async init() {
        throw new Error("Method 'init()' must be implemented.");
    }

    /**
     * Called every frame to update game logic.
     * @param {number} dt - Delta time in seconds since last frame
     */
    update(dt) {
        throw new Error("Method 'update(dt)' must be implemented.");
    }

    /**
     * Called every frame to draw the game.
     * @param {CanvasRenderingContext2D} ctx - The canvas 2D context
     */
    draw(ctx) {
        throw new Error("Method 'draw(ctx)' must be implemented.");
    }

    /**
     * Returns the game manifest/metadata.
     * This static method must be implemented by the subclass.
     * @returns {Object} Game manifest with id, name, description, isAvailable
     */
    static getManifest() {
        throw new Error("Static method 'getManifest()' must be implemented.");
    }

    // =========================================================================
    // LIFECYCLE HOOKS (optional overrides)
    // =========================================================================

    /**
     * Called when the game is paused.
     * Override to handle pause-specific logic.
     */
    onPause() {
        // Optional override
    }

    /**
     * Called when the game is resumed.
     * Override to handle resume-specific logic.
     */
    onResume() {
        // Optional override
    }

    /**
     * Called when the window is resized.
     * Default implementation resizes canvas to window size.
     * Override for custom resize behavior.
     * @param {number} width - New window width
     * @param {number} height - New window height
     */
    onResize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Called when a key is pressed.
     * Override to handle keyboard input.
     * @param {KeyboardEvent} event - The keyboard event
     */
    onKeyDown(event) {
        // Optional override
    }

    /**
     * Called when a key is released.
     * Override to handle keyboard input.
     * @param {KeyboardEvent} event - The keyboard event
     */
    onKeyUp(event) {
        // Optional override
    }

    /**
     * Called when a lightgun start button is pressed.
     * Override to handle start button (commonly used for pause).
     * @param {number} gunIndex - Index of the gun that pressed start
     */
    onStartButton(gunIndex) {
        // Optional override - default does nothing
    }

    /**
     * Called when the game is being destroyed/exited.
     * The SDK automatically cleans up input, event listeners, etc.
     * Override to clean up game-specific resources.
     */
    destroy() {
        // Subclass can override for additional cleanup
    }

    /**
     * Internal cleanup called by ArcadeSystem.
     * Do not override - use destroy() for game-specific cleanup.
     */
    _cleanup() {
        // Call game's destroy method first
        this.destroy();

        // Clean up SDK-managed resources
        if (this.input) {
            this.input.destroy();
        }

        // Remove start button handler
        if (this._startButtonHandler) {
            this.system.gunManager.off('startButton', this._startButtonHandler);
            this._startButtonHandler = null;
        }

        // Remove keyboard handlers
        if (this._keydownHandler) {
            window.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
        if (this._keyupHandler) {
            window.removeEventListener('keyup', this._keyupHandler);
            this._keyupHandler = null;
        }
    }

    // =========================================================================
    // PHASE 1: CONVENIENCE METHODS (reduce coupling to system internals)
    // =========================================================================

    /**
     * Set whether the game is in active gameplay mode.
     * Controls cursor visibility based on user settings.
     * @param {boolean} inGame - true during gameplay, false for menus/pause
     */
    setInGame(inGame) {
        this.system.gunManager.setInGame(inGame);
    }

    /**
     * Save a score to the global arcade high scores (local only).
     * For online scores, use this.services.submitScore() instead.
     * @param {string} name - Player name
     * @param {number} score - Score value
     * @param {string} difficulty - Difficulty level
     * @deprecated Use submitScore() for full online + local submission
     */
    saveGlobalScore(name, score, difficulty) {
        this.system.globalHighScores.addScore(this._gameId, name, score, difficulty);
    }

    /**
     * Submit a score (online + local). This is the recommended way to save scores.
     * Handles online submission, local storage, and activity feed posting.
     * 
     * @param {number} score - Score value
     * @param {Object} options
     * @param {string} options.mode - Game mode (default: 'arcade')
     * @param {string} options.difficulty - Difficulty level (default: 'normal')
     * @param {Object} options.metadata - Additional data (accuracy, combos, etc.)
     * @param {string} options.playerName - Override player name
     * @returns {Promise<{score: Object, isPersonalBest: boolean}>}
     */
    async submitScore(score, options = {}) {
        return this.services.submitScore(this._gameId, score, options);
    }

    /**
     * Start a game session. Call this when gameplay begins.
     * @param {Object} options
     * @param {string} options.mode - Game mode
     * @param {string} options.difficulty - Difficulty level
     * @returns {Promise<Object>} Session object
     */
    async startGameSession(options = {}) {
        return this.services.startSession(this._gameId, options);
    }

    /**
     * End the current game session. Call this when gameplay ends.
     * @param {Object} results - Session results
     * @returns {Promise<Object>} Completed session
     */
    async endGameSession(results = {}) {
        return this.services.endSession(results);
    }

    /**
     * Complete game flow: end session and submit score in one call.
     * This is the easiest way to handle game completion.
     * 
     * @param {number} score - Final score
     * @param {Object} options
     * @param {string} options.mode - Game mode
     * @param {string} options.difficulty - Difficulty level
     * @param {Object} options.metadata - Additional stats
     * @returns {Promise<{session: Object, scoreResult: Object}>}
     */
    async completeGame(score, options = {}) {
        return this.services.completeGame(this._gameId, score, options);
    }

    /**
     * Get the current user profile.
     * @returns {Object} User object with username, display_name, avatar_url, etc.
     */
    getCurrentUser() {
        return this.system.auth.getCurrentUser();
    }

    /**
     * Check if the current user is a guest (not logged in)
     * @returns {boolean}
     */
    isGuest() {
        return this.system.auth.isGuest();
    }

    /**
     * Return to the arcade main menu.
     * Call this when the player wants to exit the game.
     */
    returnToArcade() {
        this.system.returnToArcade();
    }

    /**
     * Show the system settings menu.
     * Optionally provide a callback to return to a specific screen.
     */
    showSystemSettings() {
        this.system.showSettings();
    }

    /**
     * Show the gun setup/calibration menu.
     * @param {Function} callback - Called when gun setup is closed
     */
    showGunSetup(callback) {
        this.system.showGunSetup(callback);
    }

    /**
     * Show the SDK settings screen.
     * This is a convenience method that creates a SettingsScreen with proper callbacks.
     * @param {Object} options - Additional options
     * @param {Function} options.onBack - Custom back handler (default: return to previous state)
     */
    showSettings(options = {}) {
        this.setInGame(false);
        
        const settingsScreen = new SettingsScreen(this.uiLayer, this.settings, {
            onBack: options.onBack || (() => {
                // Default: games should override this to return to appropriate screen
                console.warn('showSettings: No onBack handler provided');
            }),
            onGunSetup: () => {
                this.showGunSetup(() => {
                    this.showSettings(options);
                });
            },
            showGunSetup: true
        });
        
        settingsScreen.show();
        return settingsScreen;
    }

    // =========================================================================
    // PHASE 3: EVENT REGISTRATION HELPERS
    // =========================================================================

    /**
     * Enable keyboard event handling.
     * Call this in init() if your game needs keyboard input.
     * Events will be routed to onKeyDown() and onKeyUp().
     */
    enableKeyboardEvents() {
        if (this._keydownHandler) return; // Already enabled

        this._keydownHandler = (e) => this.onKeyDown(e);
        this._keyupHandler = (e) => this.onKeyUp(e);

        window.addEventListener('keydown', this._keydownHandler);
        window.addEventListener('keyup', this._keyupHandler);
    }

    /**
     * Enable start button handling from lightguns.
     * Call this in init() if your game needs start button support.
     * Events will be routed to onStartButton().
     */
    enableStartButton() {
        if (this._startButtonHandler) return; // Already enabled

        this._startButtonHandler = (gunIndex) => this.onStartButton(gunIndex);
        this.system.gunManager.on('startButton', this._startButtonHandler);
    }

    // =========================================================================
    // PAUSE MANAGEMENT HELPERS
    // =========================================================================

    /**
     * Check if the game is currently paused.
     * @returns {boolean}
     */
    isPaused() {
        return this._isPaused;
    }

    /**
     * Pause the game. Calls onPause() and shows cursors.
     */
    pause() {
        if (this._isPaused) return;
        this._isPaused = true;
        this.setInGame(false);
        this.onPause();
    }

    /**
     * Resume the game. Calls onResume() and hides cursors (per settings).
     */
    resume() {
        if (!this._isPaused) return;
        this._isPaused = false;
        this.setInGame(true);
        this.onResume();
    }

    /**
     * Toggle pause state.
     */
    togglePause() {
        if (this._isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    // =========================================================================
    // MULTIPLAYER SUPPORT
    // =========================================================================

    /**
     * Show player selection screen before starting a multiplayer game.
     * @param {Object} options
     * @param {Function} options.onStart - Called when game should start: (playerCount, mode, gunAssignments) => {}
     * @param {Function} options.onBack - Called when back button is pressed
     */
    showPlayerSelect(options = {}) {
        this.setInGame(false);
        
        const manifest = this.constructor.getManifest();
        
        // Allow overriding minPlayers/defaultPlayers from options
        const modifiedManifest = { ...manifest };
        if (options.minPlayers !== undefined || options.defaultPlayers !== undefined) {
            modifiedManifest.multiplayer = { 
                ...manifest.multiplayer,
                minPlayers: options.minPlayers ?? manifest.multiplayer?.minPlayers ?? 1,
                defaultPlayers: options.defaultPlayers ?? manifest.multiplayer?.minPlayers ?? 1
            };
        }
        
        const screen = new PlayerSelectScreen(this.uiLayer, {
            manifest: modifiedManifest,
            gunManager: this.system.gunManager,
            onStart: (playerCount, mode, gunAssignments) => {
                // Initialize players
                this.players.initSession(playerCount, {
                    mode,
                    simultaneous: true,
                    gunAssignments
                });
                
                this._multiplayerConfig = { playerCount, mode, gunAssignments };
                
                if (options.onStart) {
                    options.onStart(playerCount, mode, gunAssignments);
                }
            },
            onBack: options.onBack
        });
        
        screen.show();
        return screen;
    }

    /**
     * Check if this is a multiplayer game session
     * @returns {boolean}
     */
    isMultiplayer() {
        return this.players.isMultiplayer();
    }

    /**
     * Get player by gun index (for routing input)
     * @param {number} gunIndex - Gun index from input event
     * @returns {Object|null} Player object or null
     */
    getPlayerByGun(gunIndex) {
        return this.players.getPlayerByGun(gunIndex);
    }

    /**
     * Get player index from gun index
     * Returns 0 for single player or mouse input
     * @param {number} gunIndex - Gun index from input event (-1 for mouse)
     * @returns {number} Player index
     */
    getPlayerIndexFromGun(gunIndex) {
        if (!this.isMultiplayer() || gunIndex === -1) {
            return 0; // Single player or mouse always maps to player 0
        }
        
        const player = this.getPlayerByGun(gunIndex);
        return player ? player.index : 0;
    }

    /**
     * Show multiplayer HUD
     * @param {Object} config - Additional HUD config (round, ammo, etc.)
     */
    showMultiplayerHUD(config = {}) {
        this.ui.hud.createMultiplayer(this.players.players, config);
    }

    /**
     * Update a player's HUD display
     * @param {number} playerIndex - Player index
     */
    updatePlayerHUD(playerIndex) {
        const player = this.players.getPlayer(playerIndex);
        if (!player) return;
        
        this.ui.hud.updatePlayerScore(playerIndex, player.score);
        this.ui.hud.updatePlayerLives(playerIndex, player.lives);
    }

    /**
     * Show multiplayer results screen
     * @param {Object} options
     * @param {boolean} options.cleared - Whether the game was cleared
     * @param {Function} options.onRetry - Retry handler
     * @param {Function} options.onMenu - Menu handler
     */
    showMultiplayerResults(options = {}) {
        this.setInGame(false);
        
        const results = this.players.getFinalResults();
        const teamStats = this.players.isCooperative() ? this.players.getTeamStats() : null;
        
        this.ui.overlay.showMultiplayerResults({
            players: results,
            mode: this.players.gameMode,
            cleared: options.cleared || false,
            teamStats,
            onRetry: options.onRetry,
            onMenu: options.onMenu
        });
    }

    // =========================================================================
    // SINGLE PLAYER GUN MANAGEMENT
    // =========================================================================

    /**
     * Lock input to a specific gun for single player mode.
     * When multiple guns are connected, only the specified gun can play.
     * @param {number} gunIndex - Gun index to lock to (-1 for mouse, null for all guns)
     */
    setSinglePlayerGun(gunIndex) {
        this._activeGunIndex = gunIndex;
        
        // Update cursor visibility
        if (gunIndex !== null) {
            this._updateSinglePlayerCursors(gunIndex);
        } else {
            this._resetCursorVisibility();
        }
    }

    /**
     * Get the active gun index for single player
     * @returns {number|null} Active gun index, or null if all guns allowed
     */
    getActiveGunIndex() {
        return this._activeGunIndex;
    }

    /**
     * Check if a gun input should be allowed (for single player filtering)
     * @param {number} gunIndex - Gun index from input event
     * @returns {boolean} True if input should be processed
     */
    isGunInputAllowed(gunIndex) {
        // If no restriction, allow all
        if (this._activeGunIndex === null) return true;
        // Otherwise only allow the active gun
        return gunIndex === this._activeGunIndex;
    }

    /**
     * Get the gun that last fired (for determining which gun started the game)
     * @returns {number} Last trigger gun index (-1 for mouse/none)
     */
    getLastTriggerGunIndex() {
        return this.system?.gunManager?.lastTriggerGunIndex ?? -1;
    }

    /**
     * Hide all gun cursors except the active one (internal)
     * @private
     */
    _updateSinglePlayerCursors(activeGunIndex) {
        const gunManager = this.system?.gunManager;
        if (!gunManager || !gunManager.cursorManager) return;
        
        const cursorManager = gunManager.cursorManager;
        
        // Hide all gun cursors except the active one
        for (let i = 0; i < gunManager.guns.length; i++) {
            const shouldShow = (i === activeGunIndex);
            cursorManager.setCursorVisible(i, shouldShow);
        }
        
        // Force update all cursor visibility
        cursorManager.updateAllCursorVisibility();
    }

    /**
     * Reset cursor visibility (show all cursors)
     * @private
     */
    _resetCursorVisibility() {
        const gunManager = this.system?.gunManager;
        if (gunManager?.cursorManager) {
            gunManager.cursorManager.resetCursorVisibility();
        }
    }
}
