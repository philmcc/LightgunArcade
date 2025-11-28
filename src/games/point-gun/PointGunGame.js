import { BaseGame } from '../../arcade/interfaces/BaseGame.js';
import { InputManager } from '../../shared/InputManager.js';
import { SoundManager } from '../../shared/SoundManager.js';
import { HighScoreManager } from './HighScoreManager.js';
import { LevelManager } from './LevelManager.js';

export class Game extends BaseGame {
    constructor(canvas, uiLayer, system) {
        super(canvas, uiLayer, system);

        this.settings = system.settings;
        // Pass gunManager to InputManager for WebHID lightgun support
        this.input = new InputManager(this.canvas, system.gunManager);
        this.sound = new SoundManager();
        this.levelManager = new LevelManager(this);
        this.highScores = new HighScoreManager();

        this.state = "MENU"; // MENU, PLAYING, GAMEOVER, INTRO, RESULT
        this.lastTime = 0;

        // Resize handling
        this.resizeHandler = () => this.resize();
        window.addEventListener("resize", this.resizeHandler);
        this.resize();

        // Bind input
        this.input.on("shoot", (coords) => this.handleShoot(coords));

        // Bind Space key for pause
        this.keydownHandler = (e) => {
            if (e.code === "Space" && (this.state === "PLAYING" || this.state === "PAUSED")) {
                e.preventDefault(); // Prevent page scroll
                this.togglePause();
            }
        };
        window.addEventListener("keydown", this.keydownHandler);
        
        // Bind gun start button for pause
        this.startButtonHandler = (gunIndex) => {
            if (this.state === "PLAYING" || this.state === "PAUSED") {
                this.togglePause();
            }
        };
        this.system.gunManager.on('startButton', this.startButtonHandler);
    }

    static getManifest() {
        return {
            id: 'point-gun',
            name: 'Point Gun',
            description: 'Fast-paced target shooting',
            isAvailable: true
        };
    }

    async init() {
        this.showMenu();
    }

    destroy() {
        window.removeEventListener("resize", this.resizeHandler);
        window.removeEventListener("keydown", this.keydownHandler);
        this.system.gunManager.off('startButton', this.startButtonHandler);
        if (this.input && this.input.destroy) {
            this.input.destroy();
        }
    }

    togglePause() {
        if (this.state === "PLAYING") {
            this.state = "PAUSED";
            // Show cursors for pause menu
            this.system.gunManager.setInGame(false);
            this.showPauseMenu();
        } else if (this.state === "PAUSED") {
            this.state = "PLAYING";
            // Hide cursors for gameplay (respects user setting)
            this.system.gunManager.setInGame(true);
            this.hidePauseMenu();
        }
    }

    showPauseMenu() {
        const pauseOverlay = document.createElement('div');
        pauseOverlay.id = 'pause-overlay';
        pauseOverlay.innerHTML = `
      <div class="screen pause-menu">
        <h1>PAUSED</h1>
        <button id="btn-resume">RESUME</button>
        <button id="btn-pause-settings">SETTINGS</button>
        <button id="btn-quit">QUIT TO MENU</button>
        <button id="btn-arcade-quit">QUIT TO ARCADE</button>
      </div>
    `;
        this.uiLayer.appendChild(pauseOverlay);

        document.getElementById("btn-resume").onclick = () => this.togglePause();
        document.getElementById("btn-pause-settings").onclick = () => {
            this.state = "PAUSED_SETTINGS";
            this.showSettings();
        };
        document.getElementById("btn-quit").onclick = () => {
            this.state = "MENU";
            this.showMenu();
        };
        document.getElementById("btn-arcade-quit").onclick = () => {
            this.system.returnToArcade();
        };
    }

