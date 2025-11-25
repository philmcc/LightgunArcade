import { MiniGame } from '../MiniGame.js';

export class BombPanic extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);
        this.objective = "SHOOT TARGETS! AVOID BOMBS!";
        this.timeLimit = 25;
        this.entities = [];

        if (difficulty === 'beginner') {
            this.targetQuota = 5;
            this.bombCount = 2;
            this.speed = 200;
            this.timeLimit = 20;
        } else if (difficulty === 'medium') {
            this.targetQuota = 10;
            this.bombCount = 4;
            this.speed = 350;
            this.timeLimit = 20;
        } else {
            this.targetQuota = 15;
            this.bombCount = 6;
            this.speed = 600;
            this.timeLimit = 20;
        }

        this.targetsShot = 0;
        this.lastTickTime = 0;

        // Load background
        this.loadBackground('/backgrounds/bomb_panic.png');
    }

    start() {
        super.start();
        this.entities = [];
        this.targetsShot = 0;

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

        // Ensure enough targets
        const targets = this.entities.filter(e => e.type === 'target');
        if (targets.length < 3) {
            this.spawnEntity('target');
        }

        this.entities.forEach(e => {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            e.rotation += dt * 2;

            if (e.x - e.size < 0 || e.x + e.size > this.game.canvas.width) e.vx *= -1;
            if (e.y - e.size < 0 || e.y + e.size > this.game.canvas.height) e.vy *= -1;
        });
    }

    draw(ctx) {
        // Draw background first
        this.drawBackground(ctx);

        this.entities.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);

            if (e.type === 'bomb') {
                // Draw Bomb with better graphics
                // Main bomb body
                ctx.fillStyle = "#1a1a1a";
                ctx.beginPath();
                ctx.arc(0, 0, e.size, 0, Math.PI * 2);
                ctx.fill();

                // Bomb highlight
                const gradient = ctx.createRadialGradient(-e.size * 0.3, -e.size * 0.3, 0, 0, 0, e.size);
                gradient.addColorStop(0, "rgba(80,80,80,0.8)");
                gradient.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, e.size, 0, Math.PI * 2);
                ctx.fill();

                // Fuse
                ctx.strokeStyle = "#8B4513";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, -e.size);
                ctx.quadraticCurveTo(15, -e.size - 15, 25, -e.size - 10);
                ctx.stroke();

                // Fuse spark
                ctx.fillStyle = "#ff6600";
                ctx.beginPath();
                ctx.arc(25, -e.size - 10, 5, 0, Math.PI * 2);
                ctx.fill();

                // Danger symbol
                ctx.fillStyle = "#ff0000";
                ctx.font = "bold 40px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("☠", 0, 0);

            } else {
                // Draw military-style Target
                // Camouflage base
                ctx.beginPath();
                ctx.arc(0, 0, e.size, 0, Math.PI * 2);
                ctx.fillStyle = "#4a5a3a";
                ctx.fill();

                // Orange center (military target style)
                ctx.beginPath();
                ctx.arc(0, 0, e.size * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = "#ff6600";
                ctx.fill();

                // White center dot
                ctx.beginPath();
                ctx.arc(0, 0, e.size * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();

                // Border
                ctx.strokeStyle = "#333";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, e.size, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        });

        ctx.font = "30px Arial";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(`TARGETS: ${this.targetsShot} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);
    }

    handleInput(x, y) {
        super.handleInput(x, y);

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            const dx = x - e.x;
            const dy = y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < e.size) {
                if (e.type === 'bomb') {
                    // Hit Bomb!
                    this.game.sound.playGameOver();
                    this.fail();
                } else {
                    // Hit Target
                    this.game.sound.playHit();

                    // Granular scoring based on accuracy
                    // Center = 100%, Edge = 50%
                    const accuracyFactor = 1 - (dist / e.size) * 0.5;
                    const points = Math.ceil(100 * accuracyFactor);

                    this.recordHit(points);
                    this.targetsShot++;
                    this.entities.splice(i, 1);

                    if (this.targetsShot >= this.targetQuota) {
                        this.complete();
                    }
                }
                return;
            }
        }
    }
}
