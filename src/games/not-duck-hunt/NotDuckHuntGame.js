import { BaseGame } from '../../arcade/interfaces/BaseGame.js';
import { InputManager } from '../../shared/InputManager.js';
import { SoundManager } from '../../shared/SoundManager.js';
import { HighScoreManager } from './HighScoreManager.js';
import { RoundManager } from './RoundManager.js';
import { BackgroundManager } from './BackgroundManager.js';

export class Game extends BaseGame {
    constructor(canvas, uiLayer, system) {
        super(canvas, uiLayer, system);

        this.settings = system.settings;
        // Pass gunManager to InputManager for WebHID lightgun support
        this.input = new InputManager(this.canvas, system.gunManager);
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
        this.resizeHandler = () => this.resize();
        window.addEventListener("resize", this.resizeHandler);
        this.resize();

        // Bind input
        this.input.on("shoot", (coords) => this.handleShoot(coords));

        // Bind ESC key for pause
        this.keydownHandler = (e) => {
            if (e.key === "Escape" && (this.state === "PLAYING" || this.state === "PAUSED")) {
                this.togglePause();
            }
        };
        window.addEventListener("keydown", this.keydownHandler);
    }

    static getManifest() {
        return {
            id: 'not-duck-hunt',
            name: 'Not Duck Hunt',
            description: 'Classic shooting gallery',
            isAvailable: true
        };
    }

    async init() {
        this.showMenu();
    }

