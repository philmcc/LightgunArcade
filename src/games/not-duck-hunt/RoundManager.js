import { Duck } from './targets/Duck.js';
import { Pheasant } from './targets/Pheasant.js';
import { Pigeon } from './targets/Pigeon.js';
import { ClayPigeon } from './targets/ClayPigeon.js';
import { ArmoredDuck } from './targets/ArmoredDuck.js';
import { Decoy } from './targets/Decoy.js';
import { GoldenPheasant } from './targets/GoldenPheasant.js';

export class RoundManager {
    constructor(game) {
        this.game = game;
        this.difficulty = 'beginner';
        this.gameMode = 'campaign'; // 'campaign' or 'endless'
        this.multiplayerMode = 'coop'; // 'coop', 'versus', 'duel'

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
        this.playerAmmo = [3, 3]; // Per-player ammo for multiplayer
        this.waitingForNewTarget = false;
        this.newTargetDelay = 1.5; // seconds
        this.newTargetTimer = 0;
        
        // For duel mode target assignment
        this.nextDuelPlayer = 0;

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

        // === PHASE 1: Enhanced Scoring System ===
        
        // Combo system
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.comboTimeout = 2.0; // seconds before combo resets
        this.lastHitTime = 0;
        
        // Per-round stats for scoring
        this.roundStats = {
            hits: 0,
            misses: 0,
            perfectHits: 0,  // Center hits
            quickKills: 0,   // Kills within 1 second of spawn
            chainKills: 0    // Multiple kills in one shot set
        };
        
        // Difficulty scaling factors (increase per round)
        this.speedScale = 1.0;
        this.sizeScale = 1.0;
        
        // Performance tracking for adaptive difficulty
        this.recentAccuracy = [];  // Last 5 rounds accuracy
        this.performanceRating = 1.0;  // 0.5 = struggling, 1.5 = dominating
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    setGameMode(mode) {
        this.gameMode = mode;
    }

    startGame(mode, multiplayerMode = 'coop') {
        // Initialize game state
        this.gameMode = mode;
        this.multiplayerMode = multiplayerMode;
        this.currentRound = 0;
        this.score = 0;
        this.lives = 3;

        // Reset round state
        this.currentTargetIndex = 0;
        this.targetsHit = 0;
        this.targetsMissed = 0;
        this.activeTargets = [];
        this.shotsRemaining = 3;
        this.playerAmmo = [3, 3];
        this.waitingForNewTarget = false;
        this.isBonusRound = false;
        this.targetHistory = [];
        this.nextDuelPlayer = 0; // Reset duel target assignment

        // Reset combo and scoring
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.resetRoundStats();
        
        // Reset difficulty scaling
        this.speedScale = 1.0;
        this.sizeScale = 1.0;
        this.recentAccuracy = [];
        this.performanceRating = 1.0;

        // Set difficulty based on mode (could be customized later)
        this.difficulty = 'beginner';

        // Update background for round 1
        this.game.backgroundManager.setForRound(1);

        // Start first round
        this.game.state = "PLAYING";
        this.startNewRound();
    }

    resetRoundStats() {
        this.roundStats = {
            hits: 0,
            misses: 0,
            perfectHits: 0,
            quickKills: 0,
            chainKills: 0
        };
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
        
        // Reset round stats but keep combo going between rounds
        this.resetRoundStats();
        
        // Update difficulty scaling based on round
        this.updateDifficultyScaling();

        // Show round intro, then spawn first target
        this.game.showRoundIntro(this.currentRound, () => {
            this.spawnNewTarget();
        });
    }

    updateDifficultyScaling() {
        // Base scaling: targets get faster and smaller each round
        const roundFactor = (this.currentRound - 1) * 0.08;
        
        // Speed increases 8% per round
        this.speedScale = 1.0 + roundFactor;
        
        // Size decreases 5% per round (min 60% of original)
        this.sizeScale = Math.max(0.6, 1.0 - (this.currentRound - 1) * 0.05);
        
        // Adaptive difficulty based on recent performance
        if (this.recentAccuracy.length >= 3) {
            const avgAccuracy = this.recentAccuracy.slice(-3).reduce((a, b) => a + b, 0) / 3;
            
            if (avgAccuracy > 85) {
                // Player is doing great - make it harder
                this.performanceRating = 1.2;
                this.speedScale *= 1.1;
            } else if (avgAccuracy < 50) {
                // Player is struggling - ease up slightly
                this.performanceRating = 0.8;
                this.speedScale *= 0.9;
                this.sizeScale = Math.min(1.0, this.sizeScale * 1.1);
            } else {
                this.performanceRating = 1.0;
            }
        }
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

        // Determine number of simultaneous targets based on difficulty and round
        let numTargets = 1;
        const multiTargetChance = 0.2 + (this.currentRound * 0.05); // Increases each round
        
        if (this.difficulty === 'medium' && Math.random() < multiTargetChance) {
            numTargets = 2;
        } else if (this.difficulty === 'hard') {
            numTargets = Math.random() < multiTargetChance ? (Math.random() < 0.3 ? 3 : 2) : 1;
        } else if (this.currentRound > 5 && Math.random() < multiTargetChance * 0.5) {
            // Even beginner gets occasional double targets in later rounds
            numTargets = 2;
        }

        // Cap number of targets to not exceed total for round
        const remaining = this.targetsPerRound - this.currentTargetIndex;
        if (numTargets > remaining) {
            numTargets = remaining;
        }

        this.currentTargetIndex += numTargets;
        this.shotsRemaining = 3;
        this.playerAmmo = [3, 3]; // Reset per-player ammo
        this.waitingForNewTarget = false;
        this.currentSetHits = 0;  // Track hits in this target set for chain bonus
        
        // Update ammo display
        if (this.game.isMultiplayer()) {
            this.game.updateAmmoDisplay(3, 0);
            this.game.updateAmmoDisplay(3, 1);
        } else {
            this.game.updateAmmoDisplay(3);
        }

        // Add pending entries to history for new targets
        for (let i = 0; i < numTargets; i++) {
            this.targetHistory.push('pending');
        }

        for (let i = 0; i < numTargets; i++) {
            const target = this.createTarget(i, numTargets);
            target.spawn(this.difficulty, this.currentRound, this.speedScale);
            this.activeTargets.push(target);
        }
    }

    createTarget(index, totalInSet) {
        // Determine target type with more variety in later rounds
        let TargetClass;
        let roll = Math.random();
        
        // Special targets appear in later rounds
        const canSpawnSpecial = this.currentRound >= 3;
        const canSpawnDecoy = this.currentRound >= 4;
        const canSpawnArmored = this.currentRound >= 5;
        
        // Check for special target spawns first
        if (canSpawnSpecial && roll < 0.03) {
            // 3% chance for Golden Pheasant (rare, high value)
            TargetClass = GoldenPheasant;
        } else if (canSpawnArmored && roll < 0.10) {
            // 7% chance for Armored Duck (requires 2 hits)
            TargetClass = ArmoredDuck;
        } else if (canSpawnDecoy && roll < 0.15) {
            // 5% chance for Decoy (penalty target)
            TargetClass = Decoy;
        } else if (roll < 0.55) {
            // 40% chance for regular Duck
            TargetClass = Duck;
        } else if (roll < 0.80) {
            // 25% chance for Pheasant
            TargetClass = Pheasant;
        } else {
            // 20% chance for Pigeon
            TargetClass = Pigeon;
        }

        const target = new TargetClass(this.game, this.game.canvas.width, this.game.canvas.height);

        // Apply difficulty scaling (size) - but not to special targets
        if (!target.isGoldenPheasant && !target.isArmored && !target.isDecoy) {
            target.size = target.baseSize * this.sizeScale;
        }
        
        // Apply speed scaling
        target.speedMultiplier *= this.speedScale;

        // 10% chance for golden bonus (15% in later rounds) - not for already special targets
        if (!target.isBonus && !target.isDecoy && !target.isArmored) {
            const bonusChance = this.currentRound > 5 ? 0.15 : 0.1;
            if (Math.random() < bonusChance) {
                target.isBonus = true;
            }
        }
        
        // Track spawn time for quick kill bonus
        target.spawnTime = performance.now();
        
        // For duel mode: assign target to a player (alternate across ALL targets, not just within set)
        if (this.multiplayerMode === 'duel' && this.game.isMultiplayer()) {
            target.assignedPlayer = this.nextDuelPlayer;
            target.playerColor = this.game.players.getPlayer(target.assignedPlayer)?.colors.primary || '#fff';
            this.nextDuelPlayer = (this.nextDuelPlayer + 1) % 2; // Alternate for next target
        }

        return target;
    }

    handleShoot(x, y, playerIndex = 0) {
        if (this.isBonusRound) {
            // Unlimited shots in bonus round
            this.checkHits(x, y, playerIndex);
            return;
        }

        // Check ammo - per-player in multiplayer, shared in single player
        const ammoRemaining = this.game.isMultiplayer() 
            ? this.playerAmmo[playerIndex] 
            : this.shotsRemaining;
            
        if (ammoRemaining <= 0 || this.waitingForNewTarget) {
            return;
        }

        // Deduct ammo
        if (this.game.isMultiplayer()) {
            this.playerAmmo[playerIndex]--;
            this.game.updateAmmoDisplay(this.playerAmmo[playerIndex], playerIndex);
        } else {
            this.shotsRemaining--;
            this.game.updateAmmoDisplay(this.shotsRemaining);
        }

        const hitResult = this.checkHits(x, y, playerIndex);

        if (!hitResult.hit) {
            // Miss - break combo
            this.breakCombo();
            this.roundStats.misses++;
            
            // Record miss for player in multiplayer
            if (this.game.isMultiplayer()) {
                this.game.players.recordMiss(playerIndex);
            }
        }

        // Check if all shots used - only show dog laugh if there are still LIVE (non-hit) targets
        const liveTargets = this.activeTargets.filter(t => !t.isHit && !t.isEscaped);
        const totalAmmoRemaining = this.game.isMultiplayer()
            ? this.playerAmmo.reduce((a, b) => a + b, 0)
            : this.shotsRemaining;
            
        if (totalAmmoRemaining <= 0 && liveTargets.length > 0) {
            // All shots used and there are still live targets - show dog laugh
            this.game.showDogLaugh();

            // Mark all live targets as escaped
            liveTargets.forEach(t => t.escape());

            // Wait for targets to escape, then spawn new one
            this.waitingForNewTarget = true;
            this.newTargetTimer = this.newTargetDelay;
        }
    }

    checkHits(x, y, playerIndex = 0) {
        let anyHit = false;
        let hitTarget = null;
        let hitResult = null;

        for (let i = this.activeTargets.length - 1; i >= 0; i--) {
            const target = this.activeTargets[i];

            if (target.isHit || target.isEscaped) continue;
            
            // In duel mode, check if this target belongs to the shooting player
            if (this.multiplayerMode === 'duel' && target.assignedPlayer !== undefined) {
                if (target.assignedPlayer !== playerIndex) {
                    continue; // Can't shoot other player's targets
                }
            }

            const result = target.checkHit(x, y);

            if (result.hit) {
                anyHit = true;
                hitTarget = target;
                hitResult = result;
                break; // Only hit one target per shot
            }
        }
        
        if (anyHit && hitTarget && hitResult) {
            // Handle special target types
            if (hitResult.isDecoy) {
                // Decoy hit - penalty!
                this.handleDecoyHit(hitTarget, hitResult, playerIndex);
                return { hit: true, isDecoy: true };
            }
            
            if (hitResult.armorDamaged && !hitResult.armorBroken) {
                // Armored target damaged but not destroyed
                this.handleArmorDamage(hitTarget, hitResult, playerIndex);
                return { hit: true, armorDamaged: true };
            }
            
            // Calculate enhanced scoring for normal/destroyed targets
            const scoringResult = this.calculateEnhancedScore(hitTarget, hitResult, playerIndex);
            
            // In versus mode, add "FIRST!" bonus for visual emphasis
            if (this.multiplayerMode === 'versus' && this.game.isMultiplayer()) {
                scoringResult.bonuses.push({ type: 'FIRST!', points: 0 });
                scoringResult.isFirstHit = true;
            }
            
            this.score += scoringResult.totalPoints;
            this.targetsHit++;
            this.roundStats.hits++;
            this.currentSetHits++;
            
            // Update combo
            this.incrementCombo();
            
            // Track chain kills (multiple hits in one target set)
            if (this.currentSetHits > 1) {
                this.roundStats.chainKills++;
            }

            // Record hit for player in multiplayer
            if (this.game.isMultiplayer()) {
                this.game.players.recordHit(playerIndex, scoringResult.totalPoints);
                
                // In co-op mode, also add to team score
                if (this.multiplayerMode === 'coop') {
                    // Team score is tracked in this.score (already done above)
                }
            }

            // Play hit sound
            this.game.sound.playHit();

            // Show hit particle effect with combo indicator
            this.game.spawnHitEffect(hitTarget.x, hitTarget.y, scoringResult);
            
            // Show floating score text with player indicator in versus
            this.game.showFloatingScore(hitTarget.x, hitTarget.y, scoringResult, playerIndex);
        }

        return { hit: anyHit };
    }

    handleDecoyHit(target, hitResult, playerIndex) {
        // Penalty for shooting decoy
        const penalty = Math.abs(hitResult.points);
        this.score = Math.max(0, this.score - penalty);
        
        // Break combo
        this.breakCombo();
        
        // Record as miss for multiplayer
        if (this.game.isMultiplayer()) {
            this.game.players.recordMiss(playerIndex);
            // Also deduct points
            const player = this.game.players.getPlayer(playerIndex);
            if (player) {
                player.score = Math.max(0, player.score - penalty);
            }
        }
        
        // Play miss/penalty sound
        this.game.sound.playMiss();
        
        // Show penalty floating text
        this.game.showFloatingScore(target.x, target.y, {
            totalPoints: -penalty,
            bonuses: [{ type: 'DECOY!' }],
            comboMultiplier: 1,
            combo: 0,
            isPerfect: false
        });
        
        // Red particle effect
        this.game.spawnHitEffect(target.x, target.y, { isPerfect: false, comboMultiplier: 0 });
    }

    handleArmorDamage(target, hitResult, playerIndex) {
        // Small points for damaging armor
        this.score += hitResult.points;
        
        if (this.game.isMultiplayer()) {
            this.game.players.recordHit(playerIndex, hitResult.points);
        }
        
        // Play armor hit sound (use regular hit for now)
        this.game.sound.playHit();
        
        // Show armor damage floating text
        this.game.showFloatingScore(target.x, target.y, {
            totalPoints: hitResult.points,
            bonuses: [{ type: `${hitResult.hitsRemaining} MORE!` }],
            comboMultiplier: 1,
            combo: this.combo,
            isPerfect: false
        });
        
        // Orange particle effect for armor
        this.game.spawnHitEffect(target.x, target.y, { isPerfect: false, comboMultiplier: 1.5 });
    }

    calculateEnhancedScore(target, hitResult, playerIndex) {
        let basePoints = hitResult.points;
        let comboMultiplier = this.getComboMultiplier();
        let bonuses = [];
        
        // Perfect hit bonus (center of target)
        const isPerfect = hitResult.distance < (target.size * 0.2);
        if (isPerfect) {
            this.roundStats.perfectHits++;
            bonuses.push({ type: 'PERFECT', points: 50 });
        }
        
        // Quick kill bonus (hit within 1.5 seconds of spawn)
        const timeSinceSpawn = (performance.now() - target.spawnTime) / 1000;
        if (timeSinceSpawn < 1.5) {
            this.roundStats.quickKills++;
            const quickBonus = Math.floor(50 * (1.5 - timeSinceSpawn));
            if (quickBonus > 0) {
                bonuses.push({ type: 'QUICK', points: quickBonus });
            }
        }
        
        // Calculate total
        let bonusPoints = bonuses.reduce((sum, b) => sum + b.points, 0);
        let totalPoints = Math.floor((basePoints + bonusPoints) * comboMultiplier);
        
        return {
            basePoints,
            bonusPoints,
            bonuses,
            comboMultiplier,
            combo: this.combo + 1, // Will be incremented after this
            totalPoints,
            isPerfect
        };
    }

    incrementCombo() {
        this.combo++;
        this.comboTimer = this.comboTimeout;
        this.lastHitTime = performance.now();
        
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        
        // Notify game of combo for UI updates
        this.game.onComboUpdate(this.combo, this.getComboMultiplier());
    }

    breakCombo() {
        if (this.combo > 0) {
            this.game.onComboBreak(this.combo);
        }
        this.combo = 0;
        this.comboTimer = 0;
    }

    getComboMultiplier() {
        // Combo multiplier: 1x, 1.5x, 2x, 2.5x, 3x, 3.5x, 4x (max)
        if (this.combo < 2) return 1.0;
        if (this.combo < 4) return 1.5;
        if (this.combo < 6) return 2.0;
        if (this.combo < 8) return 2.5;
        if (this.combo < 10) return 3.0;
        if (this.combo < 15) return 3.5;
        return 4.0;
    }

    update(dt) {
        // Update combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.breakCombo();
            }
        }
        
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
        
