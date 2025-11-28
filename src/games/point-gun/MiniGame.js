import { PlayerManager } from '../../arcade/core/PlayerManager.js';

export class MiniGame {
    constructor(game, difficulty) {
        this.game = game;
        this.difficulty = difficulty; // 'beginner', 'medium', 'hard'
        this.objective = "SHOOT THE TARGETS!";
        this.timeLimit = 30;
        this.isComplete = false;
        this.isFailed = false;
        
        // Time-based round system
        this.targetQuota = 10;      // Number of targets needed to pass
        this.targetsHit = 0;        // Current targets hit
        this.quotaReached = false;  // True when quota is met (but round continues)

        // Stats tracking
        this.stats = {
            shots: 0,
            hits: 0,
            misses: 0,
            startTime: 0,
            endTime: 0,
            baseScore: 0,
            totalAccuracyFactor: 0 // Sum of (1.0 = center, 0.5 = edge)
        };
        
        // Per-player stats for multiplayer
        this.playerStats = [
            { shots: 0, hits: 0, misses: 0, score: 0 },
            { shots: 0, hits: 0, misses: 0, score: 0 }
        ];

        // Score multiplier based on difficulty
        if (difficulty === 'beginner') {
            this.scoreMultiplier = 1.0;
        } else if (difficulty === 'medium') {
            this.scoreMultiplier = 2.0;
        } else {
            this.scoreMultiplier = 3.0;
        }

        // Background image
        this.backgroundImage = null;

        // Shared Particle System
        this.explosions = [];
        this.shotIndicators = [];
    }

    loadBackground(imagePath) {
        // Use SDK AssetLoader if available, otherwise fall back to direct loading
        if (this.game.assets) {
            this.game.assets.loadImage(imagePath).then(img => {
                this.backgroundImage = img;
            }).catch(err => {
                console.warn('Failed to load background via AssetLoader:', err);
                // Fallback to direct loading
                this.backgroundImage = new Image();
                this.backgroundImage.src = imagePath;
            });
        } else {
            this.backgroundImage = new Image();
            this.backgroundImage.src = imagePath;
        }
    }

