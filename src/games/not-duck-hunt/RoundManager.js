import { Duck } from './targets/Duck.js';
import { Pheasant } from './targets/Pheasant.js';
import { Pigeon } from './targets/Pigeon.js';
import { ClayPigeon } from './targets/ClayPigeon.js';

export class RoundManager {
    constructor(game) {
        this.game = game;
        this.difficulty = 'beginner';
        this.gameMode = 'campaign'; // 'campaign' or 'endless'

        this.currentRound = 0;
        this.totalRounds = 10; // For campaign mode
        this.lives = 3;
        this.score = 0;

        // Round state
        this.targetsPerRound = 10;
        this.currentTargetIndex = 0;
        this.targetsHit = 0;
        this.targetsMissed = 0;

        // Current target tracking
        this.activeTargets = [];
        this.shotsRemaining = 3;
        this.waitingForNewTarget = false;
        this.newTargetDelay = 1.5; // seconds
        this.newTargetTimer = 0;

        // Bonus round tracking
        this.isBonusRound = false;
        this.bonusTargetsRemaining = 0;

        // Target pool
        this.targetTypes = [Duck, Pheasant, Pigeon];

        // Difficulty thresholds
        this.hitThresholds = {
            'beginner': 6,
            'medium': 7,
            'hard': 8
        };

        // Target history for progress display
        this.targetHistory = []; // Array of 'hit', 'miss', or 'pending'
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    setGameMode(mode) {
        this.gameMode = mode;
    }

    startGame(mode) {
        // Initialize game state
        this.gameMode = mode;
        this.currentRound = 0;
        this.score = 0;
        this.lives = 3;

        // Reset round state
        this.currentTargetIndex = 0;
        this.targetsHit = 0;
        this.targetsMissed = 0;
        this.activeTargets = [];
        this.shotsRemaining = 3;
        this.waitingForNewTarget = false;
        this.isBonusRound = false;
        this.targetHistory = [];

        // Set difficulty based on mode (could be customized later)
        this.difficulty = 'beginner';

        // Update background for round 1
        this.game.backgroundManager.setForRound(1);

        // Start first round
        this.game.state = "PLAYING";
        this.startNewRound();
    }

    startNewRound() {
        this.currentRound++;

        // Check if this is a bonus round (every 5 rounds)
        if (this.currentRound % 5 === 0) {
            this.startBonusRound();
            return;
        }

        this.isBonusRound = false;
        this.currentTargetIndex = 0;
        this.targetsHit = 0;
        this.targetsMissed = 0;
        this.activeTargets = [];
        this.shotsRemaining = 3;
        this.waitingForNewTarget = false;
        this.targetHistory = [];

        // Show round intro, then spawn first target
        this.game.showRoundIntro(this.currentRound, () => {
            this.spawnNewTarget();
        });
    }

    startBonusRound() {
        this.isBonusRound = true;
        this.bonusTargetsRemaining = 15;
        this.targetsHit = 0;
        this.activeTargets = [];

        this.game.showBonusRoundIntro(() => {
            // Start spawning clay pigeons rapidly
            this.spawnClayPigeonWave();
        });
    }

    spawnClayPigeonWave() {
        if (this.bonusTargetsRemaining <= 0) {
            this.endBonusRound();
            return;
        }

        const clay = new ClayPigeon(this.game, this.game.canvas.width, this.game.canvas.height);
        clay.spawn(this.difficulty, this.currentRound);
        this.activeTargets.push(clay);
        this.bonusTargetsRemaining--;

        // Continue spawning at intervals
        if (this.bonusTargetsRemaining > 0) {
            setTimeout(() => this.spawnClayPigeonWave(), 800);
        }
    }

    endBonusRound() {
        // Wait for all targets to clear
        const checkClear = () => {
            if (this.activeTargets.length === 0) {
                this.game.showBonusRoundResult(this.targetsHit, () => {
                    this.startNewRound();
                });
            } else {
                setTimeout(checkClear, 100);
            }
        };
        setTimeout(checkClear, 1000);
    }

    spawnNewTarget() {
        if (this.currentTargetIndex >= this.targetsPerRound) {
            this.endRound();
            return;
        }

        // Determine number of simultaneous targets based on difficulty
        let numTargets = 1;
        if (this.difficulty === 'medium' && Math.random() < 0.3) {
            numTargets = 2;
        } else if (this.difficulty === 'hard') {
            numTargets = Math.random() < 0.5 ? 2 : 3;
        }

        // Cap number of targets to not exceed total for round
        const remaining = this.targetsPerRound - this.currentTargetIndex;
        if (numTargets > remaining) {
            numTargets = remaining;
        }

        this.currentTargetIndex += numTargets;
        this.shotsRemaining = 3;
        this.waitingForNewTarget = false;

        // Add pending entries to history for new targets
        for (let i = 0; i < numTargets; i++) {
            this.targetHistory.push('pending');
        }

        for (let i = 0; i < numTargets; i++) {
            // Determine target type
            let TargetClass;
            let roll = Math.random();

            if (roll < 0.5) {
                TargetClass = Duck;
            } else if (roll < 0.8) {
                TargetClass = Pheasant;
            } else {
                TargetClass = Pigeon;
            }

            const target = new TargetClass(this.game, this.game.canvas.width, this.game.canvas.height);

            // 10% chance for golden bonus
            if (Math.random() < 0.1) {
                target.isBonus = true;
            }

            // Apply difficulty scaling
            const sizeReduction = Math.floor(this.currentRound / 3) * 0.1;
            target.size = target.baseSize * (1 - sizeReduction);

            target.spawn(this.difficulty, this.currentRound);
            this.activeTargets.push(target);
        }
    }

    handleShoot(x, y, playerIndex = 0) {
        if (this.isBonusRound) {
            // Unlimited shots in bonus round
            this.checkHits(x, y, playerIndex);
            return;
        }

        if (this.shotsRemaining <= 0 || this.waitingForNewTarget) {
            return;
        }

        this.shotsRemaining--;
        this.game.updateAmmoDisplay(this.shotsRemaining);

        const hitResult = this.checkHits(x, y, playerIndex);

        if (!hitResult.hit) {
            this.game.sound.playShoot(); // Miss sound
            // Record miss for player in multiplayer
            if (this.game.isMultiplayer()) {
                this.game.players.recordMiss(playerIndex);
            }
        }

        // Check if all shots used
        if (this.shotsRemaining <= 0 && this.activeTargets.length > 0) {
            // All shots missed - show dog laugh
            this.game.showDogLaugh();
            // Don't increment targetsMissed here - it will be counted when targets escape off-screen

            // Mark all active targets as escaped
            this.activeTargets.forEach(t => t.escape());

            // Wait for targets to escape, then spawn new one
            this.waitingForNewTarget = true;
            this.newTargetTimer = this.newTargetDelay;
        }
    }

    checkHits(x, y, playerIndex = 0) {
        let anyHit = false;

        for (let i = this.activeTargets.length - 1; i >= 0; i--) {
            const target = this.activeTargets[i];

            if (target.isHit || target.isEscaped) continue;

            const result = target.checkHit(x, y);

            if (result.hit) {
                anyHit = true;
                this.score += result.points;
                this.targetsHit++;

                // Record hit for player in multiplayer
                if (this.game.isMultiplayer()) {
                    this.game.players.recordHit(playerIndex, result.points);
                }

                // Play hit sound
                this.game.sound.playHit();

                // Show hit particle effect
                this.game.spawnHitEffect(target.x, target.y);

                break; // Only hit one target per shot
            }
        }

        return { hit: anyHit };
    }

    update(dt) {
        // Update all active targets
        for (let i = this.activeTargets.length - 1; i >= 0; i--) {
            const target = this.activeTargets[i];
            target.update(dt);

            // Remove targets that are off screen
            if (target.isOffScreen) {
                this.activeTargets.splice(i, 1);

                // If target escaped without being hit (and not in bonus round)
                if (target.isEscaped && !target.isHit && !this.isBonusRound) {
                    this.targetsMissed++;
                    // Mark the oldest pending target as missed
                    const pendingIndex = this.targetHistory.indexOf('pending');
                    if (pendingIndex !== -1) {
                        this.targetHistory[pendingIndex] = 'miss';
                    }
                } else if (target.isHit && !this.isBonusRound) {
                    // Mark the oldest pending target as hit
                    const pendingIndex = this.targetHistory.indexOf('pending');
                    if (pendingIndex !== -1) {
                        this.targetHistory[pendingIndex] = 'hit';
                    }
                }
            }
        }

        // Check if need to spawn new target
        if (this.waitingForNewTarget) {
            this.newTargetTimer -= dt;

            if (this.newTargetTimer <= 0 && this.activeTargets.length === 0) {
                this.spawnNewTarget();
            }
        } else if (!this.isBonusRound && this.activeTargets.length === 0) {
            if (this.currentTargetIndex < this.targetsPerRound) {
                // All targets cleared, spawn next
                this.waitingForNewTarget = true;
                this.newTargetTimer = 1.0; // Short delay
            } else {
                // All targets for the round are finished
                this.endRound();
            }
        }
    }

    draw(ctx) {
        // Draw all active targets
        this.activeTargets.forEach(target => {
            target.draw(ctx);
        });

        // Draw target progress bar at bottom of screen
        if (!this.isBonusRound && this.targetHistory.length > 0) {
            this.drawTargetProgress(ctx);
        }
    }

    drawTargetProgress(ctx) {
        const canvasWidth = this.game.canvas.width;
        const canvasHeight = this.game.canvas.height;

        // Position at bottom center
        const barWidth = 400;
        const barHeight = 40;
        const x = (canvasWidth - barWidth) / 2;
        const y = canvasHeight - 60;

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x - 10, y - 10, barWidth + 20, barHeight + 20);

        // Draw target slots
        const slotWidth = barWidth / this.targetsPerRound;

        for (let i = 0; i < this.targetsPerRound; i++) {
            const slotX = x + (i * slotWidth);
            const status = this.targetHistory[i] || 'empty';

            // Determine color based on status
            let fillColor;
            if (status === 'hit') {
                fillColor = '#00ff00'; // Green for hit
            } else if (status === 'miss') {
                fillColor = '#ff0000'; // Red for miss
            } else if (status === 'pending') {
                fillColor = '#ffff00'; // Yellow for current target
            } else {
                fillColor = '#444444'; // Gray for not yet attempted
            }

            // Draw slot
            ctx.fillStyle = fillColor;
            ctx.fillRect(slotX + 2, y + 2, slotWidth - 4, barHeight - 4);

            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(slotX + 2, y + 2, slotWidth - 4, barHeight - 4);
        }
    }

    endRound() {
        const hitThreshold = this.hitThresholds[this.difficulty];
        const success = this.targetsHit >= hitThreshold;

        if (!success) {
            // Strict progression: Fail round = Game Over
            this.game.gameOver();
            return;
        }

        this.game.showRoundResult(success, this.targetsHit, this.targetsPerRound, () => {
            // Check if game is complete (campaign mode)
            if (this.gameMode === 'campaign' && this.currentRound >= this.totalRounds) {
                this.game.gameClear();
            } else {
                this.startNewRound();
            }
        });
    }
}
