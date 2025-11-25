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
            baseScore: 0,
            totalAccuracyFactor: 0 // Sum of (1.0 = center, 0.5 = edge)
        };

        // Score multiplier based on difficulty
        if (difficulty === 'beginner') {
            this.scoreMultiplier = 1.0;
        } else if (difficulty === 'medium') {
            this.scoreMultiplier = 2.0;
        } else {
            this.scoreMultiplier = 3.0;
        }

        // Background image
        this.backgroundImage = null;

        // Shared Particle System
        this.explosions = [];
        this.shotIndicators = [];
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
        this.explosions = [];
        this.shotIndicators = [];
    }

    update(dt) {
        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const ex = this.explosions[i];
            ex.lifetime += dt;
            if (ex.lifetime >= ex.maxLifetime) {
                this.explosions.splice(i, 1);
                continue;
            }

            // Update particles
            ex.particles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 500 * dt; // Gravity
                p.alpha = 1 - (ex.lifetime / ex.maxLifetime);
            });
        }

        // Update shot indicators
        for (let i = this.shotIndicators.length - 1; i >= 0; i--) {
            const ind = this.shotIndicators[i];
            ind.lifetime += dt;
            if (ind.lifetime >= 0.5) { // 0.5s duration
                this.shotIndicators.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Render game
    }

    drawParticles(ctx) {
        // Draw Explosions
        this.explosions.forEach(ex => {
            ex.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.translate(p.x, p.y);
                ctx.fillStyle = ex.color;
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        });

        // Draw Shot Indicators
        this.shotIndicators.forEach(ind => {
            ctx.save();
            ctx.globalAlpha = 1 - (ind.lifetime / 0.5);
            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ind.x, ind.y, 5, 0, Math.PI * 2);
            ctx.moveTo(ind.x - 8, ind.y);
            ctx.lineTo(ind.x + 8, ind.y);
            ctx.moveTo(ind.x, ind.y - 8);
            ctx.lineTo(ind.x, ind.y + 8);
            ctx.stroke();

            // Draw "SHOT" text
            ctx.fillStyle = "#ff0000";
            ctx.font = "10px Arial";
            ctx.fillText("SHOT", ind.x + 10, ind.y - 10);
            ctx.restore();
        });
    }

    handleInput(x, y) {
        // Handle shots
        this.stats.shots++;
        this.spawnShotIndicator(x, y);
    }

    spawnExplosion(x, y, color) {
        const particles = [];
        const particleCount = 20;

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 5 + Math.random() * 10,
                alpha: 1.0
            });
        }

        this.explosions.push({
            particles: particles,
            color: color,
            lifetime: 0,
            maxLifetime: 0.5
        });
    }

    spawnShotIndicator(x, y) {
        this.shotIndicators.push({
            x: x,
            y: y,
            lifetime: 0
        });
    }

    recordHit(points = 100, accuracyFactor = 1.0) {
        this.stats.hits++;
        this.stats.totalAccuracyFactor += accuracyFactor;

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

    getPinpointAccuracy() {
        if (this.stats.hits === 0) return 0;
        return (this.stats.totalAccuracyFactor / this.stats.hits) * 100;
    }

    getCompletionTime() {
        return (this.stats.endTime - this.stats.startTime) / 1000; // seconds
    }

    calculateBonuses() {
        const accuracy = this.getAccuracy();
        const pinpointAccuracy = this.getPinpointAccuracy();
        const time = this.getCompletionTime();

        // Accuracy bonus: up to 1000 points for perfect hit/miss ratio
        const accuracyBonus = Math.floor((accuracy / 100) * 1000 * this.scoreMultiplier);

        // Pinpoint bonus: up to 1000 points for perfect center shots
        const pinpointBonus = Math.floor((pinpointAccuracy / 100) * 1000 * this.scoreMultiplier);

        // Speed bonus: based on time remaining (this.timeLimit is the remaining time)
        const timeBonus = Math.max(0, Math.floor(this.timeLimit) * 100 * this.scoreMultiplier);

        return {
            accuracy: accuracyBonus,
            pinpoint: pinpointBonus,
            speed: timeBonus,
            total: accuracyBonus + pinpointBonus + timeBonus,
            pinpointPercent: pinpointAccuracy
        };
    }
}