        // Track accuracy for adaptive difficulty
        const roundAccuracy = this.targetsPerRound > 0 
            ? (this.targetsHit / this.targetsPerRound) * 100 
            : 0;
        this.recentAccuracy.push(roundAccuracy);
        if (this.recentAccuracy.length > 5) {
            this.recentAccuracy.shift();
        }

        if (!success) {
            // Strict progression: Fail round = Game Over
            this.breakCombo(); // End combo on round fail
            this.game.gameOver();
            return;
        }
        
        // Calculate round bonuses
        const roundBonuses = this.calculateRoundBonuses();

        this.game.showRoundResult(success, this.targetsHit, this.targetsPerRound, roundBonuses, () => {
            // Check if game is complete (campaign mode)
            if (this.gameMode === 'campaign' && this.currentRound >= this.totalRounds) {
                this.game.gameClear();
            } else {
                this.startNewRound();
            }
        });
    }

    calculateRoundBonuses() {
        const bonuses = [];
        let totalBonus = 0;
        
        // Perfect round bonus (all hits)
        if (this.targetsHit === this.targetsPerRound) {
            const perfectBonus = 500;
            bonuses.push({ type: 'PERFECT ROUND', points: perfectBonus });
            totalBonus += perfectBonus;
        }
        
        // Accuracy bonus
        const accuracy = (this.roundStats.hits / Math.max(1, this.roundStats.hits + this.roundStats.misses)) * 100;
        if (accuracy >= 80) {
            const accuracyBonus = Math.floor(accuracy * 3);
            bonuses.push({ type: 'ACCURACY', points: accuracyBonus, detail: `${accuracy.toFixed(0)}%` });
            totalBonus += accuracyBonus;
        }
        
        // Max combo bonus
        if (this.maxCombo >= 5) {
            const comboBonus = this.maxCombo * 20;
            bonuses.push({ type: 'MAX COMBO', points: comboBonus, detail: `x${this.maxCombo}` });
            totalBonus += comboBonus;
        }
        
        // Quick kills bonus
        if (this.roundStats.quickKills >= 3) {
            const quickBonus = this.roundStats.quickKills * 25;
            bonuses.push({ type: 'QUICK DRAW', points: quickBonus, detail: `${this.roundStats.quickKills} kills` });
            totalBonus += quickBonus;
        }
        
        // Add total bonus to score
        this.score += totalBonus;
        
        return {
            bonuses,
            totalBonus,
            roundStats: { ...this.roundStats },
            maxCombo: this.maxCombo,
            accuracy
        };
    }

    getRoundStats() {
        return {
            hits: this.targetsHit,
            total: this.targetsPerRound,
            combo: this.combo,
            maxCombo: this.maxCombo,
            roundStats: this.roundStats,
            score: this.score
        };
    }
}