    drawBackground(ctx) {
        if (this.backgroundImage && this.backgroundImage.complete) {
            // Draw background to fill canvas
            ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
        } else {
            // Fallback gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    };

    start() {
        // Initialize game state
        this.stats.startTime = Date.now();
        this.explosions = [];
        this.shotIndicators = [];
    }

    update(dt) {
        // Decrement time limit
        if (this.timeLimit > 0) {
            this.timeLimit -= dt;
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const ex = this.explosions[i];
            ex.lifetime += dt;
            if (ex.lifetime >= ex.maxLifetime) {
                this.explosions.splice(i, 1);
                continue;
            }

            // Update particles
            ex.particles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 500 * dt; // Gravity
                p.alpha = 1 - (ex.lifetime / ex.maxLifetime);
            });
        }

        // Update shot indicators
        for (let i = this.shotIndicators.length - 1; i >= 0; i--) {
            const ind = this.shotIndicators[i];
            ind.lifetime += dt;
            if (ind.lifetime >= 0.5) { // 0.5s duration
                this.shotIndicators.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Render game
    }

    drawParticles(ctx) {
        // Draw Explosions
        this.explosions.forEach(ex => {
            ex.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.fillStyle = ex.color;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        });

        // Draw Shot Indicators
        this.shotIndicators.forEach(ind => {
            ctx.save();
            ctx.globalAlpha = 1 - (ind.lifetime / 0.5);
            ctx.translate(ind.x, ind.y);

            // Bullet Hole / Laser Burn Effect
            const color = ind.color || '#00ccff'; // Default to Blue

            // 1. Outer Glow (Increased size by 50%: 20 -> 30)
            const gradient = ctx.createRadialGradient(0, 0, 7.5, 0, 0, 30);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();

            // 2. The Hole (Dark center) (Increased size by 50%: 6 -> 9)
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
            ctx.fill();

            // 3. Cracks / Jagged edges
            ctx.strokeStyle = color;
            ctx.lineWidth = 3; // Thicker lines
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const len = 12 + Math.random() * 12; // Longer cracks (8->12, 8->12)
                ctx.moveTo(Math.cos(angle) * 9, Math.sin(angle) * 9); // Start from edge of hole (6->9)
                ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
            }
            ctx.stroke();

            ctx.restore();
        });
    }

    handleInput(x, y, playerIndex = 0) {
        // Handle shots
        this.stats.shots++;
        
        // Track per-player stats
        if (this.playerStats[playerIndex]) {
            this.playerStats[playerIndex].shots++;
        }
        
        // Get player color for shot indicator (use SDK PlayerManager colors)
        const isMultiplayer = this.game.isMultiplayer && this.game.isMultiplayer();
        let color = '#00ccff'; // Default blue for single player
        
        if (isMultiplayer) {
            const playerColors = PlayerManager.PLAYER_COLORS[playerIndex];
            if (playerColors) {
                color = playerColors.secondary; // Use secondary color for shots
            }
        }
        
        this.spawnShotIndicator(x, y, color);
    }

    spawnExplosion(x, y, color) {
        const particles = [];
        const particleCount = 20;

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 5 + Math.random() * 10,
                alpha: 1.0
            });
        }

        this.explosions.push({
            particles: particles,
            color: color,
            lifetime: 0,
            maxLifetime: 0.5
        });
    }

    spawnShotIndicator(x, y, color = '#ff0000') {
        this.shotIndicators.push({
            x: x,
            y: y,
            color: color,
            lifetime: 0
        });
    }

    recordHit(points = 100, accuracyFactor = 1.0, playerIndex = 0, x = 0, y = 0) {
        this.stats.hits++;
        this.stats.totalAccuracyFactor += accuracyFactor;
        
        // Track per-player stats
        if (this.playerStats[playerIndex]) {
            this.playerStats[playerIndex].hits++;
        }
        
        // Apply combo multiplier from game
        const comboMultiplier = this.game.getComboMultiplier ? this.game.getComboMultiplier() : 1;
        const multipliedPoints = Math.floor(points * this.scoreMultiplier * comboMultiplier);
        
        this.stats.baseScore += multipliedPoints;
        this.game.levelManager.score += multipliedPoints;
        
        // Track per-player score
        if (this.playerStats[playerIndex]) {
            this.playerStats[playerIndex].score += multipliedPoints;
        }
        
        // Increment combo
        if (this.game.incrementCombo) {
            this.game.incrementCombo();
        }
        
        // Record hit for multiplayer
        if (this.game.isMultiplayer && this.game.isMultiplayer()) {
            this.game.players.recordHit(playerIndex, multipliedPoints);
        }
        
        // Update HUD score display
        if (this.game.updateScoreDisplay) {
            this.game.updateScoreDisplay();
        }
        
        // Spawn floating score
        if (this.game.spawnFloatingScore) {
            const isMultiplayer = this.game.isMultiplayer && this.game.isMultiplayer();
            const playerColors = PlayerManager.PLAYER_COLORS[playerIndex];
            const playerColor = isMultiplayer && playerColors 
                ? playerColors.primary 
                : null;
            
            // Build bonus text based on accuracy
            let bonusText = '';
            if (accuracyFactor >= 0.9) {
                bonusText = 'PERFECT!';
            } else if (accuracyFactor >= 0.7) {
                bonusText = 'GREAT!';
            }
            
            this.game.spawnFloatingScore(x, y, {
                points: multipliedPoints,
                bonusText,
                playerIndex: isMultiplayer ? playerIndex : null,
                playerColor
            });
        }
    }

    recordMiss(playerIndex = 0) {
        this.stats.misses++;
        
        // Track per-player stats
        if (this.playerStats[playerIndex]) {
            this.playerStats[playerIndex].misses++;
        }
        
        // Break combo
        if (this.game.breakCombo) {
            this.game.breakCombo();
        }
        
        // Record miss for multiplayer
        if (this.game.isMultiplayer && this.game.isMultiplayer()) {
            this.game.players.recordMiss(playerIndex);
        }
    }

    complete() {
        this.stats.endTime = Date.now();
        this.isComplete = true;
    }

    fail() {
        this.stats.endTime = Date.now();
        this.isFailed = true;
    }
    
    /**
     * Called when time runs out - check if quota was met
     */
    onTimeUp() {
        if (this.targetsHit >= this.targetQuota) {
            this.complete();
        } else {
            this.fail();
        }
    }
    
    /**
     * Apply a penalty (e.g., hitting wrong target/bomb) - lose a life but continue
     * @param {number} playerIndex - Player who caused the penalty
     * @returns {boolean} - True if game should continue, false if out of lives
     */
    applyPenalty(playerIndex = 0) {
        // Deduct a life from LevelManager
        this.game.levelManager.lives--;
        
        // Record as a miss
        this.recordMiss(playerIndex);
        
        // Break combo
        if (this.game.breakCombo) {
            this.game.breakCombo();
        }
        
        // Play penalty sound
        if (this.game.sound && this.game.sound.playGameOver) {
            this.game.sound.playGameOver();
        }
        
        // Update HUD to show life loss
        if (this.game.updateHUD) {
            this.game.updateHUD();
        }
        
        // Check if out of lives - if so, fail the round
        if (this.game.levelManager.lives <= 0) {
            this.fail();
            return false;
        }
        
        return true; // Continue playing
    }
    
    /**
     * Increment targets hit and check for quota
     * Call this instead of directly incrementing targetsHit
     */
    incrementTargetsHit() {
        this.targetsHit++;
        if (this.targetsHit >= this.targetQuota && !this.quotaReached) {
            this.quotaReached = true;
            // Play a success sound to indicate quota reached
            if (this.game.sound && this.game.sound.playSuccess) {
                this.game.sound.playSuccess();
            }
        }
    }
    
    /**
     * Check if the round should end (time up)
     * Returns true if round should continue
     */
    checkTimeAndContinue() {
        if (this.timeLimit <= 0) {
            this.onTimeUp();
            return false;
        }
        return true;
    }

    getAccuracy() {
        if (this.stats.shots === 0) return 0;
        return (this.stats.hits / this.stats.shots) * 100;
    }

    getPinpointAccuracy() {
        if (this.stats.hits === 0) return 0;
        return (this.stats.totalAccuracyFactor / this.stats.hits) * 100;
    }

    getCompletionTime() {
        return (this.stats.endTime - this.stats.startTime) / 1000; // seconds
    }

    calculateBonuses() {
        const accuracy = this.getAccuracy();
        const pinpointAccuracy = this.getPinpointAccuracy();

        // Accuracy bonus: up to 1000 points for perfect hit/miss ratio
        const accuracyBonus = Math.floor((accuracy / 100) * 1000 * this.scoreMultiplier);

        // Pinpoint bonus: up to 1000 points for perfect center shots
        const pinpointBonus = Math.floor((pinpointAccuracy / 100) * 1000 * this.scoreMultiplier);

        // Bonus targets: extra points for each target hit beyond the quota
        const bonusTargets = Math.max(0, this.targetsHit - this.targetQuota);
        const bonusTargetPoints = bonusTargets * 150 * this.scoreMultiplier;

        return {
            accuracy: accuracyBonus,
            pinpoint: pinpointBonus,
            bonusTargets: bonusTargetPoints,
            bonusTargetCount: bonusTargets,
            total: accuracyBonus + pinpointBonus + bonusTargetPoints,
            pinpointPercent: pinpointAccuracy
        };
    }
}
