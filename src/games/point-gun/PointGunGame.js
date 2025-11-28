import { BaseGame } from '../../arcade/interfaces/BaseGame.js';
import { LevelManager } from './LevelManager.js';
import { ComboSystem, FloatingScoreManager, ComboDisplay } from '../../arcade/sdk/index.js';

export class Game extends BaseGame {
    constructor(canvas, uiLayer, system) {
        super(canvas, uiLayer, system);

        // SDK provides: this.input, this.sound, this.highScores, this.settings
        this.levelManager = new LevelManager(this);

        this.state = "MENU"; // MENU, PLAYING, GAMEOVER, INTRO, RESULT
        this.lastTime = 0;

        // Combo system (SDK)
        this.combo = new ComboSystem();
        this.combo.onUpdate = (combo, multiplier) => this.onComboUpdate(combo, multiplier);
        this.combo.onBreak = (finalCombo) => this.onComboBreak(finalCombo);
        this.combo.onMilestone = (combo, multiplier) => this.onComboMilestone(combo, multiplier);
        
        // Floating scores (SDK)
        this.floatingScores = new FloatingScoreManager();
        
        // Combo display (SDK)
        this.comboDisplay = new ComboDisplay({ y: 80 });

        // Bind input via SDK-provided InputManager
        this.input.on("shoot", (coords) => this.handleShoot(coords));
    }

    static getManifest() {
        return {
            id: 'point-gun',
            name: 'Point Gun',
            version: '1.0.0',
            author: 'Lightgun Arcade',
            description: 'Fast-paced mini-game collection inspired by Point Blank',
            isAvailable: true,
            modes: ['arcade', 'practice'],
            difficulties: ['beginner', 'medium', 'hard'],
            multiplayer: {
                minPlayers: 1,
                maxPlayers: 2,
                supportedModes: [
                    { id: 'versus', name: 'Versus', type: 'competitive', simultaneous: true },
                    { id: 'coop', name: 'Co-op', type: 'cooperative', simultaneous: true }
                ]
            },
            features: {
                requiresReload: false,
                hasAchievements: false
            }
        };
    }

    async init() {
        // Enable SDK event handling for keyboard and start button
        this.enableKeyboardEvents();
        this.enableStartButton();
        
        this.showMenu();
    }

    // SDK calls destroy() automatically via _cleanup()
    // No need to manually remove event listeners - SDK handles it

    // SDK lifecycle hook: called when start button is pressed
    onStartButton(gunIndex) {
        if (this.state === "PLAYING" || this.state === "PAUSED") {
            this.togglePause();
        }
    }

    // SDK lifecycle hook: called when key is pressed
    onKeyDown(event) {
        if (event.code === "Space" && (this.state === "PLAYING" || this.state === "PAUSED")) {
            event.preventDefault();
            this.togglePause();
        }
    }

    togglePause() {
        if (this.state === "PLAYING") {
            this.state = "PAUSED";
            // Show cursors for pause menu (SDK method)
            this.setInGame(false);
            this.showPauseMenu();
        } else if (this.state === "PAUSED") {
            this.state = "PLAYING";
            // Hide cursors for gameplay (SDK method)
            this.setInGame(true);
            
            // Re-apply single player cursor hiding after setInGame (SDK method)
            const activeGun = this.getActiveGunIndex();
            if (!this.isMultiplayer() && activeGun !== null) {
                this._updateSinglePlayerCursors(activeGun);
            }
            
            this.hidePauseMenu();
        }
    }

    showPauseMenu() {
        this.ui.overlay.showPauseMenu({
            onResume: () => this.togglePause(),
            onSettings: () => {
                this.hidePauseMenu();
                this.state = "PAUSED_SETTINGS";
                this._showSettingsScreen();
            },
            onQuitMenu: () => {
                this.hidePauseMenu();
                this.state = "MENU";
                this.showMenu();
            },
            onQuitArcade: () => this.returnToArcade()
        });
    }

    hidePauseMenu() {
        this.ui.overlay.hidePauseMenu();
    }

    // SDK handles resize via onResize() hook - no manual handling needed

