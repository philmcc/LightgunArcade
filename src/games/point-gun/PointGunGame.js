import { BaseGame } from '../../arcade/interfaces/BaseGame.js';
import { LevelManager } from './LevelManager.js';

export class Game extends BaseGame {
    constructor(canvas, uiLayer, system) {
        super(canvas, uiLayer, system);

        // SDK provides: this.input, this.sound, this.highScores, this.settings
        this.levelManager = new LevelManager(this);

        this.state = "MENU"; // MENU, PLAYING, GAMEOVER, INTRO, RESULT
        this.lastTime = 0;

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
            this.sound.playShoot();
            
            // Get player index from gun (0 for single player/mouse)
            const playerIndex = this.getPlayerIndexFromGun(gunIndex);
            
            this.levelManager.handleInput(x, y, playerIndex);
        }
    }

    update(dt) {
        if (this.state === "PLAYING") {
            this.levelManager.update(dt);
        }
    }

    draw(ctx) {
        // Clear background
        ctx.fillStyle = "#222";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === "PLAYING") {
            this.levelManager.draw(ctx);
        }
    }

    showMenu() {
        this.state = "MENU";
        // Show cursors for menu (SDK method)
        this.setInGame(false);
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>POINT BLANK WEB</h1>
        <div class="difficulty-select">
            <button id="btn-beginner" class="diff-btn">BEGINNER</button>
            <button id="btn-medium" class="diff-btn">MEDIUM</button>
            <button id="btn-hard" class="diff-btn">HARD</button>
        </div>
        <div style="margin-top: 15px;">
            <button id="btn-2player" class="btn-primary">2 PLAYER</button>
        </div>
        <div style="margin-top: 20px;">
            <button id="btn-highscores">HIGH SCORES</button>
            <button id="btn-settings">SETTINGS</button>
            <button id="btn-debug" style="font-size: 0.8rem; opacity: 0.7;">PRACTICE MODE</button>
            <button id="btn-exit-arcade" style="font-size: 0.8rem; margin-top: 10px; background: #444;">EXIT TO ARCADE</button>
        </div>
      </div>
    `;

        document.getElementById("btn-beginner").onclick = () => this.startGame('beginner');
        document.getElementById("btn-medium").onclick = () => this.startGame('medium');
        document.getElementById("btn-hard").onclick = () => this.startGame('hard');
        document.getElementById("btn-2player").onclick = () => this.showPlayerSelectMenu();
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-settings").onclick = () => this._showSettingsScreen();
        document.getElementById("btn-debug").onclick = () => this.showPracticeMenu();
        document.getElementById("btn-exit-arcade").onclick = () => this.returnToArcade();
    }

    /**
     * Show player selection screen for multiplayer
     */
    showPlayerSelectMenu() {
        this.showPlayerSelect({
            onStart: (playerCount, mode, gunAssignments) => {
                // Reset players for new game
                this.players.resetGame(3);
                this.startGame('beginner'); // Start with beginner difficulty
            },
            onBack: () => this.showMenu()
        });
    }

    startGame(difficulty) {
        // Hide cursors for gameplay (SDK method)
        this.setInGame(true);
        
        // If single player, initialize with 1 player
        if (!this.isMultiplayer()) {
            this.players.initSession(1, { mode: 'single' });
            this.players.resetGame(3);
        }
        
        this.levelManager.isPracticeMode = false;
        this.levelManager.setDifficulty(difficulty);
        this.levelManager.startNextStage();
    }

    showHUD() {
        if (this.isMultiplayer()) {
            this.showMultiplayerHUD();
        } else {
            this.ui.hud.create({
                score: this.levelManager.score,
                lives: this.levelManager.lives
            });
        }
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

    showStageIntro(stageNum, objective, callback) {
        this.state = "INTRO";
        this.ui.overlay.showIntro({
            title: `STAGE ${stageNum}`,
            subtitle: objective,
            info: `LIVES: ${this.levelManager.lives}`,
            duration: 2000,
            onComplete: () => {
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
            const msg = success ? "STAGE CLEAR!" : "LIFE LOST!";
            const color = success ? "#00ccff" : "#ff0055";

            let statsHTML = '';
            // Show stats always (success or fail) as long as we have a game instance
            if (this.levelManager.currentGame) {
                const game = this.levelManager.currentGame;
                const bonuses = game.calculateBonuses();
                const accuracy = game.getAccuracy();
                const time = game.getCompletionTime();

                // Award bonuses
                const roundTotal = bonuses.total + game.stats.baseScore;
                this.levelManager.score += bonuses.total; // Add bonuses to global score (base score already added during game)

                statsHTML = `
            <div class="stats-breakdown">
              <div class="stat-row">
                <span>Base Score:</span>
                <span>${game.stats.baseScore}</span>
              </div>
              <div class="stat-row">
                <span>Difficulty (${game.difficulty.toUpperCase()}):</span>
                <span>x${game.scoreMultiplier}</span>
              </div>
              <div class="stat-row">
                <span>Accuracy (${accuracy.toFixed(1)}%):</span>
                <span>+${bonuses.accuracy}</span>
              </div>
              <div class="stat-row">
                <span>Pinpoint (${bonuses.pinpointPercent.toFixed(1)}%):</span>
                <span>+${bonuses.pinpoint}</span>
              </div>
              <div class="stat-row">
                <span>Speed Bonus:</span>
                <span>+${bonuses.speed}</span>
              </div>
              
              <div class="stat-divider" style="margin: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.3);"></div>

              <div class="stat-row total" style="font-size: 1.2em; color: #ffff00;">
                <span>ROUND SCORE:</span>
                <span>${roundTotal}</span>
              </div>
              <div class="stat-row total" style="font-size: 1.4em; color: #00ff00; margin-top: 5px;">
                <span>TOTAL SCORE:</span>
                <span>${this.levelManager.score}</span>
              </div>

              <div class="stat-info">
                ${game.stats.hits}/${game.stats.shots} hits • ${time.toFixed(1)}s
              </div>
            </div>
          `;
            }

            this.uiLayer.innerHTML = `
            <div class="screen result" style="border-color: ${color}">
                <h1 style="color: ${color}">${msg}</h1>
                ${statsHTML}
                <button id="btn-next" style="margin-top: 20px;">NEXT</button>
            </div>
        `;

            const btnNext = document.getElementById('btn-next');
            if (btnNext) {
                btnNext.onclick = () => {
                    callback();
                };
                btnNext.focus();
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
        
        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>CONGRATULATIONS!</h1>
                <h2>ALL STAGES CLEARED</h2>
                <h3>FINAL SCORE: ${finalScore}</h3>
                <button id="btn-highscores">HIGH SCORES</button>
                <button id="btn-menu">MENU</button>
            </div>
        `;
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-menu").onclick = () => this.showMenu();
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
        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>PRACTICE MODE</h1>
                <h3>Select Mini-Game & Difficulty</h3>
                
                <div class="debug-grid">
                    <div class="debug-section">
                        <h4>Classic Target</h4>
                        <button class="debug-btn" data-game="ClassicTarget" data-diff="beginner">Beginner</button>
                        <button class="debug-btn" data-game="ClassicTarget" data-diff="medium">Medium</button>
                        <button class="debug-btn" data-game="ClassicTarget" data-diff="hard">Hard</button>
                    </div>
                    
                    <div class="debug-section">
                        <h4>Color Match</h4>
                        <button class="debug-btn" data-game="ColorMatch" data-diff="beginner">Beginner</button>
                        <button class="debug-btn" data-game="ColorMatch" data-diff="medium">Medium</button>
                        <button class="debug-btn" data-game="ColorMatch" data-diff="hard">Hard</button>
                    </div>
                    
                    <div class="debug-section">
                        <h4>Bomb Panic</h4>
                        <button class="debug-btn" data-game="BombPanic" data-diff="beginner">Beginner</button>
                        <button class="debug-btn" data-game="BombPanic" data-diff="medium">Medium</button>
                        <button class="debug-btn" data-game="BombPanic" data-diff="hard">Hard</button>
                    </div>
                    
                    <div class="debug-section">
                        <h4>Quick Draw</h4>
                        <button class="debug-btn" data-game="QuickDraw" data-diff="beginner">Beginner</button>
                        <button class="debug-btn" data-game="QuickDraw" data-diff="medium">Medium</button>
                        <button class="debug-btn" data-game="QuickDraw" data-diff="hard">Hard</button>
                    </div>
                </div>
                
                <button id="btn-back">BACK TO MENU</button>
            </div>
        `;

        document.querySelectorAll('.debug-btn').forEach(btn => {
            btn.onclick = () => {
                const game = btn.dataset.game;
                const diff = btn.dataset.diff;
                this.startPracticeGame(game, diff);
            };
        });

        document.getElementById("btn-back").onclick = () => this.showMenu();
    }

    startPracticeGame(gameName, difficulty) {
        // Enable practice mode
        this.levelManager.isPracticeMode = true;

        // Import the game class dynamically
        import(`./minigames/${gameName}.js`).then(module => {
            const GameClass = module[gameName];

            // Reset state
            this.state = "PLAYING";
            this.levelManager.score = 0;
            this.levelManager.currentGame = new GameClass(this, difficulty);

            // Show simple UI
            this.uiLayer.innerHTML = `
                <div style="position: absolute; top: 20px; left: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                    PRACTICE: ${gameName} (${difficulty})
                </div>
                <div style="position: absolute; top: 20px; right: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                    SCORE: <span id="score-display">0</span>
                </div>
            `;

            this.levelManager.currentGame.start();
        });
    }
}
