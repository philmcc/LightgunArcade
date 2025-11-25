import { MiniGame } from '../MiniGame.js';

export class ClassicTarget extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT THE TARGETS!";
        this.timeLimit = 30;
        this.targets = [];

        // Difficulty scaling
        if (difficulty === 'beginner') {
            this.targetQuota = 10;
            this.spawnRate = 600;
            this.targetSpeed = 200;
            this.maxTargets = 5;
            this.timeLimit = 20;
            this.minLifetime = 2.0;
            this.maxLifetimeRange = 2.0;
        } else if (difficulty === 'medium') {
            this.targetQuota = 15;
            this.spawnRate = 450;
            this.targetSpeed = 350;
            this.maxTargets = 7;
            this.timeLimit = 20;
            this.minLifetime = 1.5;
            this.maxLifetimeRange = 1.5;
        } else {
            this.targetQuota = 20;
            this.spawnRate = 350;
            this.targetSpeed = 700;
            this.maxTargets = 8;
            this.timeLimit = 20;
            this.minLifetime = 1.0;
            this.maxLifetimeRange = 1.0;
        }

        this.targetsShot = 0;
        this.lastSpawn = 0;
        this.lastTickTime = 0;

        // Load background
        this.loadBackground('/backgrounds/classic_target.png');
    }

    start() {
        super.start();
        this.targets = [];
        this.targetsShot = 0;
        this.spawnTarget();
    }

    spawnTarget() {
        const size = 60;
        const x = Math.random() * (this.game.canvas.width - size * 2) + size;
        const y = Math.random() * (this.game.canvas.height - size * 2) + size;

        // Difficulty-based lifetime
        const maxLifetime = this.minLifetime + Math.random() * this.maxLifetimeRange;

        this.targets.push({
            x, y, size,
            vx: (Math.random() - 0.5) * this.targetSpeed,
            vy: (Math.random() - 0.5) * this.targetSpeed,
            lifetime: 0,
            maxLifetime: maxLifetime,
            opacity: 1.0
        });
    }

    update(dt) {
        this.timeLimit -= dt;

        // Play tick sound in last 5 seconds
        if (this.timeLimit <= 5 && this.timeLimit > 0) {
            if (Date.now() - this.lastTickTime > 1000) {
                this.game.sound.playTick();
                this.lastTickTime = Date.now();
            }
        }

        if (this.timeLimit <= 0) {
            this.fail();
            return;
        }

        // Spawn new targets
        if (Date.now() - this.lastSpawn > this.spawnRate && this.targets.length < this.maxTargets) {
            this.spawnTarget();
            this.lastSpawn = Date.now();
        }

        // Update targets
        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];

            // Update position
            t.x += t.vx * dt;
            t.y += t.vy * dt;

            // Bounce off walls
            if (t.x - t.size < 0 || t.x + t.size > this.game.canvas.width) t.vx *= -1;
            if (t.y - t.size < 0 || t.y + t.size > this.game.canvas.height) t.vy *= -1;

            // Update lifetime
            t.lifetime += dt;

            // Fade out in last 0.5 seconds
            const fadeTime = 0.5;
            if (t.lifetime > t.maxLifetime - fadeTime) {
                const fadeProgress = (t.maxLifetime - t.lifetime) / fadeTime;
                t.opacity = Math.max(0, fadeProgress);
            }

            // Remove expired targets
            if (t.lifetime >= t.maxLifetime) {
                this.targets.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Draw background first
        this.drawBackground(ctx);

        // Draw HUD specific to this game?
        // For now, main game handles score/time

        // Draw targets
        this.targets.forEach(t => {
            // Apply opacity for fade-out
            ctx.save();
            ctx.globalAlpha = t.opacity;

            // Outer white ring
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#333";
            ctx.stroke();

            // Red ring
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = "#ff0000";
            ctx.fill();

            // White ring
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Red bullseye
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = "#ff0000";
            ctx.fill();

            // Add shadow for depth
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            ctx.restore();
        });
        ctx.shadowColor = "transparent";

        // Draw Quota
        ctx.font = "30px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(`TARGETS: ${this.targetsShot} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);
    }

    handleInput(x, y) {
        super.handleInput(x, y);

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            const dx = x - t.x;
            const dy = y - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < t.size) {
                // Hit!
                this.game.sound.playHit();

                // Granular scoring based on accuracy (distance from center)
                // Center = 100%, Edge = 50%
                const accuracyFactor = 1 - (dist / t.size) * 0.5;
                const points = Math.ceil(100 * accuracyFactor);

                this.recordHit(points);
                this.targetsShot++;
                this.targets.splice(i, 1);

                if (this.targetsShot >= this.targetQuota) {
                    this.complete();
                } else {
                    this.spawnTarget();
                }
                return;
            }
        }
        // Miss?
        // this.game.sound.playMiss();
    }
}
