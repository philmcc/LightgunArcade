import { MiniGame } from '../MiniGame.js';

export class ColorMatch extends MiniGame {
    constructor(game, difficulty) {
        super(game, difficulty);

        const colors = [
            { name: 'RED', hex: '#ff0000' },
            { name: 'BLUE', hex: '#0000ff' },
            { name: 'GREEN', hex: '#00ff00' },
            { name: 'YELLOW', hex: '#ffff00' }
        ];

        this.targetColor = colors[Math.floor(Math.random() * colors.length)];
        this.objective = `SHOOT ${this.targetColor.name} ONLY!`;
        this.timeLimit = 20;
        this.targets = [];

        if (difficulty === 'beginner') {
            this.targetQuota = 5;
            this.spawnRate = 700;
            this.speed = 250;
            this.colorsInPlay = 2;
            this.timeLimit = 10;
            this.minLifetime = 1.5;
            this.maxLifetimeRange = 1.5;
        } else if (difficulty === 'medium') {
            this.targetQuota = 8;
            this.spawnRate = 500;
            this.speed = 400;
            this.colorsInPlay = 3;
            this.timeLimit = 10;
            this.minLifetime = 1.2;
            this.maxLifetimeRange = 1.3;
        } else {
            this.targetQuota = 12;
            this.spawnRate = 400;
            this.speed = 550;
            this.colorsInPlay = 4;
            this.timeLimit = 10;
            this.minLifetime = 1.0;
            this.maxLifetimeRange = 1.0;
        }

        this.availableColors = colors.slice(0, this.colorsInPlay);
        // Ensure target color is available
        if (!this.availableColors.includes(this.targetColor)) {
            this.availableColors[this.colorsInPlay - 1] = this.targetColor;
        }

        this.targetsShot = 0;
        this.lastSpawn = 0;
        this.lastTickTime = 0;
        this.isCountingDown = true;
        this.countdownTime = 3;

        // Load background
        this.loadBackground('/backgrounds/color_match.png');
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

        // Ensure target color spawns 60% of the time to make level winnable
        let colorObj;
        if (Math.random() < 0.6) {
            colorObj = this.targetColor;
        } else {
            // Spawn a different color
            const otherColors = this.availableColors.filter(c => c !== this.targetColor);
            // Handle case where there are no other colors (e.g., only one color in play)
            if (otherColors.length > 0) {
                colorObj = otherColors[Math.floor(Math.random() * otherColors.length)];
            } else {
                // If only target color is available, just spawn target color
                colorObj = this.targetColor;
            }
        }

        // Difficulty-based lifetime
        const maxLifetime = this.minLifetime + Math.random() * this.maxLifetimeRange;

        this.targets.push({
            x, y, size,
            colorObj: colorObj,
            vx: (Math.random() - 0.5) * this.speed,
            vy: (Math.random() - 0.5) * this.speed,
            lifetime: 0,
            maxLifetime: maxLifetime,
            opacity: 1.0
        });
    }

    update(dt) {
        // Handle countdown
        if (this.isCountingDown) {
            this.countdownTime -= dt;
            if (this.countdownTime <= 0) {
                this.isCountingDown = false;
                this.lastSpawn = Date.now();
            }
            return;
        }

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

        if (Date.now() - this.lastSpawn > this.spawnRate && this.targets.length < 8) {
            this.spawnTarget();
            this.lastSpawn = Date.now();
        }

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];

            t.x += t.vx * dt;
            t.y += t.vy * dt;

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

        // Show countdown screen
        if (this.isCountingDown) {
            const countdownNum = Math.ceil(this.countdownTime);

            // Semi-transparent overlay
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // Main instruction
            ctx.font = "bold 60px Arial";
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.fillText("SHOOT ONLY:", ctx.canvas.width / 2, ctx.canvas.height / 2 - 80);

            // Color name in the target color
            ctx.font = "bold 100px Arial";
            ctx.fillStyle = this.targetColor.hex;
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 5;
            ctx.strokeText(this.targetColor.name, ctx.canvas.width / 2, ctx.canvas.height / 2 + 20);
            ctx.fillText(this.targetColor.name, ctx.canvas.width / 2, ctx.canvas.height / 2 + 20);

            // Countdown number
            ctx.font = "bold 80px Arial";
            ctx.fillStyle = "#00ccff";
            ctx.fillText(countdownNum, ctx.canvas.width / 2, ctx.canvas.height / 2 + 120);

            return;
        }

        this.targets.forEach(t => {
            // Apply opacity for fade-out
            ctx.save();
            ctx.globalAlpha = t.opacity;

            // Main balloon body
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.fillStyle = t.colorObj.hex;
            ctx.fill();

            // Balloon outline
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.stroke();

            // Shiny highlight (top-left)
            const gradient = ctx.createRadialGradient(
                t.x - t.size * 0.3, t.y - t.size * 0.3, 0,
                t.x - t.size * 0.3, t.y - t.size * 0.3, t.size * 0.5
            );
            gradient.addColorStop(0, "rgba(255,255,255,0.8)");
            gradient.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.fill();

            // Balloon string
            ctx.strokeStyle = "rgba(0,0,0,0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y + t.size);
            ctx.quadraticCurveTo(
                t.x + 10, t.y + t.size + 20,
                t.x, t.y + t.size + 30
            );
            ctx.stroke();

            ctx.restore();
        });

        // Draw Quota
        ctx.font = "30px Arial";
        ctx.fillStyle = this.targetColor.hex;
        ctx.textAlign = "center";
        ctx.fillText(`SHOOT ${this.targetColor.name}: ${this.targetsShot} / ${this.targetQuota}`, this.game.canvas.width / 2, 50);
    }

    handleInput(x, y) {
        super.handleInput(x, y);

        // Don't allow shooting during countdown
        if (this.isCountingDown) {
            return;
        }

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const t = this.targets[i];
            const dx = x - t.x;
            const dy = y - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < t.size) {
                if (t.colorObj === this.targetColor) {
                    // Correct color
                    this.game.sound.playHit();
                    this.recordHit(200);
                    this.targetsShot++;
                    this.targets.splice(i, 1);

                    if (this.targetsShot >= this.targetQuota) {
                        this.complete();
                    } else {
                        this.spawnTarget();
                    }
                } else {
                    // Wrong color!
                    // Maybe play error sound?
                    this.game.sound.playGameOver(); // Reuse for now
                    this.fail();
                }
                return;
            }
        }
    }
}
