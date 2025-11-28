/**
 * FloatingScoreManager - Manages animated floating score popups
 * 
 * Creates and animates score text that floats upward and fades out.
 * Can be used by any game for visual feedback on hits.
 * 
 * Usage:
 *   const floatingScores = new FloatingScoreManager();
 *   
 *   // On hit:
 *   floatingScores.spawn(x, y, {
 *       points: 150,
 *       bonusText: 'PERFECT!',
 *       color: '#ffd700',
 *       combo: 5,
 *       multiplier: 2.0
 *   });
 *   
 *   // Each frame:
 *   floatingScores.update(dt);
 *   floatingScores.draw(ctx);
 */
export class FloatingScoreManager {
    constructor() {
        this.scores = [];
        
        // Default configuration
        this.config = {
            floatSpeed: 60,      // Pixels per second upward
            duration: 1.2,       // Seconds before fully faded
            baseSize: 24,        // Base font size
            maxSize: 36,         // Max font size for big scores
            fontFamily: 'Arial',
            shadowOffset: 2
        };
    }
    
    /**
     * Configure the manager
     * @param {Object} config - Configuration options
     */
    configure(config) {
        Object.assign(this.config, config);
    }
    
    /**
     * Spawn a floating score
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Score options
     * @param {number} options.points - Point value to display
     * @param {string} options.bonusText - Optional bonus text (e.g., "PERFECT!")
     * @param {string} options.color - Text color (default: white)
     * @param {number} options.combo - Current combo count (for display)
     * @param {number} options.multiplier - Current multiplier (for color)
     * @param {number} options.playerIndex - Player index (for multiplayer coloring)
     * @param {string} options.playerColor - Player color override
     * @param {boolean} options.isNegative - If true, display as penalty
     */
    spawn(x, y, options = {}) {
        const {
            points = 0,
            bonusText = '',
            color = null,
            combo = 0,
            multiplier = 1,
            playerIndex = null,
            playerColor = null,
            isNegative = false
        } = options;
        
        // Determine color based on context
        let textColor = color;
        if (!textColor) {
            if (isNegative) {
                textColor = '#ff0000';
            } else if (playerColor) {
                textColor = playerColor;
            } else {
                textColor = this._getColorForMultiplier(multiplier);
            }
        }
        
        // Determine size based on points/multiplier
        let size = this.config.baseSize;
        if (isNegative) {
            size = 28;
        } else if (multiplier >= 3) {
            size = this.config.maxSize;
        } else if (multiplier >= 2) {
            size = 30;
        } else if (Math.abs(points) >= 200) {
            size = 28;
        }
        
        // Build display text
        let text = isNegative ? `${points}` : `+${points}`;
        if (playerIndex !== null && playerIndex >= 0) {
            text = `P${playerIndex + 1} ${text}`;
        }
        
        // Build bonus text line
        let bonusLine = '';
        if (bonusText) {
            bonusLine = bonusText;
        }
        if (combo >= 3 && !isNegative) {
            const comboText = `COMBO x${combo}`;
            bonusLine = bonusLine ? `${bonusLine} | ${comboText}` : comboText;
        }
        
        this.scores.push({
            x,
            y: y - 30, // Start slightly above hit point
            text,
            bonusText: bonusLine,
            color: textColor,
            size,
            lifetime: 0,
            maxLifetime: this.config.duration,
            alpha: 1
        });
    }
    
    /**
     * Spawn a simple text popup (not a score)
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Text to display
     * @param {string} color - Text color
     * @param {number} size - Font size
     */
    spawnText(x, y, text, color = '#ffffff', size = 24) {
        this.scores.push({
            x,
            y,
            text,
            bonusText: '',
            color,
            size,
            lifetime: 0,
            maxLifetime: this.config.duration,
            alpha: 1
        });
    }
    
