import { Target } from '../Target.js';

export class Duck extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 360; // Doubled from 180
        this.size = this.baseSize;
        this.basePoints = 100;
        this.speedMultiplier = 4.5; // Increased for faster movement
        this.hitboxMultiplier = 1.0;
        this.animationSpeed = 0.15; // Slowed down

        this.loadSprite('/not-duck-hunt/targets/target_duck_sheet_v2.png', 6, 3, 2);
    }
}
