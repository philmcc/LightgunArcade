import { BaseGame } from '../../arcade/interfaces/BaseGame.js';
import { RoundManager } from './RoundManager.js';
import { BackgroundManager } from './BackgroundManager.js';

export class Game extends BaseGame {
    constructor(canvas, uiLayer, system) {
        super(canvas, uiLayer, system);

        // SDK provides: this.input, this.sound, this.highScores, this.settings
        this.roundManager = new RoundManager(this);
        this.backgroundManager = new BackgroundManager();

        this.state = "MENU"; // MENU, MODE_SELECT, DIFFICULTY_SELECT, PLAYING, ROUND_INTRO, ROUND_RESULT, GAME_OVER
        this.lastTime = 0;

        // Particle effects
        this.hitEffects = [];

        // Dog laugh state
        this.showingDog = false;
        this.dogTimer = 0;
        this.dogDuration = 1.5;

        // Bind input via SDK-provided InputManager
        this.input.on("shoot", (coords) => this.handleShoot(coords));
    }

    static getManifest() {
        return {
            id: 'not-duck-hunt',
            name: 'Not Duck Hunt',
            version: '1.0.0',
            author: 'Lightgun Arcade',
            description: 'Classic shooting gallery inspired by the NES classic',
            isAvailable: true,
            modes: ['campaign', 'endless'],
            difficulties: ['normal'],
            multiplayer: {
                minPlayers: 1,
                maxPlayers: 2,
                supportedModes: [
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

    hidePauseMenu() {
        this.ui.overlay.hidePauseMenu();
    }

    // SDK handles resize via onResize() hook - no manual handling needed

    handleShoot({ x, y, gunIndex }) {
        if (this.state === "PLAYING") {
            this.sound.playShoot();
            
            // Get player index from gun (0 for single player/mouse)
            const playerIndex = this.getPlayerIndexFromGun(gunIndex);
            
            this.roundManager.handleShoot(x, y, playerIndex);
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


    hideDog() {
        // Implementation for hiding dog if it was a DOM element, 
        // but it seems the dog might be drawn on canvas in RoundManager?
        // If it's a DOM element:
        const dogEl = document.getElementById('dog-overlay');
        if (dogEl) dogEl.remove();
    }

    showMenu() {
        this.state = "MENU";
        // Show cursors for menu (SDK method)
        this.setInGame(false);
        this.uiLayer.innerHTML = `
      <div class="screen">
        <h1>NOT DUCK HUNT</h1>
        <div class="difficulty-select">
            <button id="btn-campaign" class="diff-btn">CAMPAIGN</button>
            <button id="btn-endless" class="diff-btn">ENDLESS</button>
        </div>
        <div style="margin-top: 15px;">
            <button id="btn-2player" class="btn-primary">2 PLAYER CO-OP</button>
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
        document.getElementById("btn-2player").onclick = () => this.showPlayerSelectMenu();
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-settings").onclick = () => this._showSettingsScreen();
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
                this.startGame('campaign'); // Multiplayer uses campaign mode
            },
            onBack: () => this.showMenu()
        });
    }

    startGame(mode) {
        // Hide cursors for gameplay (SDK method)
        this.setInGame(true);
        
        // If single player, initialize with 1 player
        if (!this.isMultiplayer()) {
            this.players.initSession(1, { mode: 'single' });
            this.players.resetGame(3);
        }
        
        this.roundManager.startGame(mode);
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
                this.showMenu();
            },
            onQuitArcade: () => this.returnToArcade()
        });
    }

    /**
     * Internal method to show settings screen with proper back handling
     */
    _showSettingsScreen() {
        // Use SDK's showSettings with custom back handler
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
        
        // Use SDK high score display with custom badges for difficulty and mode
        this.ui.highScores.show({
            scores,
            onBack: () => this.showMenu(),
            badges: [
                { field: 'difficulty', format: (v) => v ? v.charAt(0).toUpperCase() : '-' },
                { field: 'gameMode', format: (v) => v === 'campaign' ? 'C' : 'E', color: '#00ccff' }
            ]
        });
    }

    showRoundIntro(roundNum, callback) {
        this.state = "ROUND_INTRO";
        this.ui.overlay.showIntro({
            title: `ROUND ${roundNum}`,
            subtitle: 'GET READY',
            info: `LIVES: ${this.roundManager.lives}`,
            duration: 2000,
            onComplete: () => {
                this.state = "PLAYING";
                this.setInGame(true);
                this.showHUD();
                callback();
            }
        });
    }

    showBonusRoundIntro(callback) {
        this.state = "ROUND_INTRO";
        this.ui.overlay.showIntro({
            title: 'BONUS ROUND',
            subtitle: 'SHOOT THE CLAY PIGEONS!',
            info: 'UNLIMITED AMMO',
            borderColor: '#ffd700',
            duration: 2000,
            onComplete: () => {
                this.state = "PLAYING";
                this.setInGame(true);
                this.showHUD();
                callback();
            }
        });
    }

    showRoundResult(success, hits, total, callback) {
        this.setInGame(false);
        this.state = "ROUND_RESULT";
        
        this.ui.overlay.showResult({
            success,
            stats: [
                { label: 'HITS:', value: `${hits} / ${total}` }
            ],
            autoAdvance: 2000,
            onNext: callback
        });
    }

    showBonusRoundResult(hits, callback) {
        this.setInGame(false);
        this.state = "ROUND_RESULT";
        const bonus = hits * 100;
        this.roundManager.score += bonus;

        // Custom result screen for bonus (SDK overlay doesn't have gold styling)
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
        if (this.isMultiplayer()) {
            // Use multiplayer HUD
            this.showMultiplayerHUD({
                round: `ROUND ${this.roundManager.currentRound}`,
                ammo: 3
            });
        } else {
            // Single player HUD
            this.ui.hud.create({
                score: this.roundManager.score,
                lives: this.roundManager.lives,
                round: `ROUND ${this.roundManager.currentRound}`,
                ammo: 3
            });
        }
    }

    updateAmmoDisplay(shots) {
        this.ui.hud.updateAmmo(shots);
    }

    updateScoreDisplay() {
        if (this.isMultiplayer()) {
            // Update all player HUDs
            this.players.players.forEach((player, index) => {
                this.updatePlayerHUD(index);
            });
        } else {
            this.ui.hud.update('score', this.roundManager.score);
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
        if (this.isMultiplayer()) {
            // Show multiplayer results
            this.showMultiplayerResults({
                cleared,
                onRetry: () => {
                    this.players.resetGame(3);
                    this.startGame(this.roundManager.gameMode);
                },
                onMenu: () => this.showMenu()
            });
        } else {
            // Single player - check high score
            const finalScore = this.roundManager.score;
            
            if (this.highScores.isHighScore(finalScore)) {
                this.showNameEntry(finalScore, cleared);
            } else {
                this.showGameOverScreen(finalScore, cleared);
            }
        }
    }

    showNameEntry(finalScore, cleared) {
        this.setInGame(false);
        
        this.ui.overlay.showNameEntry({
            score: finalScore,
            defaultName: this.getCurrentUser().name,
            onSubmit: (name) => {
                // Save to local game scores
                this.highScores.addScore(name, finalScore, this.roundManager.difficulty, this.roundManager.gameMode);
                // Save to global system scores
                this.saveGlobalScore(name, finalScore, this.roundManager.difficulty);
                this.showGameOverScreen(finalScore, cleared);
            }
        });
    }

    showGameOverScreen(finalScore, cleared) {
        this.setInGame(false);
        
        this.ui.overlay.showGameOver({
            cleared,
            score: finalScore,
            onRetry: () => this.startGame(this.roundManager.gameMode),
            onMenu: () => this.showMenu()
        });
    }
}
