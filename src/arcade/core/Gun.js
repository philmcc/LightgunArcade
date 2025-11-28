/**
 * Gun class
 * Represents a single lightgun device configuration and state
 */
export class Gun {
    constructor(id, index) {
        this.id = id; // Unique ID (e.g., from pointerId or generated)
        this.index = index; // Player index (0-3)
        this.name = `Player ${index + 1}`;
        this.color = this.getDefaultColor(index);

        // Configuration
        this.config = {
            pointerId: null,      // The browser pointerId assigned to this gun (legacy/fallback)
            hidDeviceId: null,    // WebHID device ID for distinguishing multiple guns
            deviceType: 'mouse',  // 'mouse', 'sinden', 'gun4ir', etc.
            deviceName: '',       // Human-readable device name
            showCursor: true,     // Whether to show cursor for this gun
            buttons: {
                trigger: 0,         // Button index for trigger
                reload: 2,          // Button index for reload (or 'offscreen')
                start: 1,           // Button index for start/pause
            },
            calibration: {
                enabled: false,
                points: []          // Calibration points
            },
            reloadMode: 'button', // 'button', 'offscreen', 'gesture'
        };

        // Runtime state
        this.state = {
            x: 0,
            y: 0,
            isTriggerDown: false,
            isReloading: false,
            isConnected: false,
            lastActive: Date.now()
        };
    }

    /**
     * Get default color for player index
     * @param {number} index 
     * @returns {string} Hex color
     */
    getDefaultColor(index) {
        const colors = [
            '#FF0000', // P1: Red
            '#0000FF', // P2: Blue
            '#00FF00', // P3: Green
            '#FFFF00'  // P4: Yellow
        ];
        return colors[index] || '#FFFFFF';
    }

    /**
     * Update gun state from pointer event
     * @param {PointerEvent} event 
     */
    updateFromEvent(event) {
        this.state.x = event.clientX;
        this.state.y = event.clientY;
        this.state.lastActive = Date.now();

        // Apply calibration if enabled
        if (this.config.calibration.enabled) {
            this.applyCalibration();
        }
    }

    /**
     * Apply calibration transform to current coordinates
     */
    applyCalibration() {
        // TODO: Implement 4-point calibration transform
        // For now, pass through raw coordinates
    }

    /**
     * Serialize for storage
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            index: this.index,
            name: this.name,
            color: this.color,
            config: this.config
        };
    }

    /**
     * Load from storage data
     * @param {object} data 
     */
    fromJSON(data) {
        this.id = data.id;
        this.index = data.index;
        this.name = data.name;
        this.color = data.color;
        this.config = { ...this.config, ...data.config };
    }
}
