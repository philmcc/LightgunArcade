import { InputManager } from '../../shared/InputManager.js';
import { SoundManager } from '../../shared/SoundManager.js';
import { HighScoreManager } from './HighScoreManager.js';
import { RoundManager } from './RoundManager.js';
import { BackgroundManager } from './BackgroundManager.js';

export class Game {
    constructor(canvas, uiLayer, arcade) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;
        this.arcade = arcade;
        this.ctx = this.canvas.getContext("2d");

        this.settings = arcade.settings;
        this.input = new InputManager(this.canvas);
        this.sound = new SoundManager();
        this.roundManager = new RoundManager(this);
        this.highScores = new HighScoreManager();
        this.backgroundManager = new BackgroundManager();

        this.state = "MENU"; // MENU, MODE_SELECT, DIFFICULTY_SELECT, PLAYING, ROUND_INTRO, ROUND_RESULT, GAME_OVER
        this.lastTime = 0;

        // Particle effects
        this.hitEffects = [];

        // Dog laugh state
        this.showingDog = false;
        this.dogTimer = 0;
        this.dogDuration = 1.5;

        // Resize handling
        window.addEventListener("resize", () => this.resize());
        this.resize();

        // Bind input
        this.input.on("shoot", (coords) => this.handleShoot(coords));

