import { Settings } from '../../shared/Settings.js';
import { InputManager } from '../../shared/InputManager.js';
import { SoundManager } from '../../shared/SoundManager.js';
import { HighScoreManager } from './HighScoreManager.js';
import { LevelManager } from './LevelManager.js';

export class Game {
    constructor(canvas, uiLayer, arcade) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;
        this.arcade = arcade;
        this.ctx = this.canvas.getContext("2d");

        this.settings = arcade.settings;
        this.input = new InputManager(this.canvas);
        this.sound = new SoundManager();
        this.levelManager = new LevelManager(this);
        this.highScores = new HighScoreManager();

        this.state = "MENU"; // MENU, PLAYING, GAMEOVER, INTRO, RESULT
        this.lastTime = 0;

        // Resize handling
        window.addEventListener("resize", () => this.resize());
        this.resize();

        // Bind input
        this.input.on("shoot", (coords) => this.handleShoot(coords));

        // Bind ESC key for pause
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && (this.state === "PLAYING" || this.state === "PAUSED")) {
                this.togglePause();
            }
        });

        // Start loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        this.showMenu();
    }

    togglePause() {
        if (this.state === "PLAYING") {
            this.state = "PAUSED";
            this.showPauseMenu();
        } else if (this.state === "PAUSED") {
            this.state = "PLAYING";
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
            this.arcade.returnToArcade();
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

    draw() {
        // Clear background
        this.ctx.fillStyle = "#222";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === "PLAYING") {
            this.levelManager.draw(this.ctx);
        }
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }

    showMenu() {
        this.state = "MENU";
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>POINT BLANK WEB</h1>
        <div class="difficulty-select">
            <button id="btn-beginner" class="diff-btn">BEGINNER<br><span class="sub">4 STAGES</span></button>
            <button id="btn-medium" class="diff-btn">MEDIUM<br><span class="sub">8 STAGES</span></button>
            <button id="btn-hard" class="diff-btn">HARD<br><span class="sub">12 STAGES</span></button>
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
        document.getElementById("btn-exit-arcade").onclick = () => this.arcade.returnToArcade();
    }

    startGame(difficulty) {
        this.levelManager.isPracticeMode = false;
        this.levelManager.setDifficulty(difficulty);
        this.levelManager.startNextStage();
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
            this.uiLayer.innerHTML = `
            <div style="position: absolute; top: 20px; left: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                SCORE: <span id="score-display">${this.levelManager.score}</span>
            </div>
            <div style="position: absolute; top: 20px; right: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                LIVES: ${this.levelManager.lives}
            </div>
        `;
            callback();
        }, 2000);
    }

    showStageResult(success, callback) {
        this.state = "RESULT";
        const msg = success ? "STAGE CLEAR!" : "LIFE LOST!";
        const color = success ? "#00ccff" : "#ff0055";

        let statsHTML = '';
        // Show stats if success OR if in practice mode (even if failed)
        if ((success || this.levelManager.isPracticeMode) && this.levelManager.currentGame) {
            const game = this.levelManager.currentGame;
            const bonuses = game.calculateBonuses();
            const accuracy = game.getAccuracy();
            const time = game.getCompletionTime();

            // Award bonuses
            this.levelManager.score += bonuses.total;

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
          <div class="stat-row total">
            <span>Stage Total:</span>
            <span>${game.stats.baseScore + bonuses.total}</span>
          </div>
          <div class="stat-info">
            ${game.stats.hits}/${game.stats.shots} hits • ${time.toFixed(1)}s
          </div>
        </div>
      `;
        }

        this.uiLayer.innerHTML += `
        <div class="screen result" style="border-color: ${color}">
            <h1 style="color: ${color}">${msg}</h1>
            ${statsHTML}
            <button id="btn-next" style="margin-top: 20px;">NEXT</button>
        </div>
    `;

        const btnNext = document.getElementById('btn-next');
        btnNext.onclick = () => {
            callback();
        };
        btnNext.focus();
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
            this.arcade.globalHighScores.addScore('point-gun', name, finalScore, this.levelManager.difficulty);
            this.showGameClearScreen(finalScore);
        };

        document.getElementById("btn-submit").onclick = submitScore;
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") submitScore();
        });
    }

    showGameClearScreen(finalScore) {
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
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>GAME OVER</h1>
        <h2>SCORE: ${this.levelManager.score}</h2>
        <button id="btn-retry">RETRY</button>
        <button id="btn-menu">MENU</button>
      </div>
    `;

        document.getElementById("btn-retry").onclick = () => this.startGame(this.levelManager.difficulty);
        document.getElementById("btn-menu").onclick = () => this.showMenu();
    }

    showSettings() {
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h2>SETTINGS</h2>
        
        <div class="setting-row">
            <label>Input Method:</label>
            <select id="input-select">
                <option value="mouse">Mouse / Touch</option>
                <option value="gun4ir">Gun4IR</option>
                <option value="sinden">Sinden Lightgun</option>
            </select>
        </div>

        <div id="sinden-options" class="${this.settings.inputMethod === 'sinden' ? '' : 'hidden'}">
            <div class="setting-row">
                <label>Border Enabled:</label>
                <input type="checkbox" id="sinden-check" ${this.settings.sindenEnabled ? 'checked' : ''}>
            </div>
            <div class="setting-row">
                <label>Border Thickness:</label>
                <input type="range" id="sinden-thick" min="1" max="50" value="${this.settings.sindenThickness}">
            </div>
            <div class="setting-row">
                <label>Border Color:</label>
                <input type="color" id="sinden-color" value="${this.settings.sindenColor}">
            </div>
        </div>
        
        <div class="setting-row">
            <label>Fullscreen:</label>
            <input type="checkbox" id="fullscreen-check" ${this.settings.isFullscreen ? 'checked' : ''}>
        </div>
        
        <button id="btn-back">BACK</button>
      </div>
    `;

        const inputSelect = document.getElementById("input-select");
        const sindenOptions = document.getElementById("sinden-options");
        const sindenCheck = document.getElementById("sinden-check");
        const sindenThick = document.getElementById("sinden-thick");
        const sindenColor = document.getElementById("sinden-color");
        const fullscreenCheck = document.getElementById("fullscreen-check");

        inputSelect.value = this.settings.inputMethod;

        inputSelect.onchange = (e) => {
            this.settings.setInputMethod(e.target.value);
            if (e.target.value === 'sinden') {
                sindenOptions.classList.remove('hidden');
            } else {
                sindenOptions.classList.add('hidden');
            }
        };

        sindenCheck.onchange = (e) => this.settings.setSindenEnabled(e.target.checked);
        sindenThick.oninput = (e) => this.settings.setSindenThickness(e.target.value);
        sindenColor.oninput = (e) => this.settings.setSindenColor(e.target.value);
        fullscreenCheck.onchange = () => this.settings.toggleFullscreen();

        document.getElementById("btn-back").onclick = () => {
            if (this.state === "PAUSED_SETTINGS") {
                // Return to pause menu
                this.state = "PAUSED";
                this.showPauseMenu();
            } else {
                // Return to main menu
                this.showMenu();
            }
        };
    }

    showHighScores() {
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
