import { ClassicTarget } from './minigames/ClassicTarget.js';
import { ColorMatch } from './minigames/ColorMatch.js';
import { BombPanic } from './minigames/BombPanic.js';
import { QuickDraw } from './minigames/QuickDraw.js';
// Import other games as they are created

export class LevelManager {
    constructor(game) {
        this.game = game;
        this.difficulty = 'beginner';
        this.currentStage = 0;
        this.totalStages = 4;
        this.lives = 3;
        this.score = 0;
        this.currentGame = null;

        // Pool of available games
        this.gamePool = [
            ClassicTarget,
            ColorMatch,
            BombPanic,
            QuickDraw
            // Add others here
        ];

        this.isDebugMode = false;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        if (diff === 'beginner') this.totalStages = 4;
        else if (diff === 'medium') this.totalStages = 8;
        else if (diff === 'hard') this.totalStages = 12;

        this.lives = 3;
        this.score = 0;
        this.currentStage = 0;
    }

    startNextStage() {
        if (this.currentStage >= this.totalStages) {
            this.game.gameClear(this.score);
            return;
        }

        this.currentStage++;

        // Pick a random game from the pool
        const GameClass = this.gamePool[Math.floor(Math.random() * this.gamePool.length)];
        this.currentGame = new GameClass(this.game, this.difficulty);

        // Notify Game to show intro, then start
        this.game.showStageIntro(this.currentStage, this.currentGame.objective, () => {
            this.currentGame.start();
            this.game.state = "PLAYING";
        });
    }

    update(dt) {
        if (this.currentGame && this.game.state === "PLAYING") {
            this.currentGame.update(dt);

            if (this.currentGame.isComplete) {
                if (this.isDebugMode) {
                    // In debug mode, return to debug menu
                    this.game.showStageResult(true, () => this.game.showDebugMenu());
                } else {
                    this.game.showStageResult(true, () => this.startNextStage());
                }
            } else if (this.currentGame.isFailed) {
                if (this.isDebugMode) {
                    // In debug mode, return to debug menu
                    this.game.showStageResult(false, () => this.game.showDebugMenu());
                } else {
                    this.lives--;
                    if (this.lives <= 0) {
                        this.game.gameOver();
                    } else {
                        this.game.showStageResult(false, () => this.startNextStage());
                    }
                }
            }
        }
    }

    draw(ctx) {
        if (this.currentGame && this.game.state === "PLAYING") {
            this.currentGame.draw(ctx);
        }
    }

    handleInput(x, y) {
        if (this.currentGame && this.game.state === "PLAYING") {
            this.currentGame.handleInput(x, y);
        }
    }
}
