/**
 * SettingsScreen - Centralized settings UI component
 * Handles fullscreen, Sinden border, and gun setup
 * Can be used by both ArcadeSystem and individual games
 */
export class SettingsScreen {
    /**
     * @param {HTMLElement} uiLayer - The UI layer to render into
     * @param {Object} settings - Reference to Settings instance
     * @param {Object} options - Additional options
     * @param {Function} options.onBack - Called when back button is pressed
     * @param {Function} options.onGunSetup - Called to show gun setup
     * @param {boolean} options.showGunSetup - Whether to show gun setup button
     */
    constructor(uiLayer, settings, options = {}) {
        this.uiLayer = uiLayer;
        this.settings = settings;
        this.options = {
            onBack: null,
            onGunSetup: null,
            showGunSetup: true,
            ...options
        };

        // Element references
        this.elements = {};
    }

    /**
     * Show the settings screen
     */
    show() {
        const isFullscreen = !!document.fullscreenElement;
        const sindenEnabled = this.settings.sindenEnabled;

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h2>SETTINGS</h2>
                
                <div class="setting-row">
                    <label>Fullscreen:</label>
                    <button id="btn-fullscreen" class="toggle-btn ${isFullscreen ? 'active' : ''}">${isFullscreen ? 'ON' : 'OFF'}</button>
                </div>

                <div id="sinden-options">
                    <div class="setting-row">
                        <label>Sinden Border:</label>
                        <button id="btn-sinden" class="toggle-btn ${sindenEnabled ? 'active' : ''}">${sindenEnabled ? 'ON' : 'OFF'}</button>
                    </div>
                    <div class="setting-row ${sindenEnabled ? '' : 'hidden'}" id="sinden-thickness-row">
                        <label>Border Thickness:</label>
                        <input type="range" id="sinden-thick" min="1" max="50" value="${this.settings.sindenThickness}">
                    </div>
                    <div class="setting-row ${sindenEnabled ? '' : 'hidden'}" id="sinden-color-row">
                        <label>Border Color:</label>
                        <input type="color" id="sinden-color" value="${this.settings.sindenColor}">
                    </div>
                </div>
                
                ${this.options.showGunSetup ? '<button id="btn-gun-setup" class="btn-primary" style="margin-top: 1rem;">GUN SETUP</button>' : ''}
                <button id="btn-back">BACK</button>
            </div>
        `;

        this._bindEvents();
    }

    /**
     * Bind event handlers to UI elements
     */
    _bindEvents() {
        this.elements.fullscreenBtn = document.getElementById('btn-fullscreen');
        this.elements.sindenBtn = document.getElementById('btn-sinden');
        this.elements.sindenThick = document.getElementById('sinden-thick');
        this.elements.sindenColor = document.getElementById('sinden-color');
        this.elements.sindenThicknessRow = document.getElementById('sinden-thickness-row');
        this.elements.sindenColorRow = document.getElementById('sinden-color-row');
        this.elements.gunSetupBtn = document.getElementById('btn-gun-setup');
        this.elements.backBtn = document.getElementById('btn-back');

        // Fullscreen toggle - use pointerdown for trusted user gesture
        // This works with both mouse and lightgun hardware events
        if (this.elements.fullscreenBtn) {
            this.elements.fullscreenBtn.onpointerdown = (e) => {
                e.preventDefault();
                this._toggleFullscreen();
            };
        }

        // Sinden border toggle
        if (this.elements.sindenBtn) {
            this.elements.sindenBtn.onclick = () => {
                this._toggleSinden();
            };
        }

        // Sinden thickness slider
        if (this.elements.sindenThick) {
            this.elements.sindenThick.oninput = (e) => {
                this.settings.setSindenThickness(parseInt(e.target.value));
            };
        }

        // Sinden color picker
        if (this.elements.sindenColor) {
            this.elements.sindenColor.oninput = (e) => {
                this.settings.setSindenColor(e.target.value);
            };
        }

        // Gun setup button
        if (this.elements.gunSetupBtn && this.options.onGunSetup) {
            this.elements.gunSetupBtn.onclick = () => {
                this.options.onGunSetup();
            };
        }

        // Back button
        if (this.elements.backBtn && this.options.onBack) {
            this.elements.backBtn.onclick = () => {
                this.options.onBack();
            };
        }
    }

    /**
     * Toggle fullscreen mode
     */
    _toggleFullscreen() {
        const btn = this.elements.fullscreenBtn;
        
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                btn.classList.add('active');
                btn.textContent = 'ON';
            }).catch(err => {
                console.warn('Fullscreen failed:', err);
                // Flash the button to indicate it didn't work
                btn.style.background = '#ff4444';
                setTimeout(() => {
                    btn.style.background = '';
                }, 200);
            });
        } else {
            document.exitFullscreen().then(() => {
                btn.classList.remove('active');
                btn.textContent = 'OFF';
            }).catch(err => {
                console.warn('Exit fullscreen failed:', err);
            });
        }
    }

    /**
     * Toggle Sinden border
     */
    _toggleSinden() {
        const btn = this.elements.sindenBtn;
        const newState = !this.settings.sindenEnabled;
        
        this.settings.setSindenEnabled(newState);
        btn.classList.toggle('active', newState);
        btn.textContent = newState ? 'ON' : 'OFF';
        
        if (newState) {
            this.elements.sindenThicknessRow.classList.remove('hidden');
            this.elements.sindenColorRow.classList.remove('hidden');
        } else {
            this.elements.sindenThicknessRow.classList.add('hidden');
            this.elements.sindenColorRow.classList.add('hidden');
        }
    }

    /**
     * Update fullscreen button state (call when fullscreen changes externally)
     */
    updateFullscreenState() {
        if (this.elements.fullscreenBtn) {
            const isFullscreen = !!document.fullscreenElement;
            this.elements.fullscreenBtn.classList.toggle('active', isFullscreen);
            this.elements.fullscreenBtn.textContent = isFullscreen ? 'ON' : 'OFF';
        }
    }
}