    hidePauseMenu() {
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay) {
            pauseOverlay.remove();
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    handleShoot({ x, y }) {
        if (this.state === "PLAYING") {
            this.sound.playShoot();
            this.levelManager.handleInput(x, y);
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
        // Show cursors for menu
        this.system.gunManager.setInGame(false);
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>POINT BLANK WEB</h1>
        <div class="difficulty-select">
            <button id="btn-beginner" class="diff-btn">BEGINNER</button>
            <button id="btn-medium" class="diff-btn">MEDIUM</button>
            <button id="btn-hard" class="diff-btn">HARD</button>
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
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-settings").onclick = () => this.showSettings();
        document.getElementById("btn-debug").onclick = () => this.showPracticeMenu();
        document.getElementById("btn-exit-arcade").onclick = () => this.system.returnToArcade();
    }

    startGame(difficulty) {
        // Hide cursors for gameplay (respects user setting)
        this.system.gunManager.setInGame(true);
        this.levelManager.isPracticeMode = false;
        this.levelManager.setDifficulty(difficulty);
        this.levelManager.startNextStage();
    }

    showHUD() {
        this.uiLayer.innerHTML = `
            <div style="position: absolute; top: 20px; left: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                SCORE: <span id="score-display">${this.levelManager.score}</span>
            </div>
            <div style="position: absolute; top: 20px; right: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                LIVES: ${this.levelManager.lives}
            </div>
        `;
    }

    showStageIntro(stageNum, objective, callback) {
        this.state = "INTRO";
        this.uiLayer.innerHTML = `
        <div class="screen intro">
            <h2>STAGE ${stageNum}</h2>
            <h1>${objective}</h1>
            <div class="lives">LIVES: ${this.levelManager.lives}</div>
        </div>
    `;

        setTimeout(() => {
            this.showHUD();
            callback();
        }, 2000);
    }

    showStageResult(success, callback) {
        try {
            this.state = "RESULT";
            // Show cursors for stage result screen
            this.system.gunManager.setInGame(false);
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

        if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore);
        } else {
            this.showGameClearScreen(finalScore);
        }
    }

    showNameEntry(finalScore) {
        // Show cursors for name entry screen
        this.system.gunManager.setInGame(false);
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>NEW HIGH SCORE!</h1>
        <h2>SCORE: ${finalScore}</h2>
        <div class="name-entry">
            <label>ENTER YOUR NAME:</label>
            <input type="text" id="player-name" maxlength="10" value="PLAYER" autocomplete="off">
        </div>
        <button id="btn-submit">SUBMIT</button>
      </div>
    `;

        const nameInput = document.getElementById("player-name");
        nameInput.focus();
        nameInput.select();

        const submitScore = () => {
            const name = nameInput.value.trim() || "PLAYER";
            this.highScores.addScore(name, finalScore, this.levelManager.difficulty);
            this.system.globalHighScores.addScore('point-gun', name, finalScore, this.levelManager.difficulty);
            // After submitting, check if it was game clear or game over
            if (this.levelManager.lives > 0) {
                this.showGameClearScreen(finalScore);
            } else {
                this.showGameOverScreen(finalScore);
            }
        };

        document.getElementById("btn-submit").onclick = submitScore;
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") submitScore();
        });
    }

    showGameClearScreen(finalScore) {
        // Show cursors for game clear screen
        this.system.gunManager.setInGame(false);
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

        if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore);
        } else {
            this.showGameOverScreen(finalScore);
        }
    }

    showGameOverScreen(finalScore) {
        // Show cursors for game over screen
        this.system.gunManager.setInGame(false);
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>GAME OVER</h1>
        <h2>SCORE: ${finalScore}</h2>
        <button id="btn-retry">RETRY</button>
        <button id="btn-menu">MENU</button>
      </div>
    `;

        document.getElementById("btn-retry").onclick = () => this.startGame(this.levelManager.difficulty);
        document.getElementById("btn-menu").onclick = () => this.showMenu();
    }

    showSettings() {
        // Show cursors for settings screen
        this.system.gunManager.setInGame(false);
        
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h2>SETTINGS</h2>
        
        <div class="setting-row">
            <label>Fullscreen:</label>
            <input type="checkbox" id="fullscreen-check" ${this.settings.isFullscreen ? 'checked' : ''}>
        </div>

        <div id="sinden-options">
            <div class="setting-row">
                <label>Sinden Border:</label>
                <input type="checkbox" id="sinden-check" ${this.settings.sindenEnabled ? 'checked' : ''}>
            </div>
            <div class="setting-row ${this.settings.sindenEnabled ? '' : 'hidden'}" id="sinden-thickness-row">
                <label>Border Thickness:</label>
                <input type="range" id="sinden-thick" min="1" max="50" value="${this.settings.sindenThickness}">
            </div>
            <div class="setting-row ${this.settings.sindenEnabled ? '' : 'hidden'}" id="sinden-color-row">
                <label>Border Color:</label>
                <input type="color" id="sinden-color" value="${this.settings.sindenColor}">
            </div>
        </div>
        
        <button id="btn-gun-setup" class="btn-primary" style="margin-top: 1rem;">GUN SETUP</button>
        <button id="btn-back">BACK</button>
      </div>
    `;

        const fullscreenCheck = document.getElementById("fullscreen-check");
        const sindenCheck = document.getElementById("sinden-check");
        const sindenThick = document.getElementById("sinden-thick");
        const sindenColor = document.getElementById("sinden-color");
        const sindenThicknessRow = document.getElementById("sinden-thickness-row");
        const sindenColorRow = document.getElementById("sinden-color-row");

        fullscreenCheck.onchange = (e) => this.settings.setFullscreen(e.target.checked);
        
        sindenCheck.onchange = (e) => {
            this.settings.setSindenEnabled(e.target.checked);
            if (e.target.checked) {
                sindenThicknessRow.classList.remove('hidden');
                sindenColorRow.classList.remove('hidden');
            } else {
                sindenThicknessRow.classList.add('hidden');
                sindenColorRow.classList.add('hidden');
            }
        };
        sindenThick.oninput = (e) => this.settings.setSindenThickness(e.target.value);
        sindenColor.oninput = (e) => this.settings.setSindenColor(e.target.value);

        document.getElementById("btn-gun-setup").onclick = () => {
            // Pass callback to return to settings after gun setup
            this.system.showGunSetup(() => {
                this.showSettings();
            });
        };

        document.getElementById("btn-back").onclick = () => {
            if (this.state === "PAUSED_SETTINGS") {
                // Return to pause menu
                this.state = "PAUSED";
                // Restore the game HUD first
                this.showHUD();
                // Then show the pause overlay
                this.showPauseMenu();
            } else {
                // Return to main menu
                this.showMenu();
            }
        };
    }

    showHighScores() {
        // Show cursors for high scores screen
        this.system.gunManager.setInGame(false);
        const scores = this.highScores.getScores();

        let scoresHTML = '';
        if (scores.length === 0) {
            scoresHTML = '<div class="no-scores">No high scores yet!</div>';
        } else {
            scoresHTML = '<div class="highscore-table">';
            scores.forEach((score, index) => {
                const diffBadge = score.difficulty.charAt(0).toUpperCase();
                scoresHTML += `
                    <div class="score-row ${index < 3 ? 'top-three' : ''}">
                        <span class="rank">${index + 1}</span>
                        <span class="name">${score.name}</span>
                        <span class="score">${score.score}</span>
                        <span class="diff-badge">${diffBadge}</span>
                    </div>
                `;
            });
            scoresHTML += '</div>';
        }

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>HIGH SCORES</h1>
                ${scoresHTML}
                <button id="btn-back">BACK</button>
            </div>
        `;

        document.getElementById("btn-back").onclick = () => this.showMenu();
    }

    showPracticeMenu() {
        // Show cursors for practice menu
        this.system.gunManager.setInGame(false);
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