        // Bind ESC key for pause
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.state === "PLAYING") {
                this.showPauseMenu();
            }
        });

        // Start loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        this.showMenu();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    handleShoot({ x, y }) {
        if (this.state === "PLAYING") {
            this.sound.playShoot();
            this.roundManager.handleShoot(x, y);
        }
    }

    update(dt) {
        if (this.state === "PLAYING") {
            this.roundManager.update(dt);
            this.updateScoreDisplay();
        }

        // Update hit effects
        for (let i = this.hitEffects.length - 1; i >= 0; i--) {
            const effect = this.hitEffects[i];
            effect.lifetime += dt;

            effect.particles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 300 * dt; // Gravity
                p.alpha = 1 - (effect.lifetime / effect.maxLifetime);
            });

            if (effect.lifetime >= effect.maxLifetime) {
                this.hitEffects.splice(i, 1);
            }
        }

        // Update dog laugh timer
        if (this.showingDog) {
            this.dogTimer += dt;
            if (this.dogTimer >= this.dogDuration) {
                this.showingDog = false;
                this.hideDog();
            }
        }
    }

    draw() {
        // Only draw game background when playing or in round-related states
        if (this.state === "PLAYING" || this.state === "ROUND_INTRO" || this.state === "ROUND_RESULT") {
            this.backgroundManager.draw(this.ctx, this.canvas.width, this.canvas.height);
        } else {
            // Clear with solid color for menu states
            this.ctx.fillStyle = "#222";
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.state === "PLAYING") {
            this.roundManager.draw(this.ctx);
            this.drawHitEffects();
        }
    }

    drawHitEffects() {
        this.hitEffects.forEach(effect => {
            effect.particles.forEach(p => {
                this.ctx.save();
                this.ctx.globalAlpha = p.alpha;
                this.ctx.fillStyle = '#ffd700';
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            });
        });
    }

    spawnHitEffect(x, y) {
        const particles = [];
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 150;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                size: 3 + Math.random() * 5,
                alpha: 1.0
            });
        }

        this.hitEffects.push({
            particles: particles,
            lifetime: 0,
            maxLifetime: 0.8
        });
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
        <h1>NOT DUCK HUNT</h1>
        <p style="font-size: 1.2rem; margin: 1rem 0; opacity: 0.8;">Classic Shooting Gallery</p>
        
        <button id="btn-start" style="font-size: 2rem; padding: 1.5rem 3rem;">START GAME</button>
        
        <div style="margin-top: 2rem;">
            <button id="btn-highscores">HIGH SCORES</button>
            <button id="btn-settings">SETTINGS</button>
            <button id="btn-exit-arcade" style="font-size: 0.8rem; margin-top: 10px; background: #444;">EXIT TO ARCADE</button>
        </div>
      </div>
    `;

        document.getElementById("btn-start").onclick = () => this.showModeSelect();
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-settings").onclick = () => this.showSettings();
        document.getElementById("btn-exit-arcade").onclick = () => this.arcade.returnToArcade();
    }

    showModeSelect() {
        this.state = "MODE_SELECT";
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h2>SELECT MODE</h2>
        <div class="difficulty-select" style="margin: 2rem 0;">
            <button id="btn-campaign" class="diff-btn">
                CAMPAIGN
                <div class="sub">10 Rounds</div>
            </button>
            <button id="btn-endless" class="diff-btn">
                ENDLESS
                <div class="sub">Until Game Over</div>
            </button>
        </div>
        <button id="btn-back">BACK</button>
      </div>
    `;

        document.getElementById("btn-campaign").onclick = () => {
            this.roundManager.setGameMode('campaign');
            this.showDifficultySelect();
        };
        document.getElementById("btn-endless").onclick = () => {
            this.roundManager.setGameMode('endless');
            this.showDifficultySelect();
        };
        document.getElementById("btn-back").onclick = () => this.showMenu();
    }

    showDifficultySelect() {
        this.state = "DIFFICULTY_SELECT";
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h2>SELECT DIFFICULTY</h2>
        <div class="difficulty-select">
            <button id="btn-beginner" class="diff-btn">
                BEGINNER
                <div class="sub">6/10 targets to pass</div>
            </button>
            <button id="btn-medium" class="diff-btn">
                MEDIUM
                <div class="sub">7/10 targets | 1-2 at once</div>
            </button>
            <button id="btn-hard" class="diff-btn">
                HARD
                <div class="sub">8/10 targets | 2-3 at once</div>
            </button>
        </div>
        <button id="btn-back">BACK</button>
      </div>
    `;

        document.getElementById("btn-beginner").onclick = () => this.startGame('beginner');
        document.getElementById("btn-medium").onclick = () => this.startGame('medium');
        document.getElementById("btn-hard").onclick = () => this.startGame('hard');
        document.getElementById("btn-back").onclick = () => this.showModeSelect();
    }

    startGame(difficulty) {
        this.roundManager.setDifficulty(difficulty);
        this.roundManager.score = 0;
        this.roundManager.currentRound = 0;
        this.roundManager.lives = 3;
        this.roundManager.startNewRound();
    }

    showRoundIntro(roundNumber, callback) {
        this.state = "ROUND_INTRO";
        this.backgroundManager.setForRound(roundNumber);

        const bgName = this.backgroundManager.getCurrentBackground().name;

        this.uiLayer.innerHTML = `
        <div class="screen intro">
            <h1>ROUND ${roundNumber}</h1>
            <p style="font-size: 1.5rem; margin: 1rem 0;">${bgName}</p>
            <div class="lives">SCORE: ${this.roundManager.score} | LIVES: ${this.roundManager.lives}</div>
        </div>
    `;

        setTimeout(() => {
            try {
                this.showHUD();
                this.state = "PLAYING";
                callback();
            } catch (e) {
                console.error("Error starting round:", e);
                // Fallback to menu if error occurs
                this.showMenu();
            }
        }, 2000);
    }

    showBonusRoundIntro(callback) {
        this.state = "ROUND_INTRO";
        this.uiLayer.innerHTML = `
        <div class="screen intro" style="border-color: #ffd700;">
            <h1 style="color: #ffd700;">BONUS ROUND!</h1>
            <p style="font-size: 1.8rem;">Clay Pigeon Shooting</p>
            <p style="font-size: 1.2rem; margin-top: 1rem; opacity: 0.8;">No penalty for misses!</p>
        </div>
    `;

        setTimeout(() => {
            this.showHUD();
            this.state = "PLAYING";
            callback();
        }, 2500);
    }

    showHUD() {
        this.uiLayer.innerHTML = `
            <div style="position: absolute; top: 20px; left: 20px; font-size: 28px; color: #fff; font-weight: bold; text-shadow: 2px 2px 4px #000;">
                SCORE: <span id="score-display">${this.roundManager.score}</span>
            </div>
            <div style="position: absolute; top: 20px; right: 20px; font-size: 28px; color: #fff; font-weight: bold; text-shadow: 2px 2px 4px #000;">
                ROUND: ${this.roundManager.currentRound}
            </div>
            <div id="ammo-display" style="position: absolute; top: 70px; right: 20px; display: flex; gap: 10px;">
                ${this.getAmmoHTML(3)}
            </div>
            
            <!-- Round Progress Indicator -->
            <div id="round-progress" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 20px;">
                ${this.getProgressHTML()}
            </div>

            <div id="dog-container" style="position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%); display: none;">
            </div>
        `;
    }

    getAmmoHTML(count) {
        let html = '';
        for (let i = 0; i < 3; i++) {
            if (i < count) {
                html += `<div style="width: 30px; height: 30px; background: #ff6600; border-radius: 50%; border: 3px solid #fff;"></div>`;
            } else {
                html += `<div style="width: 30px; height: 30px; background: #333; border-radius: 50%; border: 3px solid #666;"></div>`;
            }
        }
        return html;
    }

    getProgressHTML() {
        let html = '';
        const total = this.roundManager.targetsPerRound;
        const hits = this.roundManager.targetsHit;
        const misses = this.roundManager.targetsMissed;
        const current = hits + misses;

        for (let i = 0; i < total; i++) {
            let color = '#fff'; // Pending
            let icon = '⚪';
            let extraStyle = '';

            if (i < hits) {
                color = '#00ff00'; // Hit
                icon = '🦆';
            } else if (i < hits + misses) {
                color = '#ff0000'; // Miss
                icon = '❌';
            } else if (i === current) {
                // Current active target
                color = '#ffff00'; // Yellow
                icon = '🎯';
                extraStyle = 'transform: scale(1.3); box-shadow: 0 0 10px #ffff00; border-color: #ffff00; z-index: 10;';
            }

            html += `<div style="width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: ${color}; border-radius: 50%; border: 2px solid #000; font-size: 16px; transition: all 0.2s; ${extraStyle}">${icon}</div>`;
        }
        return html;
    }

    updateAmmoDisplay(count) {
        const ammoDisplay = document.getElementById('ammo-display');
        if (ammoDisplay) {
            ammoDisplay.innerHTML = this.getAmmoHTML(count);
        }
    }

    updateScoreDisplay() {
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) {
            scoreDisplay.textContent = this.roundManager.score;
        }

        // Also update progress
        const progressDisplay = document.getElementById('round-progress');
        if (progressDisplay) {
            progressDisplay.innerHTML = this.getProgressHTML();
        }
    }

    showDogLaugh() {
        this.showingDog = true;
        this.dogTimer = 0;

        const dogContainer = document.getElementById('dog-container');
        if (dogContainer) {
            dogContainer.style.display = 'block';
            dogContainer.innerHTML = `
                <div style="background: rgba(0,0,0,0.8); padding: 2rem; border-radius: 1rem; border: 3px solid #ff0055;">
                    <div style="font-size: 4rem;">🐕</div>
                    <p style="font-size: 1.5rem; color: #ff0055; font-weight: bold; margin-top: 0.5rem;">HA HA HA!</p>
                </div>
            `;
        }

        // Play laugh sound (placeholder - will add to SoundManager)
        // this.sound.playDogLaugh();
    }

    hideDog() {
        const dogContainer = document.getElementById('dog-container');
        if (dogContainer) {
            dogContainer.style.display = 'none';
        }
    }

    showRoundResult(success, targetsHit, targetsTotal, callback) {
        this.state = "ROUND_RESULT";
        const msg = success ? "ROUND CLEAR!" : "ROUND FAILED!";
        const color = success ? "#00ff00" : "#ff0055";

        this.uiLayer.innerHTML = `
            <div class="screen result" style="border-color: ${color}">
                <h1 style="color: ${color}">${msg}</h1>
                <div style="font-size: 2rem; margin: 2rem 0;">
                    Targets Hit: ${targetsHit} / ${targetsTotal}
                </div>
                <div style="font-size: 1.5rem; margin: 1rem 0;">
                    Score: ${this.roundManager.score}
                </div>
                ${!success && this.roundManager.gameMode === 'endless' ?
                `<div style="font-size: 1.3rem; color: #ff0055;">Lives Remaining: ${this.roundManager.lives}</div>` :
                ''
            }
                <button id="btn-continue" style="margin-top: 2rem;">CONTINUE</button>
            </div>
        `;

        document.getElementById('btn-continue').onclick = () => callback();
    }

    showBonusRoundResult(targetsHit, callback) {
        this.state = "ROUND_RESULT";
        const bonusScore = targetsHit * 250;

        this.uiLayer.innerHTML = `
            <div class="screen result" style="border-color: #ffd700">
                <h1 style="color: #ffd700">BONUS ROUND COMPLETE!</h1>
                <div style="font-size: 2rem; margin: 2rem 0;">
                    Clay Pigeons Hit: ${targetsHit} / 15
                </div>
                <div style="font-size: 1.8rem; color: #ffd700; margin: 1rem 0;">
                    Bonus Points: +${bonusScore}
                </div>
                <div style="font-size: 1.5rem;">
                    Total Score: ${this.roundManager.score}
                </div>
                <button id="btn-continue" style="margin-top: 2rem;">CONTINUE</button>
            </div>
        `;

        document.getElementById('btn-continue').onclick = () => callback();
    }

    gameClear() {
        this.state = "GAME_OVER";
        this.sound.playGameOver();
        const finalScore = this.roundManager.score;

        if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore, true);
        } else {
            this.showGameClearScreen(finalScore);
        }
    }

    gameOver() {
        this.state = "GAME_OVER";
        this.sound.playGameOver();
        const finalScore = this.roundManager.score;

        if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore, false);
        } else {
            this.showGameOverScreen(finalScore);
        }
    }

    showNameEntry(finalScore, isGameClear) {
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
            this.highScores.addScore(name, finalScore, this.roundManager.difficulty, this.roundManager.gameMode);
            this.arcade.globalHighScores.addScore('not-duck-hunt', name, finalScore, this.roundManager.difficulty);

            if (isGameClear) {
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
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1 style="color: #00ff00;">GAME CLEAR!</h1>
        <h2>ALL ROUNDS COMPLETE</h2>
        <h3>FINAL SCORE: ${finalScore}</h3>
        <button id="btn-highscores">HIGH SCORES</button>
        <button id="btn-menu">MENU</button>
      </div>
    `;
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-menu").onclick = () => this.showMenu();
    }

    showGameOverScreen(finalScore) {
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>GAME OVER</h1>
        <h2>SCORE: ${finalScore}</h2>
        <h3>Round Reached: ${this.roundManager.currentRound}</h3>
        <button id="btn-retry">PLAY AGAIN</button>
        <button id="btn-menu">MENU</button>
      </div>
    `;

        document.getElementById("btn-retry").onclick = () => this.showModeSelect();
        document.getElementById("btn-menu").onclick = () => this.showMenu();
    }

    showPauseMenu() {
        const pauseOverlay = document.createElement('div');
        pauseOverlay.id = 'pause-overlay';
        pauseOverlay.innerHTML = `
      <div class="screen pause-menu">
        <h1>PAUSED</h1>
        <button id="btn-resume">RESUME</button>
        <button id="btn-quit">QUIT TO MENU</button>
        <button id="btn-arcade-quit">QUIT TO ARCADE</button>
      </div>
    `;
        this.uiLayer.appendChild(pauseOverlay);

        document.getElementById("btn-resume").onclick = () => {
            pauseOverlay.remove();
            this.state = "PLAYING";
        };
        document.getElementById("btn-quit").onclick = () => {
            pauseOverlay.remove();
            this.showMenu();
        };
        document.getElementById("btn-arcade-quit").onclick = () => {
            this.arcade.returnToArcade();
        };
    }

    showSettings() {
        // Reuse the same settings from the arcade
        this.arcade.showSettings();
    }

    showHighScores() {
        const scores = this.highScores.getScores();

        let scoresHTML = '';
        if (scores.length === 0) {
            scoresHTML = '<div class="no-scores">No high scores yet! Start playing!</div>';
        } else {
            scoresHTML = '<div class="highscore-table">';
            scores.forEach((score, index) => {
                const diffBadge = score.difficulty.charAt(0).toUpperCase();
                const modeBadge = score.gameMode === 'campaign' ? 'C' : 'E';
                scoresHTML += `
                    <div class="score-row ${index < 3 ? 'top-three' : ''}">
                        <span class="rank">${index + 1}</span>
                        <span class="name" style="flex: 2; text-align: left;">${score.name}</span>
                        <span class="score">${score.score}</span>
                        <span class="diff-badge">${diffBadge}</span>
                        <span class="diff-badge" style="background: #00ccff; margin-left: 5px;">${modeBadge}</span>
                    </div>
                `;
            });
            scoresHTML += '</div>';
        }

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>HIGH SCORES</h1>
                ${scoresHTML}
                <div style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.7;">
                    C = Campaign | E = Endless
                </div>
                <button id="btn-back">BACK</button>
            </div>
        `;

        document.getElementById("btn-back").onclick = () => this.showMenu();
    }
}
