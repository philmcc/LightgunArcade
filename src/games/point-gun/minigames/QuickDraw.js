import { MiniGame } from '../MiniGame.js';

export class QuickDraw extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT FAST!";
        this.timeLimit = 5; // Initial wait time
        this.target = null;
        this.state = 'WAITING'; // WAITING, DRAW, RESULT

        if (difficulty === 'beginner') {
            this.reactionTime = 2.5;
            this.targetSize = 100;
        } else if (difficulty === 'medium') {
            this.reactionTime = 1.5;
            this.targetSize = 70;
        } else {
            this.reactionTime = 0.6;
            this.targetSize = 50;
        }

        this.waitTime = 1.0 + Math.random() * 3.0;
        // Load background
        this.loadBackground('/backgrounds/quick_draw.png');
    }

    start() {
        super.start();
        this.state = 'WAITING';
    }

    update(dt) {
        if (this.state === 'WAITING') {
            this.waitTime -= dt;
            if (this.waitTime <= 0) {
                this.state = 'DRAW';
                this.timeLimit = this.reactionTime;
                this.spawnTarget();
                // Play "DRAW!" sound?
            }
        } else if (this.state === 'DRAW') {
            this.timeLimit -= dt;
            if (this.timeLimit <= 0) {
                this.fail();
            }
        }
    }

    spawnTarget() {
        const size = this.targetSize;
        const margin = size + 50; // Keep target away from edges

        // Random position within safe bounds
        const x = margin + Math.random() * (this.game.canvas.width - margin * 2);
        const y = margin + Math.random() * (this.game.canvas.height - margin * 2);

        this.target = { x, y, size };
    }

    draw(ctx) {
        // Draw background first
        this.drawBackground(ctx);

        if (this.state === 'WAITING') {
            ctx.font = "50px Arial";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.fillText("READY...", this.game.canvas.width / 2, this.game.canvas.height / 2);
        } else if (this.state === 'DRAW') {
            // Draw Target - Western Wanted Poster Style
            const t = this.target;

            // Wooden sign background
            ctx.fillStyle = "#8B6F47";
            ctx.fillRect(t.x - t.size, t.y - t.size, t.size * 2, t.size * 2);

            // Wood grain effect
            ctx.strokeStyle = "rgba(101, 67, 33, 0.3)";
            ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(t.x - t.size, t.y - t.size + (i * t.size * 0.5));
                ctx.lineTo(t.x + t.size, t.y - t.size + (i * t.size * 0.5));
                ctx.stroke();
            }

            // Aged paper
            ctx.fillStyle = "#f4e4c1";
            ctx.fillRect(t.x - t.size * 0.8, t.y - t.size * 0.8, t.size * 1.6, t.size * 1.6);

            // Paper border
            ctx.strokeStyle = "#8B6F47";
            ctx.lineWidth = 3;
            ctx.strokeRect(t.x - t.size * 0.8, t.y - t.size * 0.8, t.size * 1.6, t.size * 1.6);

            // Red target circle
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = "#cc0000";
            ctx.fill();
            ctx.strokeStyle = "#8B0000";
            ctx.lineWidth = 4;
            ctx.stroke();

            // Center dot
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * 0.15, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            ctx.fillStyle = "#8B0000";
            ctx.font = "bold 40px Arial";
            ctx.fillText("FIRE!", t.x, t.y - t.size - 20);

            // Timer bar
            const pct = this.timeLimit / this.reactionTime;
            ctx.fillStyle = "#fff";
            ctx.fillRect(t.x - 50, t.y + t.size + 20, 100 * pct, 10);
        }
    }

    handleInput(x, y) {
        super.handleInput(x, y);

        if (this.state === 'WAITING') {
            // False start!
            this.fail();
            return;
        }

        if (this.state === 'DRAW' && this.target) {
            const dx = x - this.target.x;
            const dy = y - this.target.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.target.size) {
                this.game.sound.playHit();

                // Granular scoring based on accuracy
                // Center = 100%, Edge = 50%
                const accuracyFactor = 1 - (dist / this.target.size) * 0.5;
                const points = Math.ceil(500 * accuracyFactor);

                this.recordHit(points); // Big points
                this.complete();
            } else {
                // Missed the shot!
                this.fail();
            }
        }
    }
}
