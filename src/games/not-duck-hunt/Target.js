export class Target {
    constructor(game, canvasWidth, canvasHeight) {
        this.game = game;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        // Base properties (to be overridden)
        this.baseSize = 80;
        this.size = this.baseSize;
        this.basePoints = 100;
        this.speedMultiplier = 1.0;
        this.hitboxMultiplier = 1.0;

        // State
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.isHit = false;
        this.isEscaped = false;
        this.isOffScreen = false;

        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 0.15; // seconds per frame
        this.rotation = 0;

        // Flight pattern
        this.flightPattern = 'linear';
        this.patternTimer = 0;
        this.patternChangeInterval = 0.5;

        // Sprite
        this.sprite = null;
        this.spriteLoaded = false;

        // Bonus flag
        this.isBonus = false;
    }

    loadSprite(imagePath) {
        this.sprite = new Image();
        this.sprite.onload = () => {
            this.spriteLoaded = true;
        };
        this.sprite.src = imagePath;
    }

    spawn(difficulty, roundNumber) {
        // Safety margin from edges to keep targets fully visible
        const margin = this.size;

        // Determine spawn edge (0=top, 1=right, 2=bottom, 3=left)
        const edge = Math.floor(Math.random() * 4);

        // Base speed increases with round number
        const baseSpeed = 150 + (roundNumber * 20);
        const speed = baseSpeed * this.speedMultiplier;

        // Spawn position and velocity based on edge - targets start INSIDE screen
        switch (edge) {
            case 0: // Top - spawn at top edge, move downward/diagonal
                this.x = margin + Math.random() * (this.canvasWidth - margin * 2);
                this.y = margin;
                this.vx = (Math.random() - 0.5) * speed * 0.8;
                this.vy = speed * (0.5 + Math.random() * 0.5);
                break;
            case 1: // Right - spawn at right edge, move leftward/diagonal
                this.x = this.canvasWidth - margin;
                this.y = margin + Math.random() * (this.canvasHeight - margin * 2);
                this.vx = -speed * (0.5 + Math.random() * 0.5);
                this.vy = (Math.random() - 0.5) * speed * 0.8;
                break;
            case 2: // Bottom - spawn at bottom edge, move upward/diagonal
                this.x = margin + Math.random() * (this.canvasWidth - margin * 2);
                this.y = this.canvasHeight - margin;
                this.vx = (Math.random() - 0.5) * speed * 0.8;
                this.vy = -speed * (0.5 + Math.random() * 0.5);
                break;
            case 3: // Left - spawn at left edge, move rightward/diagonal
                this.x = margin;
                this.y = margin + Math.random() * (this.canvasHeight - margin * 2);
                this.vx = speed * (0.5 + Math.random() * 0.5);
                this.vy = (Math.random() - 0.5) * speed * 0.8;
                break;
        }

        // Set flight pattern based on difficulty
        const patterns = ['linear', 'curved', 'zigzag'];
        if (difficulty === 'hard' && roundNumber > 3) {
            patterns.push('erratic', 'erratic'); // Higher chance of erratic
        }
        this.flightPattern = patterns[Math.floor(Math.random() * patterns.length)];
    }

    update(dt) {
        if (this.isHit) {
            // Fall animation
            this.y += 300 * dt;
            this.rotation += 5 * dt;

            if (this.y > this.canvasHeight + this.size) {
                this.isOffScreen = true;
            }
            return;
        }

        if (this.isEscaped) {
            // Fly away upward
            this.y -= 400 * dt;

            if (this.y < -this.size * 2) {
                this.isOffScreen = true;
            }
            return;
        }

        // Update flight pattern
        this.patternTimer += dt;

        switch (this.flightPattern) {
            case 'linear':
                // No changes, maintain velocity
                break;

            case 'curved':
                // Add gravity effect
                this.vy += 100 * dt;
                break;

            case 'zigzag':
                // Oscillate horizontally
                const zigzagSpeed = 200;
                this.vx = Math.sin(this.patternTimer * 3) * zigzagSpeed;
                break;

            case 'erratic':
                // Random direction changes
                if (this.patternTimer > this.patternChangeInterval) {
                    this.patternTimer = 0;
                    this.vx += (Math.random() - 0.5) * 200;
                    this.vy += (Math.random() - 0.5) * 200;

                    // Clamp speed
                    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                    const maxSpeed = 500;
                    if (currentSpeed > maxSpeed) {
                        this.vx = (this.vx / currentSpeed) * maxSpeed;
                        this.vy = (this.vy / currentSpeed) * maxSpeed;
                    }
                }
                break;
        }

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Update animation
        this.animationTimer += dt;
        if (this.animationTimer > this.animationSpeed) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % 3; // 3 frame animation
        }

        // Check if escaped off screen
        const margin = this.size * 2;
        if (this.x < -margin || this.x > this.canvasWidth + margin ||
            this.y < -margin || this.y > this.canvasHeight + margin) {
            this.isEscaped = true;
        }
    }

    draw(ctx) {
        if (this.isOffScreen) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.spriteLoaded && this.sprite) {
            // Draw sprite with slight bobbing animation
            const bobOffset = Math.sin(this.animationTimer * 10) * 2;

            // Flip sprite based on direction
            if (this.vx < 0) {
                ctx.scale(-1, 1);
            }

            // Add golden glow if bonus
            if (this.isBonus) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 20;
            }

            ctx.drawImage(
                this.sprite,
                -this.size / 2,
                -this.size / 2 + bobOffset,
                this.size,
                this.size
            );
        } else {
            // Fallback colored circle
            ctx.fillStyle = this.isBonus ? '#ffd700' : '#8B4513';
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }

    checkHit(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const hitRadius = (this.size / 2) * this.hitboxMultiplier;

        if (distance < hitRadius) {
            this.isHit = true;
            return {
                hit: true,
                points: this.calculatePoints(distance, hitRadius),
                distance: distance
            };
        }

        return { hit: false };
    }

    calculatePoints(distance, hitRadius) {
        // Bonus points for center hits
        const accuracyFactor = 1 - (distance / hitRadius);
        let points = Math.floor(this.basePoints * (0.5 + accuracyFactor * 0.5));

        // Double points for bonus targets
        if (this.isBonus) {
            points *= 2;
        }

        return points;
    }

    escape() {
        this.isEscaped = true;
    }
}