    /**
     * Update all floating scores
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        for (let i = this.scores.length - 1; i >= 0; i--) {
            const fs = this.scores[i];
            fs.lifetime += dt;
            fs.y -= this.config.floatSpeed * dt;
            fs.alpha = 1 - (fs.lifetime / fs.maxLifetime);
            
            if (fs.lifetime >= fs.maxLifetime) {
                this.scores.splice(i, 1);
            }
        }
    }
    
    /**
     * Draw all floating scores
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        this.scores.forEach(fs => {
            ctx.save();
            ctx.globalAlpha = fs.alpha;
            ctx.font = `bold ${fs.size}px ${this.config.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw shadow
            ctx.fillStyle = '#000';
            ctx.fillText(fs.text, fs.x + this.config.shadowOffset, fs.y + this.config.shadowOffset);
            
            // Draw main text
            ctx.fillStyle = fs.color;
            ctx.fillText(fs.text, fs.x, fs.y);
            
            // Draw bonus text if any
            if (fs.bonusText) {
                ctx.font = `bold 16px ${this.config.fontFamily}`;
                ctx.fillStyle = '#ffd700';
                ctx.fillText(fs.bonusText, fs.x, fs.y - 25);
            }
            
            ctx.restore();
        });
    }
    
    /**
     * Clear all floating scores
     */
    clear() {
        this.scores = [];
    }
    
    /**
     * Get color based on multiplier
     * @private
     */
    _getColorForMultiplier(multiplier) {
        if (multiplier >= 4.0) return '#ff00ff'; // Purple
        if (multiplier >= 3.0) return '#ff0000'; // Red
        if (multiplier >= 2.5) return '#ff6600'; // Orange
        if (multiplier >= 2.0) return '#ffa500'; // Light orange
        if (multiplier >= 1.5) return '#ffff00'; // Yellow
        return '#ffffff'; // White
    }
}


/**
 * ComboDisplay - Canvas-based combo counter display
 * 
 * Draws a combo counter with timer bar.
 * Can be positioned anywhere on the canvas.
 */
export class ComboDisplay {
    /**
     * @param {Object} options - Display options
     * @param {number} options.x - X position (default: center)
     * @param {number} options.y - Y position (default: 80)
     */
    constructor(options = {}) {
        this.x = options.x ?? null; // null = center
        this.y = options.y ?? 80;
        
        this.combo = 0;
        this.multiplier = 1;
        this.timerPercent = 0;
        this.visible = false;
        
        // Animation
        this.scale = 1;
        this.targetScale = 1;
    }
    
    /**
     * Update display state
     * @param {number} combo - Current combo
     * @param {number} multiplier - Current multiplier
     * @param {number} timerPercent - Timer as 0-1
     */
    update(combo, multiplier, timerPercent) {
        // Trigger scale animation on combo increase
        if (combo > this.combo) {
            this.scale = 1.3;
            this.targetScale = 1;
        }
        
        this.combo = combo;
        this.multiplier = multiplier;
        this.timerPercent = timerPercent;
        this.visible = combo >= 2;
        
        // Animate scale back to normal
        if (this.scale > this.targetScale) {
            this.scale = Math.max(this.targetScale, this.scale - 0.02);
        }
    }
    
    /**
     * Draw the combo display
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} canvasWidth - Canvas width (for centering)
     */
    draw(ctx, canvasWidth) {
        if (!this.visible || this.combo < 2) return;
        
        const x = this.x ?? canvasWidth / 2;
        const y = this.y;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(this.scale, this.scale);
        
        // Fade based on timer
        const alpha = Math.min(1, this.timerPercent / 0.3 + 0.3);
        ctx.globalAlpha = alpha;
        
        // Get color based on multiplier
        const color = this._getColor();
        
        // Draw combo text
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow
        ctx.fillStyle = '#000';
        ctx.fillText(`COMBO x${this.combo}`, 2, 2);
        
        // Main text
        ctx.fillStyle = color;
        ctx.fillText(`COMBO x${this.combo}`, 0, 0);
        
        // Draw multiplier
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`${this.multiplier}x POINTS`, 0, 35);
        
        // Draw timer bar
        const barWidth = 120;
        const barHeight = 6;
        const barY = 55;
        
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-barWidth/2, barY, barWidth, barHeight);
        
        // Fill
        ctx.fillStyle = color;
        ctx.fillRect(-barWidth/2, barY, barWidth * this.timerPercent, barHeight);
        
        ctx.restore();
    }
    
    /**
     * Get color based on multiplier
     * @private
     */
    _getColor() {
        if (this.multiplier >= 4.0) return '#ff00ff';
        if (this.multiplier >= 3.0) return '#ff0000';
        if (this.multiplier >= 2.5) return '#ff6600';
        if (this.multiplier >= 2.0) return '#ffa500';
        if (this.multiplier >= 1.5) return '#ffff00';
        return '#ffffff';
    }
}
