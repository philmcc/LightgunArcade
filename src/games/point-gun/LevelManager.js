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

        this.isPracticeMode = false;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        // Endless mode: difficulty only affects game parameters, not stage count
        this.lives = 3;
        this.score = 0;
        this.currentStage = 0;
    }

    startNextStage() {
        // Endless mode: No stage limit check here.
        // Game ends only when lives <= 0 (handled in update)

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
        try {
            if (this.currentGame && this.game.state === "PLAYING") {
                this.currentGame.update(dt);

                if (this.currentGame.isComplete) {
                    if (this.isPracticeMode) {
                        // In practice mode, return to practice menu
                        this.game.showStageResult(true, () => this.game.showPracticeMenu());
                    } else {
                        this.game.showStageResult(true, () => this.startNextStage());
                    }
                } else if (this.currentGame.isFailed) {
                    if (this.isPracticeMode) {
                        // In practice mode, return to practice menu (but show stats first)
                        this.game.showStageResult(false, () => this.game.showPracticeMenu());
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
        } catch (e) {
            console.error("Error in LevelManager update:", e);
            // Alert the user to the error for debugging
            alert("Game Error: " + e.message);
            // Attempt to recover by going to menu
            this.game.showMenu();
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
