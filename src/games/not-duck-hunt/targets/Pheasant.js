import { Target } from '../Target.js';

export class Pheasant extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 90;
        this.size = this.baseSize;
        this.basePoints = 150;
        this.speedMultiplier = 1.5; // Faster than ducks
        this.hitboxMultiplier = 1.0;

        this.loadSprite('/not-duck-hunt/targets/pheasant.png');
    }
}
