/**
 * InputManager class
 * Handles input from multiple sources: mouse, touch, and WebHID lightguns
 */
export class InputManager {
    constructor(canvas, gunManager = null) {
        this.canvas = canvas;
        this.gunManager = gunManager;
        this.listeners = {};

        // Bind methods
        this.handleClick = this.handleClick.bind(this);
        this.handleGunShoot = this.handleGunShoot.bind(this);

        // Attach mouse/touch listeners
        this.canvas.addEventListener("mousedown", this.handleClick);
        this.canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleClick(mouseEvent);
        }, { passive: false });

        // Integrate with GunManager if provided
        if (this.gunManager) {
            this.gunManager.onShoot = this.handleGunShoot;
        }
    }

    /**
     * Handle mouse/touch click
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Scale coordinates if canvas display size differs from internal resolution
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const gameX = x * scaleX;
        const gameY = y * scaleY;

        this.emit("shoot", { x: gameX, y: gameY, gunIndex: -1, source: 'mouse' });
    }

    /**
     * Handle shoot from WebHID gun
     */
    handleGunShoot(gunIndex, x, y) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Convert screen coordinates to canvas coordinates
        const canvasX = x - rect.left;
        const canvasY = y - rect.top;

        // Scale coordinates if canvas display size differs from internal resolution
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const gameX = canvasX * scaleX;
        const gameY = canvasY * scaleY;

        this.emit("shoot", { x: gameX, y: gameY, gunIndex, source: 'gun' });
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((cb) => cb(data));
        }
    }

    /**
     * Clean up
     */
    destroy() {
        this.canvas.removeEventListener("mousedown", this.handleClick);
        if (this.gunManager) {
            this.gunManager.onShoot = null;
        }
    }
}