    handleShoot({ x, y, gunIndex }) {
        if (this.state === "PLAYING") {
            // Use SDK method to check if this gun is allowed (single player filtering)
            if (!this.isGunInputAllowed(gunIndex)) {
                return;
            }
            
            this.sound.playShoot();
            
            // Get player index from gun (0 for single player/mouse)
            const playerIndex = this.getPlayerIndexFromGun(gunIndex);
            
            this.levelManager.handleInput(x, y, playerIndex);
        }
    }

    update(dt) {
        if (this.state === "PLAYING") {
            this.levelManager.update(dt);
            
            // Update combo timer
            this.combo.update(dt);
            
            // Update combo display
            this.comboDisplay.update(
                this.combo.getCombo(),
                this.combo.getMultiplier(),
                this.combo.getTimerPercent()
            );
            
            // Update timer display
            this.updateTimer();
        }
        
        // Update floating scores (always, for fade-out)
        this.floatingScores.update(dt);
    }

    draw(ctx) {
        // Clear background
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === "PLAYING" || this.state === "PAUSED") {
            this.levelManager.draw(ctx);
            
            // Draw floating scores
            this.floatingScores.draw(ctx);
            
            // Draw combo display
            this.comboDisplay.draw(ctx, this.canvas.width);
        }
    }

    showMenu() {
        this.state = "MENU";
        // Show cursors for menu (SDK method)
        this.setInGame(false);
        
        // Reset single player gun lock (SDK method)
        this.setSinglePlayerGun(null);
        
        // Build menu using SDK MenuBuilder
        const screen = this.ui.menu.createScreen({
            title: 'POINT GUN',
            subtitle: 'Mini-Game Collection'
        });
        
        // Single player difficulty buttons
        const difficultyGroup = this.ui.menu.createButtonGroup([
            { id: 'btn-beginner', text: 'BEGINNER', className: 'diff-btn', onClick: () => this.startGame('beginner') },
            { id: 'btn-medium', text: 'MEDIUM', className: 'diff-btn', onClick: () => this.startGame('medium') },
            { id: 'btn-hard', text: 'HARD', className: 'diff-btn', onClick: () => this.startGame('hard') }
        ]);
        screen.appendChild(difficultyGroup);
        
        // 2 Player section (using SDK createSection)
        const multiplayerSection = this.ui.menu.createSection({ title: '2 PLAYER MODES' });
        const multiplayerGroup = this.ui.menu.createButtonGroup([
            { id: 'btn-versus', text: 'VERSUS', className: 'diff-btn', style: 'background: #662222;', onClick: () => this.showPlayerSelectMenu('versus') },
            { id: 'btn-coop', text: 'CO-OP', className: 'diff-btn', style: 'background: #226622;', onClick: () => this.showPlayerSelectMenu('coop') }
        ]);
        multiplayerSection.appendChild(multiplayerGroup);
        screen.appendChild(multiplayerSection);
        
        // Bottom buttons
        const bottomSection = document.createElement('div');
        bottomSection.style.cssText = 'margin-top: 20px; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;';
        
        bottomSection.appendChild(this.ui.menu.createButton({ id: 'btn-highscores', text: 'HIGH SCORES', onClick: () => this.showHighScores() }));
        bottomSection.appendChild(this.ui.menu.createButton({ id: 'btn-settings', text: 'SETTINGS', onClick: () => this._showSettingsScreen() }));
        bottomSection.appendChild(this.ui.menu.createButton({ id: 'btn-debug', text: 'PRACTICE MODE', style: 'font-size: 0.8rem; opacity: 0.7;', onClick: () => this.showPracticeMenu() }));
        bottomSection.appendChild(this.ui.menu.createButton({ id: 'btn-exit-arcade', text: 'EXIT TO ARCADE', style: 'font-size: 0.8rem; margin-top: 10px; background: #444;', onClick: () => this.returnToArcade() }));
        
        screen.appendChild(bottomSection);
        this.ui.menu.show(screen);
    }

    /**
     * Show player selection screen for multiplayer
     * @param {string} mode - 'versus' or 'coop'
     */
    showPlayerSelectMenu(mode = 'versus') {
        this.showPlayerSelect({
            minPlayers: 2,
            defaultPlayers: 2,
            onStart: (playerCount, selectedMode, gunAssignments) => {
                // Initialize multiplayer session
                this.players.initSession(playerCount, {
                    mode: mode === 'coop' ? 'coop' : 'versus',
                    simultaneous: true,
                    gunAssignments
                });
                this.players.resetGame(3);
                
                // All guns active in multiplayer (SDK method)
                this.setSinglePlayerGun(null);
                
                this._startingMultiplayer = true;
                this.showDifficultySelect();
            },
            onBack: () => this.showMenu()
        });
    }
    
    /**
     * Show difficulty selection after player select
     */
    showDifficultySelect() {
        this.setInGame(false);
        
        // Use SDK MenuBuilder for difficulty selection
        this.ui.menu.showDifficultySelect({
            title: 'SELECT DIFFICULTY',
            onSelect: (difficulty) => this.startGame(difficulty),
            onBack: () => this.showMenu()
        });
    }

    startGame(difficulty) {
        // Hide cursors for gameplay (SDK method)
        this.setInGame(true);
        
        // Check if this is a single player game
        const isSinglePlayer = !this._startingMultiplayer;
        
        if (isSinglePlayer) {
            // Single player - initialize with 1 player
            this.players.initSession(1, { mode: 'single' });
            this.players.resetGame(3);
            
            // Lock to the gun that started the game (SDK method)
            const activeGun = this.getLastTriggerGunIndex();
            this.setSinglePlayerGun(activeGun >= 0 ? activeGun : -1);
        }
        
        // Reset multiplayer flag
        this._startingMultiplayer = false;
        
        // Reset combo for new game
        this.combo.reset();
        
        this.levelManager.isPracticeMode = false;
        this.levelManager.setDifficulty(difficulty);
        this.levelManager.startNextStage();
    }

    showHUD() {
        if (this.isMultiplayer()) {
            // No center "round" display to avoid overlapping with mini-game text
            // Stage info will be shown in a custom element
            const hudConfig = {};
            
            // Add mode indicator (use SDK PlayerManager.gameMode)
            if (this.players.gameMode === 'coop') {
                hudConfig.modeLabel = 'CO-OP';
            } else if (this.players.gameMode === 'versus') {
                hudConfig.modeLabel = 'VERSUS';
            }
            
            this.showMultiplayerHUD(hudConfig);
            
            // Add stage info underneath score (top-left)
            const stageEl = document.createElement('div');
            stageEl.id = 'stage-info';
            stageEl.style.cssText = 'position: absolute; top: 55px; left: 20px; font-size: 16px; color: #ffcc00; text-shadow: 2px 2px 0 #000; z-index: 100;';
            stageEl.textContent = `STAGE ${this.levelManager.currentStage}`;
            this.uiLayer.appendChild(stageEl);
            
            // Add timer element at bottom center (big and prominent)
            const timerEl = document.createElement('div');
            timerEl.id = 'hud-timer';
            timerEl.style.cssText = 'position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); font-size: 36px; color: #fff; text-shadow: 3px 3px 0 #000; z-index: 100;';
            timerEl.textContent = '⏱ --';
            this.uiLayer.appendChild(timerEl);
        } else {
            // Use SDK HUDBuilder - score/lives top-left, stage underneath, timer bottom center
            this.ui.hud.create({
                score: this.levelManager.score,
                lives: this.levelManager.lives,
                custom: {
                    stageInfo: {
                        position: 'top: 55px; left: 20px; font-size: 16px; color: #ffcc00; text-shadow: 2px 2px 0 #000;',
                        text: `STAGE ${this.levelManager.currentStage}`
                    },
                    timer: {
                        position: 'bottom: 30px; left: 50%; transform: translateX(-50%); font-size: 36px; color: #fff; text-shadow: 3px 3px 0 #000;',
                        text: '⏱ --'
                    },
                    gunIndicator: {
                        position: 'bottom: 20px; right: 20px; font-size: 14px; color: #888; padding: 5px 10px; background: rgba(0,0,0,0.5); border-radius: 5px;',
                        text: `🎯 ${this.getActiveGunLabel()}`
                    }
                }
            });
        }
    }
    
    /**
     * Get active gun label for HUD display
     * @returns {string} Gun label text
     */
    getActiveGunLabel() {
        const activeGun = this.getActiveGunIndex();
        return activeGun === -1 ? 'MOUSE' : `GUN ${activeGun + 1}`;
    }

    updateScoreDisplay() {
        if (this.isMultiplayer()) {
            this.players.players.forEach((player, index) => {
                this.updatePlayerHUD(index);
            });
        } else {
            this.ui.hud.update('score', this.levelManager.score);
        }
    }
    
    updateHUD() {
        // Update all HUD elements including lives and timer
        if (this.ui.hud) {
            this.ui.hud.update('score', this.levelManager.score);
            this.ui.hud.update('lives', this.levelManager.lives);
            this.updateTimer();
        }
    }
    
    updateTimer() {
        // Update timer display from current mini-game
        if (this.levelManager.currentGame) {
            const timeLeft = Math.max(0, Math.ceil(this.levelManager.currentGame.timeLimit));
            const color = timeLeft <= 5 ? '#ff4444' : '#ffffff';
            const timerText = `⏱ ${timeLeft}s`;
            
            // Update via HUD if available (single player)
            if (this.ui.hud) {
                this.ui.hud.update('timer', timerText);
            }
            
            // Also update direct element (multiplayer or fallback)
            const timerEl = document.getElementById('hud-timer');
            if (timerEl) {
                timerEl.textContent = timerText;
                timerEl.style.color = color;
            }
        }
    }

    showStageIntro(stageNum, objective, callback) {
        this.state = "INTRO";
        
        // Reset combo for new stage (so max combo is per-stage)
        this.combo.reset();
        
        // Get mode-specific info
        let info = `LIVES: ${this.levelManager.lives}`;
        let borderColor = '#00ccff';
        
        // Show mode instructions on stage 1 (use SDK PlayerManager.gameMode)
        if (stageNum === 1 && this.isMultiplayer()) {
            if (this.players.gameMode === 'coop') {
                info = 'Work together! Combined score wins.';
                borderColor = '#22aa22';
            } else if (this.players.gameMode === 'versus') {
                info = 'Compete! Highest score wins each stage.';
                borderColor = '#aa2222';
            }
        }
        
        // Show active gun in single player
        if (stageNum === 1 && !this.isMultiplayer()) {
            const activeGun = this.getActiveGunIndex();
            const gunLabel = activeGun === -1 ? 'MOUSE' : `GUN ${activeGun + 1}`;
            info = `${info} | Active: ${gunLabel}`;
        }
        
        this.ui.overlay.showIntro({
            title: `STAGE ${stageNum}`,
            subtitle: objective,
            info: info,
            borderColor: borderColor,
            duration: stageNum === 1 && this.isMultiplayer() ? 3000 : 2000,
            onComplete: () => {
                this.state = "PLAYING";
                this.setInGame(true);
                
                // Re-apply single player cursor hiding after setInGame (SDK method)
                const activeGun = this.getActiveGunIndex();
                if (!this.isMultiplayer() && activeGun !== null) {
                    this._updateSinglePlayerCursors(activeGun);
                }
                
                this.showHUD();
                callback();
            }
        });
    }

    showStageResult(success, callback) {
        try {
            this.state = "RESULT";
            // Show cursors for stage result screen (SDK method)
            this.setInGame(false);

            // Calculate stats if we have a game instance
            if (this.levelManager.currentGame) {
                const game = this.levelManager.currentGame;
                const bonuses = game.calculateBonuses();
                const accuracy = game.getAccuracy();
                const time = game.getCompletionTime();

                // Award bonuses
                const roundTotal = bonuses.total + game.stats.baseScore;
                this.levelManager.score += bonuses.total;

                if (this.isMultiplayer()) {
                    // Use SDK OverlayBuilder for multiplayer stage result
                    const playerStats = game.playerStats || [];
                    const players = playerStats.map((ps, index) => ({
                        name: `P${index + 1}`,
                        color: this.players.getPlayer(index)?.colors?.primary || ['#ff4444', '#4444ff'][index],
                        score: ps?.score || 0,
                        hits: ps?.hits || 0,
                        shots: ps?.shots || 0,
                        totalScore: this.players.getPlayer(index)?.score || 0
                    }));
                    
                    this.ui.overlay.showStageResult({
                        success,
                        multiplayer: {
                            players,
                            mode: this.players.gameMode,
                            teamScore: this.players.gameMode === 'coop' ? roundTotal : undefined,
                            teamInfo: this.players.gameMode === 'coop' ? `${game.stats.hits}/${game.stats.shots} hits • ${time.toFixed(1)}s` : undefined
                        },
                        onNext: callback
                    });
                } else {
                    // Use SDK OverlayBuilder for single player stage result
                    // Note: baseScore already includes difficulty and combo multipliers
                    const maxCombo = this.combo.getMaxCombo();
                    const diffLabel = game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1);
                    
                    // Build stats with info text showing difficulty and combo
                    const infoText = `${diffLabel} (x${game.scoreMultiplier}) • Max Combo: ${maxCombo}`;
                    
                    // Build bonus targets label
                    const bonusLabel = bonuses.bonusTargetCount > 0 
                        ? `Bonus Targets (${bonuses.bonusTargetCount}):` 
                        : 'Bonus Targets:';
                    
                    this.ui.overlay.showStageResult({
                        success,
                        info: infoText,
                        stats: [
                            { label: 'Hit Score:', value: game.stats.baseScore },
                            { label: `Accuracy Bonus (${accuracy.toFixed(1)}%):`, value: `+${bonuses.accuracy}` },
                            { label: `Pinpoint Bonus (${bonuses.pinpointPercent.toFixed(1)}%):`, value: `+${bonuses.pinpoint}` },
                            { label: bonusLabel, value: `+${bonuses.bonusTargets}`, dividerAfter: true },
                            { label: 'ROUND SCORE:', value: roundTotal, color: '#ffff00', isTotal: true },
                            { label: 'TOTAL SCORE:', value: this.levelManager.score, color: '#00ff00', isTotal: true }
                        ],
                        onNext: callback
                    });
                }
            } else {
                // No game instance, just show basic result
                this.ui.overlay.showStageResult({
                    success,
                    onNext: callback
                });
            }
        } catch (e) {
            console.error("Error in showStageResult:", e);
            callback();
        }
    }

    gameClear(finalScore) {
        this.state = "GAMEOVER";
        this.sound.playGameOver();

        if (this.isMultiplayer()) {
            this.showMultiplayerResults({
                cleared: true,
                onRetry: () => {
                    this.players.resetGame(3);
                    this.startGame(this.levelManager.difficulty);
                },
                onMenu: () => this.showMenu()
            });
        } else if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore);
        } else {
            this.showGameClearScreen(finalScore);
        }
    }

    showNameEntry(finalScore) {
        this.setInGame(false);
        
        this.ui.overlay.showNameEntry({
            score: finalScore,
            defaultName: this.getCurrentUser().name,
            onSubmit: (name) => {
                this.highScores.addScore(name, finalScore, this.levelManager.difficulty);
                this.saveGlobalScore(name, finalScore, this.levelManager.difficulty);
                
                if (this.levelManager.lives > 0) {
                    this.showGameClearScreen(finalScore);
                } else {
                    this.showGameOverScreen(finalScore);
                }
            }
        });
    }

    showGameClearScreen(finalScore) {
        this.setInGame(false);
        
        // Use SDK OverlayBuilder for game clear
        this.ui.overlay.showGameOver({
            cleared: true,
            score: finalScore,
            onRetry: () => this.startGame(this.levelManager.difficulty),
            onMenu: () => this.showMenu()
        });
    }

    gameOver() {
        this.state = "GAMEOVER";
        this.sound.playGameOver();
        const finalScore = this.levelManager.score;

        if (this.isMultiplayer()) {
            this.showMultiplayerResults({
                cleared: false,
                onRetry: () => {
                    this.players.resetGame(3);
                    this.startGame(this.levelManager.difficulty);
                },
                onMenu: () => this.showMenu()
            });
        } else if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore);
        } else {
            this.showGameOverScreen(finalScore);
        }
    }

    showGameOverScreen(finalScore) {
        this.setInGame(false);
        
        this.ui.overlay.showGameOver({
            cleared: false,
            score: finalScore,
            onRetry: () => this.startGame(this.levelManager.difficulty),
            onMenu: () => this.showMenu()
        });
    }

    /**
     * Internal method to show settings screen with proper back handling
     */
    _showSettingsScreen() {
        this.showSettings({
            onBack: () => {
                if (this.state === "PAUSED_SETTINGS") {
                    this.state = "PAUSED";
                    // Clear uiLayer before rebuilding HUD and pause menu
                    this.uiLayer.innerHTML = '';
                    this.showHUD();
                    this.showPauseMenu();
                } else {
                    this.showMenu();
                }
            }
        });
    }

    showHighScores() {
        this.setInGame(false);
        const scores = this.highScores.getScores();
        
        this.ui.highScores.show({
            scores,
            onBack: () => this.showMenu(),
            badges: [
                { field: 'difficulty', format: (v) => v ? v.charAt(0).toUpperCase() : '-' }
            ]
        });
    }

    showPracticeMenu() {
        // Show cursors for practice menu (SDK method)
        this.setInGame(false);
        
        // Define mini-games and difficulties
        const miniGames = ['ClassicTarget', 'ColorMatch', 'BombPanic', 'QuickDraw'];
        const difficulties = ['beginner', 'medium', 'hard'];
        
        // Build sections for SDK grid menu
        const sections = miniGames.map(gameName => ({
            title: gameName.replace(/([A-Z])/g, ' $1').trim(), // Add spaces before capitals
            buttons: difficulties.map(diff => ({
                text: diff.charAt(0).toUpperCase() + diff.slice(1),
                data: { game: gameName, diff: diff },
                onClick: () => this.startPracticeGame(gameName, diff)
            }))
        }));
        
        // Use SDK MenuBuilder for grid menu
        this.ui.menu.showGridMenu({
            title: 'PRACTICE MODE',
            subtitle: 'Select Mini-Game & Difficulty',
            sections,
            onBack: () => this.showMenu()
        });
    }

    startPracticeGame(gameName, difficulty) {
        // Enable practice mode
        this.levelManager.isPracticeMode = true;
        this.setInGame(true);

        // Import the game class dynamically
        import(`./minigames/${gameName}.js`).then(module => {
            const GameClass = module[gameName];

            // Reset state
            this.state = "PLAYING";
            this.levelManager.score = 0;
            this.levelManager.currentGame = new GameClass(this, difficulty);

            // Use SDK HUDBuilder for practice mode HUD
            const displayName = gameName.replace(/([A-Z])/g, ' $1').trim();
            this.ui.hud.create({
                score: 0,
                custom: {
                    practiceLabel: {
                        position: 'top: 20px; left: 20px;',
                        text: `PRACTICE: ${displayName} (${difficulty})`
                    }
                }
            });

            this.levelManager.currentGame.start();
        });
    }
    
    // =========================================================================
    // COMBO SYSTEM CALLBACKS
    // =========================================================================
    
    /**
     * Called when combo is updated (on hit)
     */
    onComboUpdate(combo, multiplier) {
        // Play combo sound at milestones
        if (combo === 3 || combo === 5 || combo === 8 || combo === 10 || combo === 15) {
            this.sound.playCombo();
        }
    }
    
    /**
     * Called when combo breaks (on miss or timeout)
     */
    onComboBreak(finalCombo) {
        if (finalCombo >= 5) {
            // Show combo lost message
            this.floatingScores.spawnText(
                this.canvas.width / 2,
                120,
                `COMBO LOST (x${finalCombo})`,
                '#ff4444',
                20
            );
        }
    }
    
    /**
     * Called when a new combo multiplier threshold is reached
     */
    onComboMilestone(combo, multiplier) {
        // Could add special effects here
    }
    
    /**
     * Spawn a floating score (called by MiniGame)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Score options
     */
    spawnFloatingScore(x, y, options = {}) {
        this.floatingScores.spawn(x, y, {
            ...options,
            combo: this.combo.getCombo(),
            multiplier: this.combo.getMultiplier()
        });
    }
    
    /**
     * Get current combo multiplier (for MiniGame scoring)
     * @returns {number}
     */
    getComboMultiplier() {
        return this.combo.getMultiplier();
    }
    
    /**
     * Increment combo (called by MiniGame on hit)
     */
    incrementCombo() {
        this.combo.increment();
    }
    
    /**
     * Break combo (called by MiniGame on miss)
     */
    breakCombo() {
        this.combo.break();
    }
}
