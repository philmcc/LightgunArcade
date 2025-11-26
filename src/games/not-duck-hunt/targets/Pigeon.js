import { Target } from '../Target.js';

export class Pigeon extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 65; // Smaller
        this.size = this.baseSize;
        this.basePoints = 200;
        this.speedMultiplier = 1.3;
        this.hitboxMultiplier = 0.8; // 20% smaller hitbox

        this.loadSprite('/not-duck-hunt/targets/pigeon.png');
    }
}
