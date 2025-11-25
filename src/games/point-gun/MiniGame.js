export class MiniGame {
    constructor(game, difficulty) {
        this.game = game;
        this.difficulty = difficulty; // 'beginner', 'medium', 'hard'
        this.objective = "SHOOT THE TARGETS!";
        this.timeLimit = 30;
        this.isComplete = false;
        this.isFailed = false;

        // Stats tracking
        this.stats = {
            shots: 0,
            hits: 0,
            misses: 0,
            startTime: 0,
            endTime: 0,
            baseScore: 0
        };

        // Score multiplier based on difficulty
        if (difficulty === 'beginner') {
            this.scoreMultiplier = 1.0;
        } else if (difficulty === 'medium') {
            this.scoreMultiplier = 1.5;
        } else {
            this.scoreMultiplier = 2.0;
        }

        // Background image
        this.backgroundImage = null;
    }

    loadBackground(imagePath) {
        this.backgroundImage = new Image();
        this.backgroundImage.src = imagePath;
    }

    drawBackground(ctx) {
        if (this.backgroundImage && this.backgroundImage.complete) {
            // Draw background to fill canvas
            ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
        } else {
            // Fallback gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
            gradient.addColorStop(0, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
    };

    start() {
        // Initialize game state
        this.stats.startTime = Date.now();
    }

    update(dt) {
        // Update game logic
    }

    draw(ctx) {
        // Render game
    }

    handleInput(x, y) {
        // Handle shots
        this.stats.shots++;
    }

    recordHit(points = 100) {
        this.stats.hits++;
        const multipliedPoints = Math.floor(points * this.scoreMultiplier);
        this.stats.baseScore += multipliedPoints;
        this.game.levelManager.score += multipliedPoints;
    }

    recordMiss() {
        this.stats.misses++;
    }

    complete() {
        this.stats.endTime = Date.now();
        this.isComplete = true;
    }

    fail() {
        this.stats.endTime = Date.now();
        this.isFailed = true;
    }

    getAccuracy() {
        if (this.stats.shots === 0) return 0;
        return (this.stats.hits / this.stats.shots) * 100;
    }

    getCompletionTime() {
        return (this.stats.endTime - this.stats.startTime) / 1000; // seconds
    }

    calculateBonuses() {
        const accuracy = this.getAccuracy();
        const time = this.getCompletionTime();

        // Accuracy bonus: up to 1000 points for perfect accuracy
        const accuracyBonus = Math.floor((accuracy / 100) * 1000);

        // Speed bonus: based on time remaining
        const timeBonus = Math.max(0, Math.floor(this.timeLimit - time) * 50);

        return {
            accuracy: accuracyBonus,
            speed: timeBonus,
            total: accuracyBonus + timeBonus
        };
    }
}
