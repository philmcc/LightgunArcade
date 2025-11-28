/**
 * ComboSystem - Reusable combo tracking for lightgun games
 * 
 * Tracks consecutive hits and provides multipliers.
 * Can be used by any game that wants combo-based scoring.
 * 
 * Usage:
 *   const combo = new ComboSystem();
 *   combo.onUpdate = (combo, multiplier) => updateDisplay(combo, multiplier);
 *   combo.onBreak = (finalCombo) => showComboLost(finalCombo);
 *   
 *   // On hit:
 *   combo.increment();
 *   const multiplier = combo.getMultiplier();
 *   
 *   // On miss:
 *   combo.break();
 *   
 *   // Each frame:
 *   combo.update(dt);
 */
export class ComboSystem {
    /**
     * @param {Object} options - Configuration options
     * @param {number} options.timeout - Seconds before combo resets (default: 2.0)
     * @param {Array} options.thresholds - Array of {hits, multiplier} (default: standard thresholds)
     */
    constructor(options = {}) {
        this.timeout = options.timeout ?? 2.0;
        
        // Default thresholds matching Not Duck Hunt
        this.thresholds = options.thresholds ?? [
            { hits: 2, multiplier: 1.5 },
            { hits: 4, multiplier: 2.0 },
            { hits: 6, multiplier: 2.5 },
            { hits: 8, multiplier: 3.0 },
            { hits: 10, multiplier: 3.5 },
            { hits: 15, multiplier: 4.0 }
        ];
        
        // State
        this.combo = 0;
        this.maxCombo = 0;
        this.timer = 0;
        this.lastHitTime = 0;
        
        // Callbacks
        this.onUpdate = null;  // (combo, multiplier) => {}
        this.onBreak = null;   // (finalCombo) => {}
        this.onMilestone = null; // (combo, multiplier) => {} - called when hitting a new threshold
    }
    
    /**
     * Reset combo state (for new game/round)
     * @param {boolean} keepMax - If true, preserve maxCombo
     */
    reset(keepMax = false) {
        this.combo = 0;
        this.timer = 0;
        if (!keepMax) {
            this.maxCombo = 0;
        }
    }
    
    /**
     * Increment combo on successful hit
     * @returns {number} New combo count
     */
    increment() {
        const prevMultiplier = this.getMultiplier();
        
        this.combo++;
        this.timer = this.timeout;
        this.lastHitTime = performance.now();
        
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        
        const newMultiplier = this.getMultiplier();
        
        // Check for milestone (new multiplier threshold reached)
        if (newMultiplier > prevMultiplier && this.onMilestone) {
            this.onMilestone(this.combo, newMultiplier);
        }
        
        if (this.onUpdate) {
            this.onUpdate(this.combo, newMultiplier);
        }
        
        return this.combo;
    }
    
    /**
     * Break the combo (on miss or timeout)
     */
    break() {
        if (this.combo > 0 && this.onBreak) {
            this.onBreak(this.combo);
        }
        this.combo = 0;
        this.timer = 0;
    }
    
    /**
     * Update combo timer (call each frame)
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (this.timer > 0) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.break();
            }
        }
    }
    
    /**
     * Get current combo multiplier
     * @returns {number} Multiplier value (1.0 if no combo)
     */
    getMultiplier() {
        if (this.combo < 2) return 1.0;
        
        // Find highest threshold that combo meets
        let multiplier = 1.0;
        for (const threshold of this.thresholds) {
            if (this.combo >= threshold.hits) {
                multiplier = threshold.multiplier;
            } else {
                break;
            }
        }
        return multiplier;
    }
    
    /**
     * Get current combo count
     * @returns {number}
     */
    getCombo() {
        return this.combo;
    }
    
    /**
     * Get max combo achieved
     * @returns {number}
     */
    getMaxCombo() {
        return this.maxCombo;
    }
    
    /**
     * Get remaining timer (for UI display)
     * @returns {number} Seconds remaining
     */
    getTimeRemaining() {
        return Math.max(0, this.timer);
    }
    
    /**
     * Get timer as percentage (for UI bar)
     * @returns {number} 0.0 to 1.0
     */
    getTimerPercent() {
        return this.timeout > 0 ? Math.max(0, this.timer / this.timeout) : 0;
    }
    
    /**
     * Check if combo is active
     * @returns {boolean}
     */
    isActive() {
        return this.combo >= 2;
    }
    
    /**
     * Get color for current combo level (for UI)
     * @returns {string} CSS color
     */
    getColor() {
        const multiplier = this.getMultiplier();
        if (multiplier >= 4.0) return '#ff00ff'; // Purple - max
        if (multiplier >= 3.0) return '#ff0000'; // Red
        if (multiplier >= 2.5) return '#ff6600'; // Orange
        if (multiplier >= 2.0) return '#ffa500'; // Light orange
        if (multiplier >= 1.5) return '#ffff00'; // Yellow
        return '#ffffff'; // White - no combo
    }
    
    /**
     * Calculate points with combo multiplier applied
     * @param {number} basePoints - Base point value
     * @returns {number} Points with multiplier
     */
    applyMultiplier(basePoints) {
        return Math.floor(basePoints * this.getMultiplier());
    }
}
