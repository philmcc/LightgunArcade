import { Target } from '../Target.js';

export class Duck extends Target {
    constructor(game, canvasWidth, canvasHeight) {
        super(game, canvasWidth, canvasHeight);

        this.baseSize = 80;
        this.size = this.baseSize;
        this.basePoints = 100;
        this.speedMultiplier = 1.0;
        this.hitboxMultiplier = 1.0;

        this.loadSprite('/not-duck-hunt/targets/duck.png');
    }
}
