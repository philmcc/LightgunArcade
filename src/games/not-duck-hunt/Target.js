export class Target {
    constructor(game, canvasWidth, canvasHeight) {
        this.game = game;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;

        // Base properties (to be overridden)
        this.baseSize = 180; // Increased size (50% bigger than 120)
        this.size = this.baseSize;
        this.basePoints = 100;
        this.speedMultiplier = 0.6;
        this.hitboxMultiplier = 0.7; // Smaller hitbox relative to very large sprite

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
        this.animationSpeed = 0.08; // Faster animation for smoothness
        this.frameCount = 3;
        this.spriteCols = 3; // Default to horizontal strip
        this.spriteRows = 1;
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

    loadSprite(imagePath, frameCount = 3, cols = 0, rows = 1) {
        this.frameCount = frameCount;
        this.spriteCols = cols || frameCount; // Default cols to frameCount if not specified
        this.spriteRows = rows;
        const img = new Image();
        img.onload = () => {
            // Create a temporary canvas to process the image
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Draw image
            ctx.drawImage(img, 0, 0);

            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Loop through pixels and make white transparent
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // If pixel is near white (allow some variance for compression artifacts)
                if (r > 240 && g > 240 && b > 240) {
                    data[i + 3] = 0; // Set alpha to 0
                }
            }

            // Put modified data back
            ctx.putImageData(imageData, 0, 0);

            // Store the canvas directly as the sprite
            this.sprite = canvas;
            this.spriteLoaded = true;
        };
        img.src = imagePath;
    }

    spawn(difficulty, roundNumber, speedScale = 1.0) {
        // Safety margin to spawn fully off-screen
        const margin = this.size;

        // Determine spawn side (0=left, 1=right)
        const side = Math.random() < 0.5 ? 0 : 1;

        // Base speed increases slightly with round number, modified by speedScale
        const baseSpeed = (100 + (roundNumber * 10)) * speedScale;
        const speed = baseSpeed * this.speedMultiplier;

        // Spawn position and velocity
        // Spawn in the upper 60% of the screen (sky area)
        const minY = margin;
        const maxY = this.canvasHeight * 0.6;
        this.y = minY + Math.random() * (maxY - minY);

        if (side === 0) { // Left -> Right
            this.x = -margin;
            this.vx = speed * (0.8 + Math.random() * 0.4);
        } else { // Right -> Left
            this.x = this.canvasWidth + margin;
            this.vx = -speed * (0.8 + Math.random() * 0.4);
        }

        // More varied vertical movement for interesting flight paths
        this.vy = (Math.random() - 0.5) * speed * 0.3;

        // Set flight pattern based on difficulty
        const patterns = ['linear', 'curved'];
        if (difficulty === 'hard' && roundNumber > 3) {
            patterns.push('zigzag');
        }
        this.flightPattern = patterns[Math.floor(Math.random() * patterns.length)];
    }

    update(dt) {
        if (this.isHit) {
            // Fall animation
            this.y += 400 * dt;
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
                // Maintain velocity
                break;

            case 'curved':
                // More pronounced sine wave for variety
                this.vy += Math.cos(this.patternTimer * 3) * 80 * dt;
                break;

            case 'zigzag':
                // More dramatic turns
                this.vy = Math.sin(this.patternTimer * 6) * 150;
                break;
        }

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Update animation
        this.animationTimer += dt;
        if (this.animationTimer > this.animationSpeed) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % this.frameCount;
        }

        // Check if escaped off screen (opposite side)
        const margin = this.size * 2;
        if ((this.vx > 0 && this.x > this.canvasWidth + margin) ||
            (this.vx < 0 && this.x < -margin)) {
            this.isEscaped = true;
            this.isOffScreen = true; // Mark as off-screen immediately for horizontal escape
        }
    }

    draw(ctx) {
        if (this.isOffScreen) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.spriteLoaded && this.sprite) {
            // Draw sprite with animation
            const frameWidth = this.sprite.width / this.spriteCols;
            const frameHeight = this.sprite.height / this.spriteRows;

            // Calculate col and row for current frame
            const col = this.animationFrame % this.spriteCols;
            const row = Math.floor(this.animationFrame / this.spriteCols);

            // Flip sprite based on direction and default orientation
            // Default assumption: Sprite faces RIGHT
            // If vx < 0 (moving left), we flip.
            // If sprite faces LEFT by default, we need to invert this.

            let scaleX = 1;
            // Only flip based on direction if not set to consistent direction
            if (this.consistentDirection) {
                // Flip to face movement direction (sprite naturally faces left)
                if (this.vx > 0) {
                    scaleX = -1; // Flip when moving right
                }
            } else {
                if (this.vx < 0) {
                    scaleX = -1;
                }

                if (this.facesLeft) {
                    scaleX *= -1;
                }
            }

            ctx.scale(scaleX, 1);

            // Add golden glow if bonus
            if (this.isBonus) {
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 20;
            }
            
            // Add player color glow for duel mode
            if (this.playerColor && this.assignedPlayer !== undefined) {
                ctx.shadowColor = this.playerColor;
                ctx.shadowBlur = 15;
            }

            // Draw the sprite frame
            // For sprites with multiple birds (like pigeon), use only half the width
            let sourceWidth = Math.floor(frameWidth);
            if (this.useSpriteHalf === 'left') {
                sourceWidth = Math.floor(frameWidth / 2);
            }

            ctx.drawImage(
                this.sprite,
                Math.floor(col * frameWidth),
                Math.floor(row * frameHeight),
                sourceWidth,
                Math.floor(frameHeight), // Source rectangle
                -this.size / 2,
                -this.size / 2,
                this.size,
                this.size // Destination rectangle
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