    destroy() {
        window.removeEventListener("resize", this.resizeHandler);
        window.removeEventListener("keydown", this.keydownHandler);
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

    draw(ctx) {
        // Only draw game background when playing or in round-related states
        if (this.state === "PLAYING" || this.state === "PAUSED" || this.state === "ROUND_INTRO" || this.state === "ROUND_RESULT") {
            this.backgroundManager.draw(ctx, this.canvas.width, this.canvas.height);
        } else {
            // Clear with solid color for menu states
            ctx.fillStyle = "#222";
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.state === "PLAYING" || this.state === "PAUSED") {
            this.roundManager.draw(ctx);
            this.drawHitEffects(ctx);
        }
    }

    drawHitEffects(ctx) {
        this.hitEffects.forEach(effect => {
            effect.particles.forEach(p => {
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
        });
        ctx.globalAlpha = 1;
    }

    updateScoreDisplay() {
        const scoreEl = document.getElementById('score-display');
        if (scoreEl) {
            scoreEl.textContent = this.roundManager.score;
        }
    }

    hideDog() {
        // Implementation for hiding dog if it was a DOM element, 
        // but it seems the dog might be drawn on canvas in RoundManager?
        // If it's a DOM element:
        const dogEl = document.getElementById('dog-overlay');
        if (dogEl) dogEl.remove();
    }

    showMenu() {
        this.state = "MENU";
        // Show cursors for menu
        this.system.gunManager.setInGame(false);
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>NOT DUCK HUNT</h1>
        <div class="difficulty-select">
            <button id="btn-campaign" class="diff-btn">CAMPAIGN</button>
            <button id="btn-endless" class="diff-btn">ENDLESS</button>
        </div>
        <div style="margin-top: 20px;">
            <button id="btn-highscores">HIGH SCORES</button>
            <button id="btn-settings">SETTINGS</button>
            <button id="btn-exit-arcade" style="font-size: 0.8rem; margin-top: 10px; background: #444;">EXIT TO ARCADE</button>
        </div>
      </div>
    `;

        document.getElementById("btn-campaign").onclick = () => this.startGame('campaign');
        document.getElementById("btn-endless").onclick = () => this.startGame('endless');
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-settings").onclick = () => this.showSettings();
        document.getElementById("btn-exit-arcade").onclick = () => this.system.returnToArcade();
    }

    startGame(mode) {
        // Hide cursors for gameplay (respects user setting)
        this.system.gunManager.setInGame(true);
        this.roundManager.startGame(mode);
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
            this.togglePause();
        };
        document.getElementById("btn-quit").onclick = () => {
            this.hidePauseMenu();
            this.showMenu();
        };
        document.getElementById("btn-arcade-quit").onclick = () => {
            this.system.returnToArcade();
        };
    }

    showSettings() {
        this.system.showSettings();
    }

    showHighScores() {
        // Show cursors for high scores screen
        this.system.gunManager.setInGame(false);
        const scores = this.highScores.getScores();

        let scoresHTML = '';
        if (scores.length === 0) {
            scoresHTML = '<div class="no-scores">No high scores yet! Start playing!</div>';
        } else {
            scoresHTML = '<div class="highscore-table">';
            scores.forEach((score, index) => {
                const diffBadge = score.difficulty ? score.difficulty.charAt(0).toUpperCase() : '-';
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

    showRoundIntro(roundNum, callback) {
        this.state = "ROUND_INTRO";
        this.uiLayer.innerHTML = `
            <div class="screen intro">
                <h2>ROUND ${roundNum}</h2>
                <h1>GET READY</h1>
                <div class="lives">LIVES: ${this.roundManager.lives}</div>
            </div>
        `;
        setTimeout(() => {
            this.uiLayer.innerHTML = ''; // Clear intro
            this.state = "PLAYING"; // Set state to playing
            // Hide cursors for gameplay (respects user setting)
            this.system.gunManager.setInGame(true);
            this.showHUD();
            callback();
        }, 2000);
    }

    showBonusRoundIntro(callback) {
        this.state = "ROUND_INTRO";
        this.uiLayer.innerHTML = `
            <div class="screen intro" style="border-color: #ffd700;">
                <h2 style="color: #ffd700;">BONUS ROUND</h2>
                <h1>SHOOT THE CLAY PIGEONS!</h1>
                <div class="lives">UNLIMITED AMMO</div>
            </div>
        `;
        setTimeout(() => {
            this.uiLayer.innerHTML = '';
            this.state = "PLAYING"; // Set state to playing
            // Hide cursors for gameplay (respects user setting)
            this.system.gunManager.setInGame(true);
            this.showHUD();
            callback();
        }, 2000);
    }

    showRoundResult(success, hits, total, callback) {
        // Show cursors for round result screen
        this.system.gunManager.setInGame(false);
        this.state = "ROUND_RESULT";
        const msg = success ? "ROUND CLEAR" : "FAILED";
        const color = success ? "#00ccff" : "#ff0055";

        this.uiLayer.innerHTML = `
            <div class="screen result" style="border-color: ${color}">
                <h1 style="color: ${color}">${msg}</h1>
                <div class="stats-breakdown">
                    <div class="stat-row">
                        <span>HITS:</span>
                        <span>${hits} / ${total}</span>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            this.uiLayer.innerHTML = '';
            callback();
        }, 2000);
    }

    showBonusRoundResult(hits, callback) {
        // Show cursors for bonus result screen
        this.system.gunManager.setInGame(false);
        this.state = "ROUND_RESULT";
        const bonus = hits * 100;
        this.roundManager.score += bonus;

        this.uiLayer.innerHTML = `
            <div class="screen result" style="border-color: #ffd700;">
                <h1 style="color: #ffd700;">BONUS COMPLETE</h1>
                <div class="stats-breakdown">
                    <div class="stat-row">
                        <span>HITS:</span>
                        <span>${hits}</span>
                    </div>
                    <div class="stat-row total" style="color: #ffd700;">
                        <span>BONUS:</span>
                        <span>+${bonus}</span>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            this.uiLayer.innerHTML = '';
            callback();
        }, 2500);
    }

    showHUD() {
        this.uiLayer.innerHTML = `
            <div style="position: absolute; top: 20px; left: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                SCORE: <span id="score-display">${this.roundManager.score}</span>
            </div>
            <div style="position: absolute; top: 20px; right: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                LIVES: ${this.roundManager.lives}
            </div>
            <div style="position: absolute; top: 20px; left: 50%; transform: translateX(-50%); font-size: 20px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                ROUND ${this.roundManager.currentRound}
            </div>
            <div style="position: absolute; bottom: 20px; right: 20px; font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;">
                AMMO: <span id="ammo-display">III</span>
            </div>
        `;
    }

    updateAmmoDisplay(shots) {
        const ammoEl = document.getElementById('ammo-display');
        if (ammoEl) {
            ammoEl.textContent = 'I'.repeat(Math.max(0, shots));
        }
    }

    showDogLaugh() {
        this.showingDog = true;
        this.dogTimer = 0;
        this.sound.playDogLaugh();
        // Dog visual would be handled here if we had the asset/logic
        // For now just a text overlay
        const dogOverlay = document.createElement('div');
        dogOverlay.id = 'dog-overlay';
        dogOverlay.style.position = 'absolute';
        dogOverlay.style.bottom = '100px';
        dogOverlay.style.left = '50%';
        dogOverlay.style.transform = 'translateX(-50%)';
        dogOverlay.style.fontSize = '40px';
        dogOverlay.style.color = '#fff';
        dogOverlay.style.textShadow = '2px 2px 0 #000';
        dogOverlay.textContent = 'HA HA HA!';
        this.uiLayer.appendChild(dogOverlay);
    }

    spawnHitEffect(x, y) {
        this.hitEffects.push({
            x: x,
            y: y,
            lifetime: 0,
            maxLifetime: 0.5,
            particles: Array.from({ length: 10 }, () => ({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                size: Math.random() * 3 + 2,
                color: '#fff',
                alpha: 1
            }))
        });
    }

    gameClear() {
        this.state = "GAME_OVER";
        this.sound.playGameClear();
        this.handleGameOver(true);
    }

    gameOver() {
        this.state = "GAME_OVER";
        this.sound.playGameOver();
        this.handleGameOver(false);
    }

    handleGameOver(cleared) {
        const finalScore = this.roundManager.score;
        const difficulty = this.roundManager.difficulty;

        // Check local high score
        if (this.highScores.isHighScore(finalScore)) {
            this.showNameEntry(finalScore, cleared);
        } else {
            this.showGameOverScreen(finalScore, cleared);
        }
    }

    showNameEntry(finalScore, cleared) {
        // Show cursors for name entry screen
        this.system.gunManager.setInGame(false);
        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>NEW HIGH SCORE!</h1>
                <h2>SCORE: ${finalScore}</h2>
                <div class="name-entry">
                    <label>ENTER YOUR NAME:</label>
                    <input type="text" id="player-name" maxlength="10" value="${this.system.auth.getCurrentUser().name}" autocomplete="off">
                </div>
                <button id="btn-submit">SUBMIT</button>
            </div>
        `;

        const nameInput = document.getElementById("player-name");
        nameInput.focus();
        nameInput.select();

        const submitScore = () => {
            const name = nameInput.value.trim() || "PLAYER";
            // Save to local game scores
            this.highScores.addScore(name, finalScore, this.roundManager.difficulty, this.roundManager.gameMode);
            // Save to global system scores
            this.system.globalHighScores.addScore('not-duck-hunt', name, finalScore, this.roundManager.difficulty);

            this.showGameOverScreen(finalScore, cleared);
        };

        document.getElementById("btn-submit").onclick = submitScore;
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") submitScore();
        });
    }

    showGameOverScreen(finalScore, cleared) {
        // Show cursors for game over screen
        this.system.gunManager.setInGame(false);
        const title = cleared ? "ALL ROUNDS CLEARED!" : "GAME OVER";
        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>${title}</h1>
                <h2>SCORE: ${finalScore}</h2>
                <button id="btn-retry">RETRY</button>
                <button id="btn-menu">MENU</button>
            </div>
        `;

        document.getElementById("btn-retry").onclick = () => this.startGame(this.roundManager.gameMode);
        document.getElementById("btn-menu").onclick = () => this.showMenu();
    }
}
