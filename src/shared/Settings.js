export class Settings {
    constructor() {
        this.sindenEnabled = false;
        this.sindenColor = "#ffffff";
        this.sindenThickness = 10; // pixels
        this.inputMethod = "mouse"; // 'mouse', 'sinden', 'gun4ir'
        this.isFullscreen = false;
        this.showGunCursors = true; // Show virtual cursors for WebHID guns
        
        // Reference to gunManager (set by ArcadeSystem)
        this.gunManager = null;

        this.borderElement = document.getElementById("sinden-border");

        this.load();
        this.apply();
    }

    load() {
        const saved = localStorage.getItem("pbs_settings");
        if (saved) {
            const data = JSON.parse(saved);
            this.sindenEnabled = data.sindenEnabled || false;
            this.sindenColor = data.sindenColor || '#ffffff';
            this.sindenThickness = data.sindenThickness || 10;
            this.inputMethod = data.inputMethod || 'mouse';
            this.isFullscreen = data.isFullscreen || false;
            this.showGunCursors = data.showGunCursors !== false; // Default true
        }
    }

    save() {
        const data = {
            sindenEnabled: this.sindenEnabled,
            sindenColor: this.sindenColor,
            sindenThickness: this.sindenThickness,
            inputMethod: this.inputMethod,
            isFullscreen: this.isFullscreen,
            showGunCursors: this.showGunCursors,
        };
        localStorage.setItem("pbs_settings", JSON.stringify(data));
    }

    apply() {
        const root = document.documentElement;

        if (this.sindenEnabled) {
            root.style.setProperty("--sinden-border-width", `${this.sindenThickness}px`);
            root.style.setProperty("--sinden-border-color", this.sindenColor);
        } else {
            root.style.setProperty("--sinden-border-width", "0px");
        }

        // Control cursor visibility
        const canvas = document.getElementById("game-canvas");
        if (canvas) {
            if (this.inputMethod === 'mouse') {
                canvas.style.cursor = 'crosshair';
            } else {
                canvas.style.cursor = 'none';
            }
        }
    }

    setSindenEnabled(enabled) {
        this.sindenEnabled = enabled;
        this.apply();
        this.save();
    }

    setSindenColor(color) {
        this.sindenColor = color;
        this.apply();
        this.save();
    }

    setSindenThickness(thickness) {
        this.sindenThickness = thickness;
        this.apply();
        this.save();
    }

    setInputMethod(method) {
        this.inputMethod = method;

        // Auto-enable border for Sinden, disable for others
        if (method === 'sinden') {
            this.setSindenEnabled(true);
        } else {
            this.setSindenEnabled(false);
        }

        this.apply();
        this.save();
    }

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;

        if (this.isFullscreen) {
            // Request fullscreen
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }

        this.save();
    }

    setShowGunCursors(enabled) {
        this.showGunCursors = enabled;
        if (this.gunManager) {
            // This setting only affects in-game cursor visibility
            // Cursors always show in menus
            this.gunManager.setShowCursorsInGame(enabled);
        }
        this.save();
    }
}
