import { Target } from '../Target.js';

export class ClayPigeon extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 50;
        this.size = this.baseSize;
        this.basePoints = 250;
        this.speedMultiplier = 1.0;
        this.hitboxMultiplier = 0.9;

        this.loadSprite('/not-duck-hunt/targets/clay_pigeon.png');

        // Clay pigeons use arc trajectory
        this.flightPattern = 'curved';
    }

    spawn(difficulty, roundNumber) {
        // Always launch from bottom with upward arc
        this.x = Math.random() * (this.canvasWidth * 0.8) + this.canvasWidth * 0.1;
        this.y = this.canvasHeight + this.size;

        // Launch upward with horizontal velocity
        const baseSpeed = 200 + (roundNumber * 15);
        this.vx = (Math.random() - 0.5) * baseSpeed * 1.5;
        this.vy = -baseSpeed * (1.5 + Math.random() * 0.5);

        this.flightPattern = 'curved'; // Always curved for clay pigeons
    }

    update(dt) {
        super.update(dt);

        // Rotate continuously (spinning disc)
        if (!this.isHit) {
            this.rotation += 10 * dt;
        }
    }

    draw(ctx) {
        if (this.isHit) {
            // Draw shattered pieces
            this.drawShattered(ctx);
        } else {
            super.draw(ctx);
        }
    }

    drawShattered(ctx) {
        // Draw 4-5 orange fragments falling
        ctx.save();
        ctx.fillStyle = '#ff6600';

        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const distance = this.size * 0.5;
            const x = this.x + Math.cos(angle + this.rotation) * distance;
            const y = this.y + Math.sin(angle + this.rotation) * distance + (this.rotation * 50);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(this.rotation * (i + 1));
            ctx.fillRect(-10, -5, 20, 10);
            ctx.restore();
        }

        ctx.restore();
    }
}
