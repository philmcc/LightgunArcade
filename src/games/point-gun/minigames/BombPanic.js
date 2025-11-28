import { MiniGame } from '../MiniGame.js';

export class BombPanic extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT TARGETS! AVOID BOMBS!";
        this.timeLimit = 25;
        this.entities = [];

        // Difficulty scaling - time-based rounds with quota to pass
        if (difficulty === 'beginner') {
            this.targetQuota = 8;       // Need 8 targets to pass
            this.timeLimit = 25;        // 25 seconds
            this.bombCount = 2;         // Few bombs
            this.speed = 150;           // Slow
            this.spawnRate = 800;       // Spawn rate
        } else if (difficulty === 'medium') {
            this.targetQuota = 12;      // Need 12 to pass
            this.timeLimit = 25;
            this.bombCount = 4;         // More bombs
            this.speed = 250;
            this.spawnRate = 600;
        } else {
            this.targetQuota = 16;      // Need 16 to pass
            this.timeLimit = 25;
            this.bombCount = 6;         // Many bombs
            this.speed = 400;
            this.spawnRate = 450;
        }

        this.lastTickTime = 0;
        this.lastSpawn = 0;

        // Load background
        this.loadBackground('/backgrounds/bomb_panic.png');
    }

    start() {
        super.start();
        this.entities = [];
        this.targetsHit = 0;
        this.quotaReached = false;

        // Spawn initial targets
        for (let i = 0; i < 3; i++) this.spawnEntity('target');

        // Spawn bombs
        for (let i = 0; i < this.bombCount; i++) this.spawnEntity('bomb');
    }

    spawnEntity(type) {
        const size = type === 'bomb' ? 60 : 50;
        const x = Math.random() * (this.game.canvas.width - size * 2) + size;
        const y = Math.random() * (this.game.canvas.height - size * 2) + size;

        this.entities.push({
            type, // 'target' or 'bomb'
            x, y, size,
            vx: (Math.random() - 0.5) * this.speed,
            vy: (Math.random() - 0.5) * this.speed,
            rotation: 0
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

        // Spawn new targets if below quota
        if (Date.now() - this.lastSpawn > this.spawnRate && this.entities.filter(e => e.type === 'target').length < 5) {
            this.spawnEntity('target');
            this.lastSpawn = Date.now();
        }

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];

            e.x += e.vx * dt;
            e.y += e.vy * dt;

            if (e.x - e.size < 0 || e.x + e.size > this.game.canvas.width) e.vx *= -1;
            if (e.y - e.size < 0 || e.y + e.size > this.game.canvas.height) e.vy *= -1;

            if (e.type === 'bomb') {
                e.rotation += dt * 2;
            }
        }

        super.update(dt);
    }

    draw(ctx) {
        // Draw background first
        this.drawBackground(ctx);

        this.entities.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);

            if (e.type === 'target') {
                // 3D Military Target with depth

                // Shadow
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.beginPath();
                ctx.ellipse(e.size * 0.15, e.size * 1.1, e.size * 0.8, e.size * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();

                // Base sphere with gradient for 3D effect
                const gradient = ctx.createRadialGradient(
                    -e.size * 0.3, -e.size * 0.3, e.size * 0.1,
                    0, 0, e.size
                );
                gradient.addColorStop(0, "#7a9b5a"); // Lighter olive (highlight)
                gradient.addColorStop(0.4, "#556B2F"); // Dark Olive Green
                gradient.addColorStop(1, "#3a4a1f"); // Darker edge (shadow)
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, e.size, 0, Math.PI * 2);
                ctx.fill();

                // Rim highlight
                ctx.strokeStyle = "#8FBC8F";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, e.size * 0.85, 0, Math.PI * 2);
                ctx.stroke();

                // Inner ring with gradient
                const innerGrad = ctx.createRadialGradient(
                    -e.size * 0.2, -e.size * 0.2, e.size * 0.1,
                    0, 0, e.size * 0.7
                );
                innerGrad.addColorStop(0, "#9bc76a");
                innerGrad.addColorStop(1, "#6a8b3f");
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.arc(0, 0, e.size * 0.7, 0, Math.PI * 2);
                ctx.fill();

                // Crosshair with shadow
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 3;
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-e.size * 0.6, 0);
                ctx.lineTo(e.size * 0.6, 0);
                ctx.moveTo(0, -e.size * 0.6);
                ctx.lineTo(0, e.size * 0.6);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Skull icon with glow
                ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
                ctx.shadowBlur = 5;
                ctx.fillStyle = "#fff";
                ctx.font = "bold 24px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("☠", 0, 0);
                ctx.shadowBlur = 0;

            } else {
                // 3D Bomb
                ctx.rotate(e.rotation);

                // Shadow
                ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
                ctx.beginPath();
                ctx.ellipse(e.size * 0.2, e.size * 1.15, e.size * 0.85, e.size * 0.2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Bomb body with metallic gradient (3D sphere)
                const bombGrad = ctx.createRadialGradient(
                    -e.size * 0.35, -e.size * 0.35, e.size * 0.2,
                    0, 0, e.size
                );
                bombGrad.addColorStop(0, "#444"); // Highlight
                bombGrad.addColorStop(0.3, "#222");
                bombGrad.addColorStop(0.7, "#000"); // Main body
                bombGrad.addColorStop(1, "#111"); // Dark edge
                ctx.fillStyle = bombGrad;
                ctx.beginPath();
                ctx.arc(0, 0, e.size, 0, Math.PI * 2);
                ctx.fill();

                // Specular highlight for glossy effect
                ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                ctx.beginPath();
                ctx.arc(-e.size * 0.35, -e.size * 0.35, e.size * 0.25, 0, Math.PI * 2);
                ctx.fill();

                // Fuse with shadow
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 4;
                ctx.strokeStyle = "#8B4513";
                ctx.lineWidth = 6;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(0, -e.size);
                ctx.quadraticCurveTo(10, -e.size - 10, 20, -e.size - 5);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Spark with glow animation
                const sparkSize = 6 + Math.random() * 4;
                ctx.shadowColor = "#FF4500";
                ctx.shadowBlur = 15;
                const sparkGrad = ctx.createRadialGradient(20, -e.size - 5, 0, 20, -e.size - 5, sparkSize);
                sparkGrad.addColorStop(0, "#FFD700");
                sparkGrad.addColorStop(0.5, "#FF4500");
                sparkGrad.addColorStop(1, "#8B0000");
                ctx.fillStyle = sparkGrad;
                ctx.beginPath();
                ctx.arc(20, -e.size - 5, sparkSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Danger symbol with glow
                ctx.shadowColor = "rgba(255, 0, 0, 0.6)";
                ctx.shadowBlur = 8;
                ctx.fillStyle = "#ff0000";
                ctx.font = "bold 28px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("!", 0, 5);
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        });

        // Draw Quota - show progress and indicate when quota is reached
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        
        if (this.quotaReached) {
            ctx.fillStyle = "#00ff00";
            ctx.fillText(`ENEMIES: ${this.targetsHit} ✓ BONUS TIME!`, this.game.canvas.width / 2, 50);
        } else {
            ctx.fillStyle = "#fff";
            ctx.fillText(`ENEMIES: ${this.targetsHit} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);
        }

        super.drawParticles(ctx);
    }

    handleInput(x, y, playerIndex = 0) {
        super.handleInput(x, y, playerIndex);

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            const dx = x - e.x;
            const dy = y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < e.size) {
                if (e.type === 'bomb') {
                    // Hit Bomb! Penalty but continue playing
                    this.spawnExplosion(e.x, e.y, "#ff4400"); // Orange explosion for bomb
                    this.entities.splice(i, 1);
                    this.spawnEntity('bomb'); // Respawn a bomb
                    
                    // Apply penalty - lose a life but continue (unless out of lives)
                    this.applyPenalty(playerIndex);
                } else {
                    // Hit Target
                    this.game.sound.playHit();

                    // Granular scoring based on accuracy
                    // Center = 100%, Edge = 50%
                    const accuracyFactor = 1 - (dist / e.size) * 0.5;
                    const points = Math.ceil(100 * accuracyFactor);

                    this.recordHit(points, accuracyFactor, playerIndex, e.x, e.y);
                    this.incrementTargetsHit();

                    // Explosion
                    this.spawnExplosion(e.x, e.y, "#556B2F");

                    this.entities.splice(i, 1);
                    
                    // Round continues until time runs out - spawn replacement target
                    this.spawnEntity('target');
                }
                return;
            }
        }
        // Miss - didn't hit anything
        this.recordMiss(playerIndex);
    }
}
