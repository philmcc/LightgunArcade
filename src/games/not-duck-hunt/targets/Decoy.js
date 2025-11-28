import { Target } from '../Target.js';

/**
 * Decoy - A penalty target that looks like a duck but shouldn't be shot
 * Shooting it causes point loss and breaks combo
 */
export class Decoy extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 340; // Similar to duck
        this.size = this.baseSize;
        this.basePoints = -150; // NEGATIVE points!
        this.speedMultiplier = 4.0; // Similar speed to duck
        this.hitboxMultiplier = 1.0;
        this.animationSpeed = 0.15;

        this.isDecoy = true;

        // Use same sprite but will be tinted differently
        this.loadSprite('/not-duck-hunt/targets/target_duck_sheet_v2.png', 6, 3, 2);
    }

    checkHit(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = (this.size / 2) * this.hitboxMultiplier;

        if (distance < hitRadius) {
            this.isHit = true;
            return {
                hit: true,
                points: this.basePoints, // Negative!
                distance: distance,
                isDecoy: true,
                penalty: true
            };
        }

        return { hit: false };
    }

    draw(ctx) {
        if (this.isOffScreen) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.spriteLoaded && this.sprite) {
            const frameWidth = this.sprite.width / this.spriteCols;
            const frameHeight = this.sprite.height / this.spriteRows;
            const col = this.animationFrame % this.spriteCols;
            const row = Math.floor(this.animationFrame / this.spriteCols);

            let scaleX = this.vx < 0 ? -1 : 1;
            ctx.scale(scaleX, 1);

            // Draw with red tint to indicate danger (subtle)
            // First draw the sprite
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

            // Add subtle red overlay to hint it's a decoy
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            // Draw a small "X" or warning indicator (visible but not too obvious)
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            const indicatorSize = 15;
            ctx.beginPath();
            ctx.moveTo(-indicatorSize, -this.size / 2 - 20 - indicatorSize);
            ctx.lineTo(indicatorSize, -this.size / 2 - 20 + indicatorSize);
            ctx.moveTo(indicatorSize, -this.size / 2 - 20 - indicatorSize);
            ctx.lineTo(-indicatorSize, -this.size / 2 - 20 + indicatorSize);
            ctx.stroke();
            ctx.globalAlpha = 1;

        } else {
            // Fallback - red tinted circle
            ctx.fillStyle = '#aa4444';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.restore();
    }

    // Override escape - decoys escaping is good for the player
    escape() {
        this.isEscaped = true;
        // No penalty for letting decoys escape
    }
}
