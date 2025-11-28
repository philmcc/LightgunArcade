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
        
        // Floating score texts
        this.floatingScores = [];

        // Dog laugh state
        this.showingDog = false;
        this.dogTimer = 0;
        this.dogDuration = 1.5;
        
        // Combo display state
        this.comboDisplay = {
            combo: 0,
            multiplier: 1,
            timer: 0,
            maxTimer: 2.0
        };
        
        // Single player gun tracking
        this.activeGunIndex = -1; // -1 = mouse, 0+ = gun index
        this.lastInputGunIndex = -1; // Track last input for starting game
        
        // Multiplayer mode
        this.multiplayerMode = 'coop'; // 'coop', 'versus', 'duel'

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
                    { id: 'coop', name: 'Co-op', type: 'cooperative', simultaneous: true },
                    { id: 'versus', name: 'Versus', type: 'competitive', simultaneous: true },
                    { id: 'duel', name: 'Duel', type: 'competitive', simultaneous: true }
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
        // Track last input gun for single player game start
        this.lastInputGunIndex = gunIndex;
        
        if (this.state === "PLAYING") {
            // In single player, only the active gun can play
            if (!this.isMultiplayer() && this.activeGunIndex !== gunIndex) {
                // Wrong gun - ignore input
                return;
            }
            
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
        
        // Update floating scores
        for (let i = this.floatingScores.length - 1; i >= 0; i--) {
            const fs = this.floatingScores[i];
            fs.lifetime += dt;
            fs.y -= 60 * dt; // Float upward
            fs.alpha = 1 - (fs.lifetime / fs.maxLifetime);
            
            if (fs.lifetime >= fs.maxLifetime) {
                this.floatingScores.splice(i, 1);
            }
        }
        
        // Update combo display timer
        if (this.comboDisplay.timer > 0) {
            this.comboDisplay.timer -= dt;
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
            this.drawFloatingScores(ctx);
            this.drawComboDisplay(ctx);
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

    drawFloatingScores(ctx) {
        this.floatingScores.forEach(fs => {
            ctx.save();
            ctx.globalAlpha = fs.alpha;
            ctx.font = `bold ${fs.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw shadow
            ctx.fillStyle = '#000';
            ctx.fillText(fs.text, fs.x + 2, fs.y + 2);
            
            // Draw text
            ctx.fillStyle = fs.color;
            ctx.fillText(fs.text, fs.x, fs.y);
            
            // Draw bonus text if any
            if (fs.bonusText) {
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#ffd700';
                ctx.fillText(fs.bonusText, fs.x, fs.y - 25);
            }
            
            ctx.restore();
        });
    }

    drawComboDisplay(ctx) {
        if (this.comboDisplay.combo < 2 || this.comboDisplay.timer <= 0) return;
        
        ctx.save();
        
        // Position in top-center area
        const x = this.canvas.width / 2;
        const y = 80;
        
        // Fade based on timer
        const alpha = Math.min(1, this.comboDisplay.timer / 0.5);
        ctx.globalAlpha = alpha;
        
        // Draw combo text
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow
        ctx.fillStyle = '#000';
        ctx.fillText(`COMBO x${this.comboDisplay.combo}`, x + 2, y + 2);
        
        // Main text - color based on multiplier
        let comboColor = '#fff';
        if (this.comboDisplay.multiplier >= 4) comboColor = '#ff00ff';
        else if (this.comboDisplay.multiplier >= 3) comboColor = '#ff0000';
        else if (this.comboDisplay.multiplier >= 2) comboColor = '#ffa500';
        else if (this.comboDisplay.multiplier >= 1.5) comboColor = '#ffff00';
        
        ctx.fillStyle = comboColor;
        ctx.fillText(`COMBO x${this.comboDisplay.combo}`, x, y);
        
        // Draw multiplier
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`${this.comboDisplay.multiplier}x POINTS`, x, y + 35);
        
        ctx.restore();
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
        <h3 style="color: #aaa; margin-bottom: 20px;">Enhanced Edition</h3>
        <div class="difficulty-select">
            <button id="btn-campaign" class="diff-btn">CAMPAIGN</button>
            <button id="btn-endless" class="diff-btn">ENDLESS</button>
        </div>
        <div style="margin-top: 20px;">
            <h4 style="color: #888; margin-bottom: 10px;">2 PLAYER MODES</h4>
            <div class="difficulty-select">
                <button id="btn-coop" class="diff-btn" style="background: #226622;">CO-OP</button>
                <button id="btn-versus" class="diff-btn" style="background: #662222;">VERSUS</button>
                <button id="btn-duel" class="diff-btn" style="background: #222266;">DUEL</button>
            </div>
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
        document.getElementById("btn-coop").onclick = () => this.showPlayerSelectMenu('coop');
        document.getElementById("btn-versus").onclick = () => this.showPlayerSelectMenu('versus');
        document.getElementById("btn-duel").onclick = () => this.showPlayerSelectMenu('duel');
        document.getElementById("btn-highscores").onclick = () => this.showHighScores();
        document.getElementById("btn-settings").onclick = () => this._showSettingsScreen();
        document.getElementById("btn-exit-arcade").onclick = () => this.returnToArcade();
    }

    /**
     * Show player selection screen for multiplayer
     * @param {string} multiplayerMode - 'coop', 'versus', or 'duel'
     */
    showPlayerSelectMenu(multiplayerMode = 'coop') {
        this.multiplayerMode = multiplayerMode;
        
        this.showPlayerSelect({
            minPlayers: 2, // Force 2 players since they selected a 2-player mode
            defaultPlayers: 2,
            onStart: (playerCount, mode, gunAssignments) => {
                // Set up the multiplayer mode
                const modeType = multiplayerMode === 'coop' ? 'coop' : 'versus';
                this.players.initSession(playerCount, { 
                    mode: modeType, 
                    simultaneous: true,
                    gunAssignments 
                });
                this.players.resetGame(3);
                this.startGame('campaign', multiplayerMode);
            },
            onBack: () => this.showMenu()
        });
    }

    startGame(mode, multiplayerMode = 'coop') {
        // Hide cursors for gameplay (SDK method)
        this.setInGame(true);
        
        // If single player, initialize with 1 player and lock to starting gun
        if (!this.isMultiplayer()) {
            this.players.initSession(1, { mode: 'single' });
            this.players.resetGame(3);
            multiplayerMode = 'single';
            
            // Lock to the gun that started the game
            this.activeGunIndex = this.lastInputGunIndex;
        } else {
            // Multiplayer - all guns active
            this.activeGunIndex = null; // null means all guns allowed
        }
        
        this.multiplayerMode = multiplayerMode;
        this.roundManager.startGame(mode, multiplayerMode);
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
        
        // Get mode-specific subtitle and info
        let subtitle = 'GET READY';
        let info = `LIVES: ${this.roundManager.lives}`;
        let borderColor = '#00ccff';
        
        // Show mode instructions on round 1
        if (roundNum === 1 && this.isMultiplayer()) {
            switch (this.multiplayerMode) {
                case 'coop':
                    subtitle = 'CO-OP MODE';
                    info = 'Work together! Shared lives, team score.';
                    borderColor = '#22aa22';
                    break;
                case 'versus':
                    subtitle = 'VERSUS MODE';
                    info = 'Race to hit targets! First hit gets the points!';
                    borderColor = '#aa2222';
                    break;
                case 'duel':
                    subtitle = 'DUEL MODE';
                    info = 'Shoot YOUR colored targets only!';
                    borderColor = '#2222aa';
                    break;
            }
        }
        
        // Show which gun is active in single player mode
        if (roundNum === 1 && !this.isMultiplayer()) {
            const gunLabel = this.activeGunIndex === -1 ? 'MOUSE' : `GUN ${this.activeGunIndex + 1}`;
            info = `${info} | Active: ${gunLabel}`;
        }
        
        this.ui.overlay.showIntro({
            title: `ROUND ${roundNum}`,
            subtitle: subtitle,
            info: info,
            borderColor: borderColor,
            duration: roundNum === 1 && this.isMultiplayer() ? 3000 : 2000, // Longer for instructions
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

    showRoundResult(success, hits, total, roundBonuses, callback) {
        this.setInGame(false);
        this.state = "ROUND_RESULT";
        
        // Build stats array with bonuses
        const stats = [
            { label: 'HITS:', value: `${hits} / ${total}` }
        ];
        
        // Add round bonuses if any
        if (roundBonuses && roundBonuses.bonuses.length > 0) {
            stats.push({ label: '---', value: '---' }); // Divider
            
            roundBonuses.bonuses.forEach(bonus => {
                const detail = bonus.detail ? ` (${bonus.detail})` : '';
                stats.push({ 
                    label: `${bonus.type}${detail}:`, 
                    value: `+${bonus.points}`,
                    color: '#ffd700'
                });
            });
            
            if (roundBonuses.totalBonus > 0) {
                stats.push({ 
                    label: 'ROUND BONUS:', 
                    value: `+${roundBonuses.totalBonus}`,
                    color: '#00ff00',
                    isTotal: true
                });
            }
        }
        
        // Add max combo if notable
        if (roundBonuses && roundBonuses.maxCombo >= 3) {
            stats.push({ 
                label: 'MAX COMBO:', 
                value: `x${roundBonuses.maxCombo}`,
                color: '#ff6600'
            });
        }
        
        // Show multiplayer scores at end of round
        if (this.isMultiplayer()) {
            this.showMultiplayerRoundResult(success, stats, roundBonuses, callback);
        } else {
            this.ui.overlay.showResult({
                success,
                stats,
                autoAdvance: 3000,
                onNext: callback
            });
        }
    }
    
    showMultiplayerRoundResult(success, stats, roundBonuses, callback) {
        const players = this.players.getFinalResults();
        const isVersus = this.players.isCompetitive();
        
        // Determine leader
        let leaderText = '';
        if (players.length >= 2) {
            if (players[0].score > players[1].score) {
                leaderText = `${players[0].name} LEADS!`;
            } else if (players[0].score === players[1].score) {
                leaderText = 'TIED!';
            }
        }
        
        const title = success ? 'ROUND CLEAR' : 'ROUND FAILED';
        const titleColor = success ? '#00ccff' : '#ff0055';
        
        let html = `
            <div class="screen result" style="border-color: ${titleColor}">
                <h1 style="color: ${titleColor}">${title}</h1>
                
                <div class="multiplayer-round-scores" style="display: flex; justify-content: center; gap: 40px; margin: 20px 0;">
        `;
        
        players.forEach((player, index) => {
            const isLeading = index === 0 && players[0].score > (players[1]?.score || 0);
            const borderStyle = isLeading ? `border: 3px solid ${player.colors.primary}; box-shadow: 0 0 10px ${player.colors.primary};` : '';
            
            html += `
                <div class="player-round-score" style="text-align: center; padding: 15px 25px; background: rgba(0,0,0,0.5); border-radius: 10px; ${borderStyle}">
                    <div style="color: ${player.colors.primary}; font-size: 1.2rem; font-weight: bold;">${player.name}</div>
                    <div style="font-size: 2rem; font-weight: bold; color: #fff;">${player.score}</div>
                    <div style="font-size: 0.9rem; color: #aaa;">${player.hits} hits | ${player.accuracy}%</div>
                </div>
            `;
        });
        
        html += `
                </div>
                
                ${leaderText ? `<div style="font-size: 1.5rem; color: #ffd700; margin: 10px 0;">${leaderText}</div>` : ''}
                
                <button id="btn-next" style="margin-top: 20px;">NEXT</button>
            </div>
        `;
        
        this.uiLayer.innerHTML = html;
        
        const btn = document.getElementById('btn-next');
        btn.onclick = callback;
        btn.focus();
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
            // Use multiplayer HUD with mode-specific config
            const hudConfig = {
                round: `ROUND ${this.roundManager.currentRound}`,
                ammo: 3
            };
            
            // Add mode indicator
            if (this.multiplayerMode === 'coop') {
                hudConfig.modeLabel = 'CO-OP';
                hudConfig.showTeamScore = true;
            } else if (this.multiplayerMode === 'versus') {
                hudConfig.modeLabel = 'VERSUS';
            } else if (this.multiplayerMode === 'duel') {
                hudConfig.modeLabel = 'DUEL';
            }
            
            this.showMultiplayerHUD(hudConfig);
            
            // Add team score display for co-op
            if (this.multiplayerMode === 'coop') {
                this.addTeamScoreDisplay();
            }
        } else {
            // Single player HUD
            this.ui.hud.create({
                score: this.roundManager.score,
                lives: this.roundManager.lives,
                round: `ROUND ${this.roundManager.currentRound}`,
                ammo: 3
            });
            
            // Add active gun indicator for single player
            this.addActiveGunIndicator();
        }
    }
    
    addActiveGunIndicator() {
        // Show which gun is active in single player
        const gunLabel = this.activeGunIndex === -1 ? 'MOUSE' : `GUN ${this.activeGunIndex + 1}`;
        const indicatorEl = document.createElement('div');
        indicatorEl.id = 'active-gun-indicator';
        indicatorEl.style.cssText = 'position: absolute; bottom: 20px; right: 20px; font-size: 14px; color: #888; font-weight: bold; text-shadow: 1px 1px 0 #000; padding: 5px 10px; background: rgba(0,0,0,0.5); border-radius: 5px;';
        indicatorEl.textContent = `🎯 ${gunLabel}`;
        this.uiLayer.appendChild(indicatorEl);
    }
    
    addTeamScoreDisplay() {
        // Add team score element to HUD for co-op mode
        const teamScoreEl = document.createElement('div');
        teamScoreEl.id = 'team-score-display';
        teamScoreEl.style.cssText = 'position: absolute; top: 50px; left: 50%; transform: translateX(-50%); font-size: 18px; color: #22ff22; font-weight: bold; text-shadow: 2px 2px 0 #000;';
        teamScoreEl.innerHTML = `TEAM SCORE: <span id="team-score">${this.roundManager.score}</span>`;
        
        const hud = document.getElementById('multiplayer-hud');
        if (hud) {
            hud.appendChild(teamScoreEl);
        }
    }

    updateAmmoDisplay(shots, playerIndex = null) {
        if (this.isMultiplayer() && playerIndex !== null) {
            // Update per-player ammo in multiplayer HUD
            this.updatePlayerAmmo(playerIndex, shots);
        } else {
            this.ui.hud.updateAmmo(shots);
        }
    }
    
    updatePlayerAmmo(playerIndex, shots) {
        // Update ammo display for specific player in multiplayer HUD
        const ammoEl = document.getElementById(`player-${playerIndex}-ammo`);
        if (ammoEl) {
            ammoEl.textContent = shots;
        }
    }

    updateScoreDisplay() {
        if (this.isMultiplayer()) {
            // Update all player HUDs
            this.players.players.forEach((player, index) => {
                this.updatePlayerHUD(index);
            });
            
            // Update team score in co-op mode
            if (this.multiplayerMode === 'coop') {
                const teamScoreEl = document.getElementById('team-score');
                if (teamScoreEl) {
                    teamScoreEl.textContent = this.roundManager.score;
                }
            }
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

    spawnHitEffect(x, y, scoringResult = null) {
        // Determine particle color based on scoring
        let particleColor = '#fff';
        let particleCount = 10;
        
        if (scoringResult) {
            if (scoringResult.isPerfect) {
                particleColor = '#ffd700'; // Gold for perfect
                particleCount = 15;
            } else if (scoringResult.comboMultiplier >= 2) {
                particleColor = '#ff6600'; // Orange for combo
                particleCount = 12;
            }
        }
        
        this.hitEffects.push({
            x: x,
            y: y,
            lifetime: 0,
            maxLifetime: 0.5,
            particles: Array.from({ length: particleCount }, () => ({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 250,
                vy: (Math.random() - 0.5) * 250,
                size: Math.random() * 4 + 2,
                color: particleColor,
                alpha: 1
            }))
        });
    }

    showFloatingScore(x, y, scoringResult, playerIndex = 0) {
        // Main score text
        let color = '#fff';
        let size = 24;
        
        // Handle negative scores (decoy penalty)
        const isNegative = scoringResult.totalPoints < 0;
        
        // In versus mode, use player color
        if (this.multiplayerMode === 'versus' && this.isMultiplayer() && !isNegative) {
            const player = this.players.getPlayer(playerIndex);
            if (player) {
                color = player.colors.primary;
                size = 28; // Slightly larger for emphasis
            }
        } else if (isNegative) {
            color = '#ff0000';
            size = 28;
        } else if (scoringResult.comboMultiplier >= 3) {
            color = '#ff0000';
            size = 32;
        } else if (scoringResult.comboMultiplier >= 2) {
            color = '#ffa500';
            size = 28;
        } else if (scoringResult.isPerfect) {
            color = '#ffd700';
            size = 28;
        }
        
        // Build bonus text
        let bonusText = '';
        if (scoringResult.bonuses && scoringResult.bonuses.length > 0) {
            bonusText = scoringResult.bonuses.map(b => b.type).join(' + ');
        }
        if (scoringResult.combo >= 3) {
            bonusText = bonusText ? `${bonusText} | x${scoringResult.combo}` : `COMBO x${scoringResult.combo}`;
        }
        
        // In versus mode, add player indicator
        let playerIndicator = '';
        if (this.multiplayerMode === 'versus' && this.isMultiplayer()) {
            playerIndicator = `P${playerIndex + 1} `;
        }
        
        // Format score text
        const scoreText = isNegative 
            ? `${scoringResult.totalPoints}` 
            : `${playerIndicator}+${scoringResult.totalPoints}`;
        
        this.floatingScores.push({
            x: x,
            y: y - 30,
            text: scoreText,
            bonusText: bonusText,
            color: color,
            size: size,
            lifetime: 0,
            maxLifetime: 1.2,
            alpha: 1
        });
    }

    // Called by RoundManager when combo updates
    onComboUpdate(combo, multiplier) {
        this.comboDisplay.combo = combo;
        this.comboDisplay.multiplier = multiplier;
        this.comboDisplay.timer = this.comboDisplay.maxTimer;
    }

    // Called by RoundManager when combo breaks
    onComboBreak(finalCombo) {
        // Could play a sound or show a "combo lost" message
        if (finalCombo >= 5) {
            // Show combo lost message briefly
            this.floatingScores.push({
                x: this.canvas.width / 2,
                y: 120,
                text: `COMBO LOST (x${finalCombo})`,
                bonusText: '',
                color: '#ff4444',
                size: 20,
                lifetime: 0,
                maxLifetime: 1.0,
                alpha: 1
            });
        }
        this.comboDisplay.combo = 0;
        this.comboDisplay.timer = 0;
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
