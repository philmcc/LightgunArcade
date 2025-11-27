import { Target } from '../Target.js';

export class Pheasant extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 360; // Doubled from 180
        this.size = this.baseSize;
        this.basePoints = 150;
        this.speedMultiplier = 3.5; // Increased for faster movement
        this.hitboxMultiplier = 1.0;
        this.animationSpeed = 0.15; // Slower wing beat

        this.facesLeft = true; // Crow sprite faces Left
        this.loadSprite('/not-duck-hunt/targets/target_crow_sheet.png', 3);
    }
}
