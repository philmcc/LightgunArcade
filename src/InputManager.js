export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.listeners = [];

        // Bind methods
        this.handleClick = this.handleClick.bind(this);

        // Attach listeners
        this.canvas.addEventListener("mousedown", this.handleClick);
        // Support touch for mobile/tablets just in case
        this.canvas.addEventListener("touchstart", (e) => {
            // Prevent default to stop scrolling/zooming
            e.preventDefault();
            // Use the first touch point
            const touch = e.changedTouches[0];
            // Create a fake mouse event
            const mouseEvent = new MouseEvent("mousedown", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleClick(mouseEvent);
        }, { passive: false });
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Scale coordinates if canvas display size differs from internal resolution
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const gameX = x * scaleX;
        const gameY = y * scaleY;

        this.emit("shoot", { x: gameX, y: gameY });
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((cb) => cb(data));
        }
    }
}
