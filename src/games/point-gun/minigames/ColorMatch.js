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

        // Difficulty scaling - time-based rounds with quota to pass
        if (difficulty === 'beginner') {
            this.targetQuota = 6;       // Need 6 correct colors to pass
            this.timeLimit = 25;        // 25 seconds
            this.spawnRate = 600;       // Spawn rate
            this.speed = 120;           // Slow movement
            this.colorsInPlay = 2;      // Only 2 colors (easier to identify)
            this.minLifetime = 2.5;
            this.maxLifetimeRange = 1.5;
        } else if (difficulty === 'medium') {
            this.targetQuota = 10;      // Need 10 to pass
            this.timeLimit = 25;
            this.spawnRate = 450;
            this.speed = 200;
            this.colorsInPlay = 3;      // 3 colors
            this.minLifetime = 2.0;
            this.maxLifetimeRange = 1.0;
        } else {
            this.targetQuota = 14;      // Need 14 to pass
            this.timeLimit = 25;
            this.spawnRate = 350;
            this.speed = 300;
            this.colorsInPlay = 4;      // All 4 colors
            this.minLifetime = 1.5;
            this.maxLifetimeRange = 1.0;
        }

        this.availableColors = colors.slice(0, this.colorsInPlay);
        // Ensure target color is available
        if (!this.availableColors.includes(this.targetColor)) {
            this.availableColors[this.colorsInPlay - 1] = this.targetColor;
        }

        this.lastSpawn = 0;
        this.lastTickTime = 0;
        this.isCountingDown = true;
        this.countdownTime = 3;

        // Animation state
        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            this.spawnCloud(true);
        }
        this.sunRotation = 0;

        // Scenery generation
        this.trees = [];
        this.flowers = [];
        this.generateScenery();


    }

    generateScenery() {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Trees on the mid-ground hill
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * w;
            // Approximate hill height at x
            const hillY = h * 0.75 + (Math.sin(x * 0.003 + 2) * 40 + Math.sin(x * 0.01) * 10);
            // Only place if not too low
            if (hillY < h - 50) {
                this.trees.push({
                    x: x,
                    y: hillY,
                    scale: 0.5 + Math.random() * 0.5,
                    type: Math.random() > 0.5 ? 'pine' : 'round'
                });
            }
        }

        // Flowers on the foreground hill
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * w;
            const hillY = h * 0.85 + (Math.sin(x * 0.005) * 20); // Simplified foreground curve approximation
            // Ensure on screen
            if (hillY < h) {
                this.flowers.push({
                    x: x,
                    y: hillY + Math.random() * (h - hillY), // Scatter down the slope
                    color: ['#ff69b4', '#ffff00', '#e0ffff'][Math.floor(Math.random() * 3)],
                    scale: 0.8 + Math.random() * 0.4
                });
            }
        }
    }

    spawnCloud(randomX = false) {
        const y = Math.random() * (this.game.canvas.height * 0.4);
        const x = randomX ? Math.random() * this.game.canvas.width : -150;
        const scale = 0.5 + Math.random() * 0.8;
        const speed = 20 + Math.random() * 30;

        this.clouds.push({ x, y, scale, speed });
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

            // Fade out in last 1.0 seconds (smoother)
            const fadeTime = 1.0;
            if (t.lifetime > t.maxLifetime - fadeTime) {
                const fadeProgress = (t.maxLifetime - t.lifetime) / fadeTime;
                t.opacity = Math.max(0, fadeProgress);
            }

            // Remove expired targets
            if (t.lifetime >= t.maxLifetime) {
                this.targets.splice(i, 1);
            }
        }

        // Update clouds
        this.sunRotation += dt * 0.2;
        for (let i = this.clouds.length - 1; i >= 0; i--) {
            const c = this.clouds[i];
            c.x += c.speed * dt;
            if (c.x > this.game.canvas.width + 150) {
                this.clouds.splice(i, 1);
                this.spawnCloud();
            }
        }

        // Call super update for particles
        super.update(dt);
    }

    draw(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const time = Date.now() * 0.001;

        // --- SKY & ATMOSPHERE ---
        // Richer sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
        skyGrad.addColorStop(0, "#4a90e2"); // Deep Sky Blue
        skyGrad.addColorStop(0.6, "#87cefa"); // Light Sky Blue
        skyGrad.addColorStop(1, "#e0f7fa"); // Pale Cyan
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Sun with glow
        ctx.save();
        ctx.translate(w * 0.85, h * 0.15);
        ctx.rotate(this.sunRotation);

        // Sun Glow
        const sunGlow = ctx.createRadialGradient(0, 0, 20, 0, 0, 100);
        sunGlow.addColorStop(0, "rgba(255, 215, 0, 0.8)");
        sunGlow.addColorStop(1, "rgba(255, 215, 0, 0)");
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 100, 0, Math.PI * 2);
        ctx.fill();

        // Sun Core
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- PARALLAX LANDSCAPE ---

        // Layer 1: Distant Mountains (Slowest)
        ctx.save();
        ctx.fillStyle = "#6a5acd"; // Slate Blue
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i <= w; i += 10) {
            const noise = Math.sin(i * 0.005 + 1) * 50 + Math.sin(i * 0.02) * 20;
            ctx.lineTo(i, h * 0.6 + noise);
        }
        ctx.lineTo(w, h);
        ctx.fill();
        // Atmospheric haze on mountains
        const hazeGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
        hazeGrad.addColorStop(0, "rgba(224, 247, 250, 0)");
        hazeGrad.addColorStop(1, "rgba(224, 247, 250, 0.5)");
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, h * 0.5, w, h * 0.5);
        ctx.restore();

        // Layer 2: Rolling Hills (Mid-ground) with Trees
        ctx.save();
        const hillGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
        hillGrad.addColorStop(0, "#558b2f"); // Darker Green top
        hillGrad.addColorStop(1, "#33691e"); // Dark Green bottom
        ctx.fillStyle = hillGrad;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i <= w; i += 10) {
            const noise = Math.sin(i * 0.003 + 2) * 40 + Math.sin(i * 0.01) * 10;
            ctx.lineTo(i, h * 0.75 + noise);
        }
        ctx.lineTo(w, h);
        ctx.fill();

        // Draw Trees
        this.trees.forEach(t => {
            this.drawTree(ctx, t.x, t.y, t.scale, t.type);
        });
        ctx.restore();

        // Layer 3: Foreground Grassy Hill (Closest) with Flowers
        ctx.save();
        const grassGrad = ctx.createLinearGradient(0, h * 0.8, 0, h);
        grassGrad.addColorStop(0, "#7cb342"); // Light Green
        grassGrad.addColorStop(1, "#558b2f");
        ctx.fillStyle = grassGrad;
        ctx.beginPath();
        ctx.moveTo(0, h);

        // More complex foreground curve
        ctx.lineTo(0, h * 0.85);
        for (let i = 0; i <= w; i += 20) {
            const y = h * 0.85 + Math.sin(i * 0.002) * 30 + Math.cos(i * 0.01) * 10;
            ctx.lineTo(i, y);
        }
        ctx.lineTo(w, h);
        ctx.fill();

        // Grass Texture (Noise)
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * w;
            const y = h * 0.8 + Math.random() * (h * 0.2);
            ctx.fillRect(x, y, 2, 2);
        }

        // Draw Flowers
        this.flowers.forEach(f => {
            this.drawFlower(ctx, f.x, f.y, f.color, f.scale);
        });
        ctx.restore();

        // --- VOLUMETRIC CLOUDS ---
        this.clouds.forEach(c => {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.scale(c.scale, c.scale);

            // Cloud Shadow (offset)
            ctx.fillStyle = "rgba(0,0,0,0.1)";
            this.drawCloudShape(ctx, 10, 10);

            // Cloud Body (Gradient for volume)
            const cloudGrad = ctx.createLinearGradient(0, -20, 0, 20);
            cloudGrad.addColorStop(0, "#ffffff");
            cloudGrad.addColorStop(1, "#e1f5fe");
            ctx.fillStyle = cloudGrad;
            this.drawCloudShape(ctx, 0, 0);

            ctx.restore();
        });

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
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 10;
            ctx.fillText("SHOOT ONLY:", ctx.canvas.width / 2, ctx.canvas.height / 2 - 80);
            ctx.shadowBlur = 0;

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

        // --- FURRY MONSTERS ---
        this.targets.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.opacity;
            ctx.translate(t.x, t.y);

            // Bobbing animation
            const bob = Math.sin(time * 5 + t.x * 0.01) * 5;
            ctx.translate(0, bob);

            const color = t.colorObj.hex;
            const radius = t.size;

            // Drop Shadow
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.beginPath();
            ctx.ellipse(0, radius * 1.5, radius * 0.6, radius * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Fur Rendering
            // Draw base body
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Draw fur strands
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            const strands = 24;
            for (let i = 0; i < strands; i++) {
                const angle = (i / strands) * Math.PI * 2;
                const len = radius * 0.2;
                const fx = Math.cos(angle) * radius;
                const fy = Math.sin(angle) * radius;

                // Fur variation
                const varLen = len + Math.sin(time * 10 + i) * 2;

                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * (radius * 0.8), Math.sin(angle) * (radius * 0.8));
                ctx.quadraticCurveTo(
                    Math.cos(angle) * (radius + varLen * 0.5),
                    Math.sin(angle) * (radius + varLen * 0.5),
                    Math.cos(angle + 0.2) * (radius + varLen),
                    Math.sin(angle + 0.2) * (radius + varLen)
                );
                ctx.stroke();
            }

            // Inner shading (Gradient)
            const bodyGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
            bodyGrad.addColorStop(0, "rgba(255,255,255,0.2)");
            bodyGrad.addColorStop(1, "rgba(0,0,0,0.1)");
            ctx.fillStyle = bodyGrad;
            ctx.fill();

            // Eyes (Glossy)
            const eyeOffset = radius * 0.3;
            const eyeSize = radius * 0.25;

            // Eye Whites
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(-eyeOffset, -radius * 0.1, eyeSize, 0, Math.PI * 2);
            ctx.arc(eyeOffset, -radius * 0.1, eyeSize, 0, Math.PI * 2);
            ctx.fill();

            // Eye Shadow (top)
            ctx.fillStyle = "rgba(0,0,0,0.1)";
            ctx.beginPath();
            ctx.arc(-eyeOffset, -radius * 0.1, eyeSize, Math.PI, 0);
            ctx.arc(eyeOffset, -radius * 0.1, eyeSize, Math.PI, 0);
            ctx.fill();

            // Pupils
            ctx.fillStyle = "#222";
            ctx.beginPath();
            ctx.arc(-eyeOffset, -radius * 0.1, eyeSize * 0.4, 0, Math.PI * 2);
            ctx.arc(eyeOffset, -radius * 0.1, eyeSize * 0.4, 0, Math.PI * 2);
            ctx.fill();

            // Specular Highlights (Important for realism)
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(-eyeOffset - eyeSize * 0.1, -radius * 0.1 - eyeSize * 0.1, eyeSize * 0.15, 0, Math.PI * 2);
            ctx.arc(eyeOffset - eyeSize * 0.1, -radius * 0.1 - eyeSize * 0.1, eyeSize * 0.15, 0, Math.PI * 2);
            ctx.fill();

            // Mouth (Cute small smile)
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(0, radius * 0.2, radius * 0.15, 0.2, Math.PI - 0.2);
            ctx.stroke();

            ctx.restore();
        });

        // Draw Quota
        ctx.font = "bold 30px Arial";
        ctx.fillStyle = this.targetColor.hex;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;

        let text;
        if (this.quotaReached) {
            text = `SHOOT ${this.targetColor.name}: ${this.targetsHit} ✓ BONUS TIME!`;
            ctx.fillStyle = "#00ff00";
        } else {
            text = `SHOOT ${this.targetColor.name}: ${this.targetsHit} / ${this.targetQuota}`;
        }
        ctx.strokeText(text, this.game.canvas.width / 2, 50);
        ctx.fillText(text, this.game.canvas.width / 2, 50);
        ctx.shadowBlur = 0;

        // Draw Particles (Explosions & Shot Indicators)
        super.drawParticles(ctx);
    }

    drawCloudShape(ctx, ox, oy) {
        ctx.beginPath();
        ctx.arc(ox, oy, 30, 0, Math.PI * 2);
        ctx.arc(ox + 25, oy - 10, 35, 0, Math.PI * 2);
        ctx.arc(ox + 50, oy, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    handleInput(x, y, playerIndex = 0) {
        super.handleInput(x, y, playerIndex);

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

                    // Granular scoring based on accuracy
                    // Center = 100%, Edge = 50%
                    const accuracyFactor = 1 - (dist / t.size) * 0.5;
                    const points = Math.ceil(200 * accuracyFactor);

                    this.recordHit(points, accuracyFactor, playerIndex, t.x, t.y);
                    this.incrementTargetsHit();

                    // Spawn explosion
                    this.spawnExplosion(t.x, t.y, t.colorObj.hex);

                    this.targets.splice(i, 1);
                    
                    // Always spawn a new target - round continues until time runs out
                    this.spawnTarget();
                } else {
                    // Wrong color! Penalty but continue playing
                    this.spawnExplosion(t.x, t.y, "#ff0000"); // Red explosion for wrong
                    this.targets.splice(i, 1);
                    this.spawnTarget();
                    
                    // Apply penalty - lose a life but continue (unless out of lives)
                    this.applyPenalty(playerIndex);
                }
                return;
            }
        }
        // Miss - didn't hit any target
        this.recordMiss(playerIndex);
    }

    drawTree(ctx, x, y, scale, type) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // Trunk
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(-5, 0, 10, -40);

        if (type === 'pine') {
            // Pine Tree
            ctx.fillStyle = "#2E7D32";
            ctx.beginPath();
            ctx.moveTo(-20, -30);
            ctx.lineTo(0, -80);
            ctx.lineTo(20, -30);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-25, -10);
            ctx.lineTo(0, -50);
            ctx.lineTo(25, -10);
            ctx.fill();
        } else {
            // Round Tree
            ctx.fillStyle = "#388E3C";
            ctx.beginPath();
            ctx.arc(0, -50, 25, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = "#4CAF50";
            ctx.beginPath();
            ctx.arc(-10, -60, 10, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawFlower(ctx, x, y, color, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // Stem
        ctx.strokeStyle = "#4CAF50";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(5, -10, 0, -20);
        ctx.stroke();

        // Petals
        ctx.fillStyle = color;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.rotate((Math.PI * 2) / 5);
            ctx.ellipse(0, -25, 5, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center
        ctx.fillStyle = "#FFEB3B";
        ctx.beginPath();
        ctx.arc(0, -25, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
