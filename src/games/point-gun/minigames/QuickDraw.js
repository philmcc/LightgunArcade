import { MiniGame } from '../MiniGame.js';

export class QuickDraw extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT FAST!";
        this.target = null; // This will be replaced by currentTarget
        this.state = 'WAITING'; // WAITING, DRAW, RESULT

        // Difficulty scaling - time-based with quota to pass
        // QuickDraw is unique: you have total time to complete N duels
        // Each duel has a reaction time limit
        if (difficulty === 'beginner') {
            this.targetQuota = 5;       // Need 5 successful duels to pass
            this.reactionTime = 2.5;    // Generous reaction window
            this.timeLimit = 30;        // 30 seconds total
            this.targetSize = 100;      // Large target
        } else if (difficulty === 'medium') {
            this.targetQuota = 8;       // Need 8 to pass
            this.reactionTime = 2.0;    // Tighter window
            this.timeLimit = 30;
            this.targetSize = 80;
        } else {
            this.targetQuota = 12;      // Need 12 to pass
            this.reactionTime = 1.5;    // Fast reactions needed
            this.timeLimit = 30;
            this.targetSize = 60;
        }
        this.currentTarget = null;
        this.state = 'WAITING'; // WAITING, DRAW, RESULT
        this.waitTime = 0;
        this.drawTimer = 0;

        this.startNextRound();
        // Load background
        this.loadBackground('/backgrounds/quick_draw.png');
    }

    start() {
        super.start();
        this.targetsHit = 0;
        this.quotaReached = false;
        // The game now starts with startNextRound() in the constructor
    }

    startNextRound() {
        this.state = 'WAITING';
        this.currentTarget = null;
        // Random wait between 1 and 3 seconds
        this.waitTime = 1 + Math.random() * 2;
        this.drawTimer = 0;
    }

    spawnTarget() {
        // Random position, but kept somewhat central
        const margin = 100;
        const x = margin + Math.random() * (this.game.canvas.width - margin * 2);
        const y = margin + Math.random() * (this.game.canvas.height - margin * 2);

        this.currentTarget = {
            x: x,
            y: y,
            size: this.targetSize, // Use size based on difficulty
            active: true
        };
        this.game.sound.playTick(); // "DRAW!" sound cue
    }

    update(dt) {
        // Check time - round ends when time is up
        if (!this.checkTimeAndContinue()) {
            return;
        }

        if (this.state === 'WAITING') {
            this.waitTime -= dt;
            if (this.waitTime <= 0) {
                this.state = 'DRAW';
                this.spawnTarget();
            }
        } else if (this.state === 'DRAW') {
            this.drawTimer += dt;
            if (this.drawTimer > this.reactionTime) {
                // Too slow! But don't end the game - just start next duel
                this.game.sound.playMiss ? this.game.sound.playMiss() : null;
                this.recordMiss(0);
                this.startNextRound();
            }
        }

        super.update(dt);
    }

    draw(ctx) {
        // Draw background first
        this.drawBackground(ctx);

        if (this.state === 'WAITING') {
            ctx.fillStyle = "#fff";
            ctx.font = "40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("READY...", this.game.canvas.width / 2, this.game.canvas.height / 2);
        } else if (this.state === 'DRAW' && this.currentTarget) {
            const t = this.currentTarget;

            ctx.save();
            ctx.translate(t.x, t.y);

            // Wanted Poster Style Target
            // Paper background
            ctx.fillStyle = "#f4e4bc";
            ctx.fillRect(-t.size * 0.8, -t.size, t.size * 1.6, t.size * 2);

            // Border
            ctx.strokeStyle = "#5c4033";
            ctx.lineWidth = 4;
            ctx.strokeRect(-t.size * 0.8, -t.size, t.size * 1.6, t.size * 2);

            // "WANTED" Text
            ctx.fillStyle = "#000";
            ctx.font = "bold 20px Courier New";
            ctx.textAlign = "center";
            ctx.fillText("WANTED", 0, -t.size * 0.7);

            // Silhouette
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.arc(0, 0, t.size * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Cowboy Hat on silhouette
            ctx.beginPath();
            ctx.ellipse(0, -t.size * 0.4, t.size * 0.5, t.size * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(-t.size * 0.25, -t.size * 0.6, t.size * 0.5, t.size * 0.3);

            // Bullseye overlay
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, t.size * 0.2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-t.size * 0.3, 0);
            ctx.lineTo(t.size * 0.3, 0);
            ctx.moveTo(0, -t.size * 0.3);
            ctx.lineTo(0, t.size * 0.3);
            ctx.stroke();

            ctx.restore();

            // Draw "FIRE!" text
            ctx.fillStyle = "red";
            ctx.font = "bold 60px Arial";
            ctx.textAlign = "center";
            ctx.fillText("FIRE!", this.game.canvas.width / 2, 100);
        }

        // Draw Quota - show progress and indicate when quota is reached
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        
        if (this.quotaReached) {
            ctx.fillStyle = "#00ff00";
            ctx.fillText(`DUELS: ${this.targetsHit} ✓ BONUS TIME!`, this.game.canvas.width / 2, 50);
        } else {
            ctx.fillStyle = "#fff";
            ctx.fillText(`DUELS: ${this.targetsHit} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);
        }

        super.drawParticles(ctx);
    }

    handleInput(x, y, playerIndex = 0) {
        super.handleInput(x, y, playerIndex);

        if (this.state === 'DRAW' && this.currentTarget) {
            const t = this.currentTarget;
            const dx = x - t.x;
            const dy = y - t.y;
            // Rectangular hit detection for poster
            if (Math.abs(dx) < t.size * 0.8 && Math.abs(dy) < t.size) {
                this.game.sound.playHit();

                // Granular scoring based on accuracy (distance from center)
                const dist = Math.sqrt(dx * dx + dy * dy);
                const accuracyFactor = Math.max(0.1, 1 - (dist / (t.size * 0.8)) * 0.8);
                const points = Math.ceil(100 * accuracyFactor);

                // Speed bonus for quick draw
                const speedFactor = 1 + (this.reactionTime - this.drawTimer);

                this.recordHit(Math.floor(points * speedFactor), accuracyFactor, playerIndex, t.x, t.y);
                this.incrementTargetsHit();

                // Explosion
                this.spawnExplosion(t.x, t.y, "#f4e4bc"); // Paper color explosion

                // Always start next round - continue until time runs out
                this.startNextRound();
            } else {
                // Missed the poster!
                this.recordMiss(playerIndex);
            }
        } else if (this.state === 'WAITING') {
            // Fired too early! Penalty but don't end game
            this.game.sound.playMiss ? this.game.sound.playMiss() : null;
            this.recordMiss(playerIndex);
            // Reset wait time as penalty
            this.waitTime = 1.5 + Math.random() * 1.5;
        }
    }
}
