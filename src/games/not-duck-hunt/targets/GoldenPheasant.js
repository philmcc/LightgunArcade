import { Target } from '../Target.js';

/**
 * GoldenPheasant - A fast, small, high-value target
 * Rare spawn, very rewarding to hit
 */
export class GoldenPheasant extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 280; // Smaller than regular pheasant
        this.size = this.baseSize;
        this.basePoints = 500; // High value!
        this.speedMultiplier = 7.0; // Very fast
        this.hitboxMultiplier = 0.8; // Smaller hitbox
        this.animationSpeed = 0.1; // Fast animation

        this.isBonus = true; // Always golden
        this.isGoldenPheasant = true;

        // Use crow sprite (same as Pheasant)
        this.facesLeft = true;
        this.loadSprite('/not-duck-hunt/targets/target_crow_sheet.png', 3);
    }

    spawn(difficulty, roundNumber, speedScale = 1.0) {
        // Golden pheasants always come from a random side and move fast
        const margin = this.size;
        const side = Math.random() < 0.5 ? 0 : 1;

        // Extra fast base speed
        const baseSpeed = (180 + (roundNumber * 15)) * speedScale;
        const speed = baseSpeed * this.speedMultiplier;

        // Spawn in upper portion of screen
        const minY = margin;
        const maxY = this.canvasHeight * 0.4; // Higher up
        this.y = minY + Math.random() * (maxY - minY);

        if (side === 0) {
            this.x = -margin;
            this.vx = speed * (0.9 + Math.random() * 0.3);
        } else {
            this.x = this.canvasWidth + margin;
            this.vx = -speed * (0.9 + Math.random() * 0.3);
        }

        // More erratic vertical movement
        this.vy = (Math.random() - 0.5) * speed * 0.5;

        // Always use zigzag pattern for unpredictability
        this.flightPattern = 'zigzag';
    }

    update(dt) {
        super.update(dt);

        // Extra erratic movement
        if (!this.isHit && !this.isEscaped) {
            // Occasional sudden direction changes
            if (Math.random() < 0.02) {
                this.vy = (Math.random() - 0.5) * 200;
            }
        }
    }

    draw(ctx) {
        if (this.isOffScreen) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Strong golden glow
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 30;

        if (this.spriteLoaded && this.sprite) {
            const frameWidth = this.sprite.width / this.spriteCols;
            const frameHeight = this.sprite.height / this.spriteRows;
            const col = this.animationFrame % this.spriteCols;
            const row = Math.floor(this.animationFrame / this.spriteCols);

            let scaleX = this.vx < 0 ? -1 : 1;
            ctx.scale(scaleX, 1);

            ctx.drawImage(
                this.sprite,
                Math.floor(col * frameWidth),
                Math.floor(row * frameHeight),
                Math.floor(frameWidth),
                Math.floor(frameHeight),
                -this.size / 2,
                -this.size / 2,
                this.size,
                this.size
            );

            // Add golden overlay
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            // Draw sparkle effect
            this.drawSparkles(ctx);

        } else {
            // Fallback golden circle
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawSparkles(ctx) {
        const time = performance.now() / 1000;
        const sparkleCount = 4;
        
        ctx.fillStyle = '#ffffff';
        
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (time * 2 + i * (Math.PI * 2 / sparkleCount)) % (Math.PI * 2);
            const distance = this.size / 2.5;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const sparkleSize = 3 + Math.sin(time * 5 + i) * 2;
            
            ctx.globalAlpha = 0.6 + Math.sin(time * 3 + i) * 0.4;
            ctx.beginPath();
            ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
