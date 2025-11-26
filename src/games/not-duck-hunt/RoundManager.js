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
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    setGameMode(mode) {
        this.gameMode = mode;
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

    handleShoot(x, y) {
        if (this.isBonusRound) {
            // Unlimited shots in bonus round
            this.checkHits(x, y);
            return;
        }

        if (this.shotsRemaining <= 0 || this.waitingForNewTarget) {
            return;
        }

        this.shotsRemaining--;
        this.game.updateAmmoDisplay(this.shotsRemaining);

        const hitResult = this.checkHits(x, y);

        if (!hitResult.hit) {
            this.game.sound.playShoot(); // Miss sound
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

    checkHits(x, y) {
        let anyHit = false;

        for (let i = this.activeTargets.length - 1; i >= 0; i--) {
            const target = this.activeTargets[i];

            if (target.isHit || target.isEscaped) continue;

            const result = target.checkHit(x, y);

            if (result.hit) {
                anyHit = true;
                this.score += result.points;
                this.targetsHit++;

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
