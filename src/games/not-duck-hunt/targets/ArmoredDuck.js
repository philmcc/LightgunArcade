import { Target } from '../Target.js';

/**
 * ArmoredDuck - A tougher duck that requires 2 hits to kill
 * Appears in later rounds, worth more points
 */
export class ArmoredDuck extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 380; // Slightly larger than regular duck
        this.size = this.baseSize;
        this.basePoints = 200; // Worth more
        this.speedMultiplier = 3.5; // Slower than regular duck
        this.hitboxMultiplier = 1.0;
        this.animationSpeed = 0.15;

        // Armor system
        this.hitsRequired = 2;
        this.hitsTaken = 0;
        this.isArmored = true;

        this.loadSprite('/not-duck-hunt/targets/target_duck_sheet_v2.png', 6, 3, 2);
    }

    checkHit(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = (this.size / 2) * this.hitboxMultiplier;

        if (distance < hitRadius) {
            this.hitsTaken++;
            
            if (this.hitsTaken >= this.hitsRequired) {
                // Fully destroyed
                this.isHit = true;
                this.isArmored = false;
                return {
                    hit: true,
                    points: this.calculatePoints(distance, hitRadius),
                    distance: distance,
                    armorBroken: true
                };
            } else {
                // Armor damaged but not destroyed
                return {
                    hit: true,
                    points: 25, // Small points for damaging armor
                    distance: distance,
                    armorDamaged: true,
                    hitsRemaining: this.hitsRequired - this.hitsTaken
                };
            }
        }

        return { hit: false };
    }

    draw(ctx) {
        if (this.isOffScreen) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw armor indicator (metallic sheen)
        if (this.isArmored && this.hitsTaken === 0) {
            ctx.shadowColor = '#888888';
            ctx.shadowBlur = 25;
        } else if (this.isArmored && this.hitsTaken > 0) {
            // Damaged armor - orange glow
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 20;
        }

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

            // Draw armor overlay (semi-transparent metallic layer)
            if (this.isArmored) {
                ctx.globalAlpha = this.hitsTaken === 0 ? 0.3 : 0.15;
                ctx.fillStyle = '#666666';
                ctx.beginPath();
                ctx.arc(0, 0, this.size / 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                
                // Draw hit indicator
                if (this.hitsTaken > 0) {
                    ctx.font = 'bold 20px Arial';
                    ctx.fillStyle = '#ff0000';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${this.hitsRequired - this.hitsTaken}`, 0, -this.size / 2 - 10);
                }
            }
        } else {
            // Fallback
            ctx.fillStyle = this.isArmored ? '#666666' : '#8B4513';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
