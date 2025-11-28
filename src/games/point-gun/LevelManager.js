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
        
        // Track recently played games to avoid repeats
        this.recentGames = [];
        this.maxRecentGames = 2; // Don't repeat last 2 games
        
        // Difficulty scaling factors (increase per stage)
        this.speedScale = 1.0;
        this.sizeScale = 1.0;
        this.timeScale = 1.0;

        this.isPracticeMode = false;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        // Endless mode: difficulty only affects game parameters, not stage count
        this.lives = 3;
        this.score = 0;
        this.currentStage = 0;
        
        // Reset scaling
        this.speedScale = 1.0;
        this.sizeScale = 1.0;
        this.timeScale = 1.0;
        this.recentGames = [];
    }

    startNextStage() {
        // Endless mode: No stage limit check here.
        // Game ends only when lives <= 0 (handled in update)

        this.currentStage++;
        
        // Update difficulty scaling based on stage
        this.updateDifficultyScaling();

        // Pick a random game from the pool, avoiding recent games
        const GameClass = this.pickNextGame();
        this.currentGame = new GameClass(this.game, this.difficulty);
        
        // Apply difficulty scaling to the mini-game
        this.applyScalingToGame(this.currentGame);

        // Notify Game to show intro, then start
        this.game.showStageIntro(this.currentStage, this.currentGame.objective, () => {
            this.currentGame.start();
            this.game.state = "PLAYING";
            // Hide cursors for gameplay (SDK method)
            this.game.setInGame(true);
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

    handleInput(x, y, playerIndex = 0) {
        if (this.currentGame && this.game.state === "PLAYING") {
            this.currentGame.handleInput(x, y, playerIndex);
        }
    }
    
    /**
     * Update difficulty scaling based on current stage
     */
    updateDifficultyScaling() {
        const stage = this.currentStage;
        
        // Speed increases 5% per stage
        this.speedScale = 1.0 + (stage - 1) * 0.05;
        
        // Size decreases 3% per stage (min 70%)
        this.sizeScale = Math.max(0.7, 1.0 - (stage - 1) * 0.03);
        
        // Time limit decreases 3% per stage (min 70%)
        this.timeScale = Math.max(0.7, 1.0 - (stage - 1) * 0.03);
    }
    
    /**
     * Pick next game, avoiding recent games
     * @returns {Function} Game class constructor
     */
    pickNextGame() {
        // Filter out recently played games
        let availableGames = this.gamePool.filter(g => !this.recentGames.includes(g));
        
        // If all games are recent (shouldn't happen), reset
        if (availableGames.length === 0) {
            availableGames = this.gamePool;
            this.recentGames = [];
        }
        
        // Pick random from available
        const GameClass = availableGames[Math.floor(Math.random() * availableGames.length)];
        
        // Track this game as recent
        this.recentGames.push(GameClass);
        if (this.recentGames.length > this.maxRecentGames) {
            this.recentGames.shift();
        }
        
        return GameClass;
    }
    
    /**
     * Apply difficulty scaling to a mini-game
     * @param {MiniGame} game - The mini-game instance
     */
    applyScalingToGame(game) {
        // Scale time limit
        if (game.timeLimit) {
            game.timeLimit = Math.floor(game.timeLimit * this.timeScale);
        }
        
        // Scale speed (if the game has a speed property)
        if (game.speed) {
            game.speed = Math.floor(game.speed * this.speedScale);
        }
        if (game.targetSpeed) {
            game.targetSpeed = Math.floor(game.targetSpeed * this.speedScale);
        }
        
        // Scale target size (if the game has a targetSize property)
        if (game.targetSize) {
            game.targetSize = Math.floor(game.targetSize * this.sizeScale);
        }
        
        // Scale reaction time for QuickDraw (make it harder)
        if (game.reactionTime) {
            game.reactionTime = game.reactionTime * this.timeScale;
        }
    }
    
    /**
     * Get current scaling info (for display)
     * @returns {Object} Scaling factors
     */
    getScalingInfo() {
        return {
            speedScale: this.speedScale,
            sizeScale: this.sizeScale,
            timeScale: this.timeScale,
            stage: this.currentStage
        };
    }
}
