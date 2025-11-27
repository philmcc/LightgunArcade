/**
 * GunSetupMenu class
 * UI for configuring lightguns
 */
export class GunSetupMenu {
    constructor(arcadeManager) {
        this.arcade = arcadeManager;
        this.gunManager = arcadeManager.gunManager;
        this.container = null;
        this.mappingCancel = null;
    }

    /**
     * Render the menu into the UI layer
     */
    show() {
        this.render();
        this.attachListeners();
    }

    /**
     * Generate HTML for the menu
     */
    render() {
        const gunsHtml = this.gunManager.guns.map(gun => {
            const isConnected = gun.config.pointerId !== null;
            const statusClass = isConnected ? 'connected' : 'disconnected';
            const statusText = isConnected ? 'CONNECTED' : 'NOT ASSIGNED';

            return `
        <div class="gun-slot ${statusClass}" data-index="${gun.index}">
          <div class="gun-header" style="border-color: ${gun.color}">
            <span class="gun-name">${gun.name}</span>
            <span class="gun-status">${statusText}</span>
          </div>
          <div class="gun-details">
            <div class="detail-row">
              <label>Type:</label>
              <span>${gun.config.deviceType}</span>
            </div>
            <div class="detail-row">
              <label>ID:</label>
              <span>${gun.config.pointerId !== null ? gun.config.pointerId : '-'}</span>
            </div>
            <div class="detail-row">
              <label>Trigger:</label>
              <span>Btn ${gun.config.buttons.trigger}</span>
            </div>
            <div class="detail-row">
              <label>Reload:</label>
              <span>Btn ${gun.config.buttons.reload}</span>
            </div>
          </div>
          <div class="gun-actions">
            ${isConnected ?
                    `<button class="btn-calibrate" data-index="${gun.index}">CALIBRATE</button>
                     <button class="btn-map" data-index="${gun.index}">MAP BUTTONS</button>` :
                    `<button class="btn-assign" data-index="${gun.index}" disabled>WAITING...</button>`
                }
          </div>
        </div>
      `;
        }).join('');

        this.arcade.uiLayer.innerHTML = `
      <div class="screen gun-setup-screen">
        <h1>GUN CONFIGURATION</h1>
        
        <div class="setup-instructions">
          <p>Click "DETECT GUNS" and then pull the trigger on each gun to assign it.</p>
        </div>

        <div class="gun-grid">
          ${gunsHtml}
        </div>

        <div class="setup-controls">
          <button id="btn-detect-guns" class="${this.gunManager.isDetecting ? 'active' : ''}">
            ${this.gunManager.isDetecting ? 'STOP DETECTION' : 'DETECT GUNS'}
          </button>
          <button id="btn-reset-guns" class="danger">RESET ALL</button>
          <button id="btn-back-arcade">BACK</button>
        </div>
        
        ${this.gunManager.isDetecting ? `
          <div class="detection-overlay">
            <div class="detection-message">
              <h2>LISTENING FOR INPUT...</h2>
              <p>Pull the trigger on a gun to assign it to the next available slot.</p>
              <button id="btn-stop-detection">CANCEL</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
    }

    /**
     * Attach event listeners
     */
    attachListeners() {
        // Back button
        document.getElementById('btn-back-arcade').onclick = () => {
            this.gunManager.stopDetection();
            this.arcade.showArcadeMenu();
        };

        // Detect toggle
        const detectBtn = document.getElementById('btn-detect-guns');
        if (detectBtn) {
            detectBtn.onclick = () => this.toggleDetection();
        }

        // Stop detection overlay button
        const stopDetectBtn = document.getElementById('btn-stop-detection');
        if (stopDetectBtn) {
            stopDetectBtn.onclick = () => this.toggleDetection();
        }

        // Reset button
        document.getElementById('btn-reset-guns').onclick = async () => {
            if (confirm('Are you sure you want to reset all gun assignments?')) {
                await this.gunManager.resetAssignments();
                this.render();
                this.attachListeners();
            }
        };

        // Calibration buttons
        document.querySelectorAll('.btn-calibrate').forEach(btn => {
            btn.onclick = (e) => {
                const index = e.target.dataset.index;
                alert(`Calibration for Player ${parseInt(index) + 1} coming soon!`);
            };
        });

        // Map buttons
        document.querySelectorAll('.btn-map').forEach(btn => {
            btn.onclick = (e) => {
                const index = parseInt(e.target.dataset.index);
                this.startMapping(index);
            };
        });
    }

    /**
     * Toggle detection mode
     */
    toggleDetection() {
        if (this.gunManager.isDetecting) {
            this.gunManager.stopDetection();
        } else {
            this.gunManager.startDetection((assignedGun) => {
                this.render();
                this.attachListeners();
            });
        }
        this.render();
        this.attachListeners();
    }

    /**
     * Start button mapping flow for a gun
     * @param {number} gunIndex 
     */
    async startMapping(gunIndex) {
        const gun = this.gunManager.guns[gunIndex];

        try {
            // Step 1: Trigger
            await this.mapSingleButton(gunIndex, 'TRIGGER', (btn) => {
                gun.config.buttons.trigger = btn;
            });

            // Step 2: Reload
            await this.mapSingleButton(gunIndex, 'RELOAD (or Side Button)', (btn) => {
                gun.config.buttons.reload = btn;
            });

            // Step 3: Start
            await this.mapSingleButton(gunIndex, 'START / PAUSE', (btn) => {
                gun.config.buttons.start = btn;
            });

            // Save and refresh
            await this.gunManager.saveProfiles();
            this.render();
            this.attachListeners();
            alert(`Buttons mapped for ${gun.name}!`);

        } catch (e) {
            console.log('Mapping cancelled');
            this.render();
            this.attachListeners();
        }
    }

    /**
     * Map a single button with UI feedback
     */
    mapSingleButton(gunIndex, buttonName, onMapped) {
        return new Promise((resolve, reject) => {
            const overlay = document.createElement('div');
            overlay.className = 'detection-overlay';
            overlay.innerHTML = `
                <div class="detection-message">
                    <h2>MAPPING ${this.gunManager.guns[gunIndex].name}</h2>
                    <p>Press the <strong>${buttonName}</strong> button.</p>
                    <button id="btn-cancel-map">CANCEL</button>
                </div>
            `;
            document.querySelector('.gun-setup-screen').appendChild(overlay);

            const cleanup = () => {
                if (this.mappingCancel) {
                    this.mappingCancel();
                    this.mappingCancel = null;
                }
                overlay.remove();
            };

            // Cancel button
            document.getElementById('btn-cancel-map').onclick = () => {
                cleanup();
                reject('Cancelled');
            };

            // Listen for input
            this.mappingCancel = this.gunManager.listenForButton(gunIndex, (btnIndex) => {
                onMapped(btnIndex);
                cleanup();
                resolve(btnIndex);
            });
        });
    }
}
