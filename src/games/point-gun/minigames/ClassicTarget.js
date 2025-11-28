import { MiniGame } from '../MiniGame.js';

export class ClassicTarget extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT THE TARGETS!";
        this.timeLimit = 30;
        this.targets = [];

        // Difficulty scaling - time-based rounds with quota to pass
        // All difficulties have same time, but harder = more targets needed
        if (difficulty === 'beginner') {
            this.targetQuota = 8;       // Need 8 to pass
            this.timeLimit = 25;        // 25 seconds
            this.spawnRate = 500;       // Spawn every 500ms
            this.targetSpeed = 150;     // Slow movement
            this.maxTargets = 6;        // Max on screen
            this.minLifetime = 2.5;     // Targets last longer
            this.maxLifetimeRange = 1.5;
        } else if (difficulty === 'medium') {
            this.targetQuota = 12;      // Need 12 to pass
            this.timeLimit = 25;        // Same time
            this.spawnRate = 400;       // Faster spawns
            this.targetSpeed = 250;     // Medium speed
            this.maxTargets = 7;
            this.minLifetime = 2.0;
            this.maxLifetimeRange = 1.0;
        } else {
            this.targetQuota = 16;      // Need 16 to pass
            this.timeLimit = 25;        // Same time
            this.spawnRate = 300;       // Fast spawns
            this.targetSpeed = 400;     // Fast movement
            this.maxTargets = 8;
            this.minLifetime = 1.5;
            this.maxLifetimeRange = 1.0;
        }
        this.lastSpawn = 0;
        this.lastTickTime = 0;

        // Load background
        this.loadBackground('/backgrounds/classic_target.png');
    }

    start() {
        super.start();
        this.targets = [];
        this.targetsHit = 0;
        this.quotaReached = false;
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
        // this.timeLimit -= dt; // Handled in MiniGame.js

        // Play tick sound in last 5 seconds
        if (this.timeLimit <= 5 && this.timeLimit > 0) {
            if (Date.now() - this.lastTickTime > 1000) {
                this.game.sound.playTick();
                this.lastTickTime = Date.now();
            }
        }

        // Check time - round ends when time is up
        if (!this.checkTimeAndContinue()) {
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

        super.update(dt);
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

        // Draw Quota - show progress and indicate when quota is reached
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        
        if (this.quotaReached) {
            // Quota reached - show in green, encourage bonus points
            ctx.fillStyle = "#00ff00";
            ctx.fillText(`TARGETS: ${this.targetsHit} ✓ BONUS TIME!`, this.game.canvas.width / 2, 50);
        } else {
            // Still working toward quota
            ctx.fillStyle = "#fff";
            ctx.fillText(`TARGETS: ${this.targetsHit} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);
        }

        super.drawParticles(ctx);
    }

    handleInput(x, y, playerIndex = 0) {
        super.handleInput(x, y, playerIndex);

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

                this.recordHit(points, accuracyFactor, playerIndex, t.x, t.y);
                this.incrementTargetsHit();

                // Explosion
                this.spawnExplosion(t.x, t.y, "#ff0000");

                this.targets.splice(i, 1);
                
                // Always spawn a new target - round continues until time runs out
                this.spawnTarget();
                return;
            }
        }
        // Miss - record it
        this.recordMiss(playerIndex);
    }
}
