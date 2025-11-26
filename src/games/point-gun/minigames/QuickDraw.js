import { MiniGame } from '../MiniGame.js';

export class QuickDraw extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT FAST!";
        this.target = null; // This will be replaced by currentTarget
        this.state = 'WAITING'; // WAITING, DRAW, RESULT

        if (difficulty === 'beginner') {
            this.targetQuota = 3;
            this.reactionTime = 2.4; // Increased from 2.0
            this.timeLimit = 12; // Increased from 10
            this.targetSize = 100;
        } else if (difficulty === 'medium') {
            this.targetQuota = 5;
            this.reactionTime = 1.8; // Increased from 1.5
            this.timeLimit = 18; // Increased from 15
            this.targetSize = 70;
        } else {
            this.targetQuota = 8;
            this.reactionTime = 1.2; // Increased from 1.0
            this.timeLimit = 24; // Increased from 20
            this.targetSize = 50;
        }

        this.targetsShot = 0;
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
        if (this.timeLimit <= 0) {
            this.fail();
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
                // Too slow!
                this.game.sound.playGameOver(); // Fail sound
                this.fail();
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

        // Draw Quota
        ctx.font = "30px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(`DUELS: ${this.targetsShot} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);

        super.drawParticles(ctx);
    }

    handleInput(x, y) {
        super.handleInput(x, y);

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

                this.recordHit(Math.floor(points * speedFactor), accuracyFactor);
                this.targetsShot++;

                // Explosion
                this.spawnExplosion(t.x, t.y, "#f4e4bc"); // Paper color explosion

                if (this.targetsShot >= this.targetQuota) {
                    this.complete();
                } else {
                    this.startNextRound();
                }
            } else {
                // Missed the poster!
                this.recordMiss();
            }
        } else if (this.state === 'WAITING') {
            // Fired too early!
            this.game.sound.playGameOver(); // Penalty sound
            this.fail();
        }
    }
}
