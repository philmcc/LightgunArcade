/**
 * Abstract base class for all Lightgun Arcade games.
 * All games must extend this class and implement the required methods.
 */
export class BaseGame {
    /**
     * @param {HTMLCanvasElement} canvas - The game canvas
     * @param {HTMLElement} uiLayer - The UI overlay layer
     * @param {ArcadeSystem} system - Reference to the main ArcadeSystem
     */
    constructor(canvas, uiLayer, system) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;
        this.system = system;
        this.ctx = canvas.getContext('2d');

        if (this.constructor === BaseGame) {
            throw new Error("BaseGame is an abstract class and cannot be instantiated directly.");
        }
    }

    /**
     * Called when the game is first initialized.
     * Use this to setup event listeners, load level data, etc.
     */
    async init() {
        throw new Error("Method 'init()' must be implemented.");
    }

    /**
     * Called every frame to update game logic.
     * @param {number} dt - Delta time in seconds since last frame
     */
    update(dt) {
        throw new Error("Method 'update(dt)' must be implemented.");
    }

    /**
     * Called every frame to draw the game.
     * @param {CanvasRenderingContext2D} ctx - The canvas 2D context
     */
    draw(ctx) {
        throw new Error("Method 'draw(ctx)' must be implemented.");
    }

    /**
     * Called when the game is paused.
     */
    onPause() {
        // Optional override
    }

    /**
     * Called when the game is resumed.
     */
    onResume() {
        // Optional override
    }

    /**
     * Called when the game is being destroyed/exited.
     * Clean up event listeners and resources here.
     */
    destroy() {
        // Optional override
    }

    /**
     * Returns the game manifest/metadata.
     * This static method should be implemented by the subclass.
     * @returns {Object} Game manifest
     */
    static getManifest() {
        throw new Error("Static method 'getManifest()' must be implemented.");
    }
}
