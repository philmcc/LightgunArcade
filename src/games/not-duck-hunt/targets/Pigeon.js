import { Target } from '../Target.js';

export class Pigeon extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 270; // 50% bigger than 180
        this.size = this.baseSize;
        this.basePoints = 200;
        this.speedMultiplier = 5.0; // Increased for faster movement
        this.hitboxMultiplier = 0.8;
        this.animationSpeed = 0.15; // Slowed down
        this.useSpriteHalf = 'left'; // Only use left half of sprite (one bird)
        this.consistentDirection = true; // Don't flip sprite based on direction
        this.frameCount = 1; // Use only frame 0 to avoid direction changes in sprite

        this.loadSprite('/not-duck-hunt/targets/target_pigeon_sheet_final.png', 1, 3, 1);
    }
}
