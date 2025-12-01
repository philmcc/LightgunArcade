/**
 * GunSetupMenu class
 * UI for configuring lightguns
 * 
 * Supports two detection modes:
 * 1. WebHID mode: For Gun4IR/Sinden - can distinguish multiple devices
 * 2. Pointer mode: Fallback for single mouse/touchscreen
 */
export class GunSetupMenu {
    constructor(arcadeManager) {
        this.arcade = arcadeManager;
        this.gunManager = arcadeManager.gunManager;
        this.container = null;
        this.mappingCancel = null;
        this.availableHIDDevices = [];
    }
    
    /**
     * Show an in-app toast notification (replaces browser alert)
     * @param {string} message - Message to display
     * @param {number} duration - Duration in ms (default 3000)
     */
    showToast(message, duration = 3000) {
        // Remove any existing toast
        const existing = document.querySelector('.gun-setup-toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'gun-setup-toast';
        toast.innerHTML = `<div class="toast-content">${message.replace(/\n/g, '<br>')}</div>`;
        toast.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            border: 3px solid #00ccff;
            border-radius: 10px;
            padding: 20px 40px;
            color: white;
            font-size: 18px;
            text-align: center;
            z-index: 10000;
            animation: toastFadeIn 0.2s ease-out;
        `;
        
        // Add animation keyframes if not already present
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes toastFadeIn {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                @keyframes toastFadeOut {
                    from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Auto-remove after duration
        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.2s ease-in forwards';
            setTimeout(() => toast.remove(), 200);
        }, duration);
        
        // Also allow clicking to dismiss
        toast.onclick = () => {
            toast.style.animation = 'toastFadeOut 0.2s ease-in forwards';
            setTimeout(() => toast.remove(), 200);
        };
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
        const webHIDSupported = this.gunManager.shouldUseWebHID();
        
        const gunsHtml = this.gunManager.guns.map(gun => {
            const isConnected = gun.config.pointerId !== null || gun.config.hidDeviceId !== null;
            const isCalibrated = this.gunManager.isGunCalibrated(gun.index);
            const statusClass = isConnected ? 'connected' : 'disconnected';
            let statusText = isConnected ? 'CONNECTED' : 'NOT ASSIGNED';
            if (isConnected && gun.config.hidDeviceId) {
                statusText = isCalibrated ? 'CALIBRATED' : 'NEEDS CALIBRATION';
            }
            
            // Determine device display info
            let deviceId = '-';
            let deviceType = gun.config.deviceType;
            if (gun.config.hidDeviceId) {
                deviceId = gun.config.deviceName || gun.config.hidDeviceId.substring(0, 12) + '...';
                deviceType = gun.config.deviceType || 'gun4ir';
            } else if (gun.config.pointerId !== null) {
                deviceId = `Pointer ${gun.config.pointerId}`;
                deviceType = 'mouse';
            }

            const showCursor = gun.config.showCursor !== false;
            
            // Get player assignment from LocalPlayersManager
            const assignedSlot = this.arcade.localPlayers?.getSlotForGun(gun.index);
            const assignedUser = assignedSlot !== null ? this.arcade.localPlayers.getUser(assignedSlot) : null;
            const playerColors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
            
            return `
        <div class="gun-slot ${statusClass}" data-index="${gun.index}">
          <div class="gun-header" style="border-color: ${gun.color}">
            <span class="gun-name">${gun.name}</span>
            <span class="gun-status">${statusText}</span>
          </div>
          
          <div class="gun-player-assignment">
            <label>Assigned to:</label>
            <select class="player-assign-select" data-gun="${gun.index}">
              <option value="-1">-- None --</option>
              ${[0, 1, 2, 3].map(i => {
                  const slot = this.arcade.localPlayers?.getSlot(i);
                  const user = slot?.user;
                  const selected = assignedSlot === i ? 'selected' : '';
                  const label = user ? `P${i + 1}: ${user.display_name || user.username}` : `P${i + 1}: (empty)`;
                  return `<option value="${i}" ${selected} style="color: ${playerColors[i]}">${label}</option>`;
              }).join('')}
            </select>
            ${assignedUser ? `
              <div class="assigned-user-chip" style="border-color: ${playerColors[assignedSlot]}">
                P${assignedSlot + 1}: ${assignedUser.display_name || assignedUser.username}
              </div>
            ` : ''}
          </div>
          
          <div class="gun-details">
            <div class="detail-row">
              <label>Type:</label>
              <span>${deviceType}</span>
            </div>
            <div class="detail-row">
              <label>Device:</label>
              <span title="${gun.config.hidDeviceId || gun.config.pointerId || ''}">${deviceId}</span>
            </div>
            <div class="detail-row">
              <label>Trigger:</label>
              <span>Btn ${gun.config.buttons.trigger}</span>
            </div>
            <div class="detail-row">
              <label>Reload:</label>
              <span>Btn ${gun.config.buttons.reload}</span>
            </div>
            <div class="detail-row">
              <label>Show Cursor:</label>
              <input type="checkbox" class="cursor-toggle" data-index="${gun.index}" ${showCursor ? 'checked' : ''}>
            </div>
          </div>
          <div class="gun-actions">
            ${isConnected ?
                    `<button class="btn-calibrate" data-index="${gun.index}">CALIBRATE</button>
                     <button class="btn-map" data-index="${gun.index}">MAP BUTTONS</button>
                     <button class="btn-unassign" data-index="${gun.index}">UNASSIGN</button>` :
                    `<button class="btn-assign-manual" data-index="${gun.index}">ASSIGN DEVICE</button>`
                }
          </div>
        </div>
      `;
        }).join('');

        // Build available devices list for WebHID
        const availableDevicesHtml = this.availableHIDDevices.length > 0 ? `
            <div class="available-devices">
                <h3>Available Devices</h3>
                <ul>
                    ${this.availableHIDDevices.map(device => `
                        <li class="device-item" data-device-id="${device.id}">
                            <span class="device-name">${device.productName || device.type}</span>
                            <span class="device-type">${device.type}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        this.arcade.uiLayer.innerHTML = `
      <div class="screen gun-setup-screen">
        <h1>GUN CONFIGURATION</h1>
        
        <div class="setup-instructions">
          ${webHIDSupported ? `
            <p><strong>WebHID Supported!</strong> Click "ADD LIGHTGUNS" to select your Gun4IR devices.</p>
            <p>Each gun will be detected as a separate device.</p>
          ` : `
            <p class="warning">⚠️ For lightgun support, please use Chrome or Edge browser.</p>
            <p>Mouse input works automatically without configuration.</p>
          `}
        </div>

        ${availableDevicesHtml}

        <div class="gun-grid">
          ${gunsHtml}
        </div>

        <div class="setup-controls">
          ${webHIDSupported ? `
            <button id="btn-add-hid-devices" class="primary">ADD LIGHTGUNS</button>
          ` : ''}
          <button id="btn-reset-guns" class="danger">RESET ALL</button>
          <button id="btn-back-arcade">BACK</button>
        </div>
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
            this.arcade.returnFromGunSetup();
        };

        // WebHID: Add lightguns button
        const addHIDBtn = document.getElementById('btn-add-hid-devices');
        if (addHIDBtn) {
            addHIDBtn.onclick = () => this.addHIDDevices();
        }

        // Reset button
        document.getElementById('btn-reset-guns').onclick = async () => {
            if (confirm('Are you sure you want to reset all gun assignments?')) {
                await this.gunManager.resetAssignments();
                this.availableHIDDevices = [];
                this.render();
                this.attachListeners();
            }
        };

        // Calibration buttons
        document.querySelectorAll('.btn-calibrate').forEach(btn => {
            btn.onclick = (e) => {
                const index = parseInt(e.target.dataset.index);
                this.startCalibration(index);
            };
        });

        // Map buttons
        document.querySelectorAll('.btn-map').forEach(btn => {
            btn.onclick = (e) => {
                const index = parseInt(e.target.dataset.index);
                this.startMapping(index);
            };
        });

        // Unassign buttons
        document.querySelectorAll('.btn-unassign').forEach(btn => {
            btn.onclick = async (e) => {
                const index = parseInt(e.target.dataset.index);
                await this.unassignGun(index);
            };
        });

        // Manual assign buttons (for selecting from available devices)
        document.querySelectorAll('.btn-assign-manual').forEach(btn => {
            btn.onclick = (e) => {
                const index = parseInt(e.target.dataset.index);
                this.showDeviceSelector(index);
            };
        });

        // Cursor visibility toggles
        document.querySelectorAll('.cursor-toggle').forEach(checkbox => {
            checkbox.onchange = async (e) => {
                const index = parseInt(e.target.dataset.index);
                const gun = this.gunManager.guns[index];
                if (gun) {
                    gun.config.showCursor = e.target.checked;
                    await this.gunManager.saveProfiles();
                    // Update cursor visibility immediately
                    if (this.gunManager.cursorManager) {
                        this.gunManager.cursorManager.updateAllCursorVisibility();
                    }
                }
            };
        });
        
        // Player assignment dropdowns
        document.querySelectorAll('.player-assign-select').forEach(select => {
            select.onchange = (e) => {
                const gunIndex = parseInt(e.target.dataset.gun);
                const slotIndex = parseInt(e.target.value);
                
                if (slotIndex === -1) {
                    // Unassign gun from all slots
                    this.arcade.localPlayers?.unassignGun(gunIndex);
                } else {
                    // Assign gun to selected slot
                    this.arcade.localPlayers?.assignGun(slotIndex, gunIndex);
                }
                
                // Re-render to update UI
                this.render();
                this.attachListeners();
            };
        });
    }

    /**
     * Add HID devices via browser picker
     * Must be called from user gesture
     */
    async addHIDDevices() {
        try {
            const devices = await this.gunManager.requestHIDDevices();
            
            if (devices.length === 0) {
                console.log('No devices selected');
                return;
            }

            console.log('Selected devices:', devices);
            
            // Update available devices list
            this.availableHIDDevices = this.gunManager.getAvailableHIDDevices();
            
            // Auto-assign devices to available slots
            for (const device of devices) {
                const nextSlot = this.gunManager.getNextAvailableSlot();
                if (nextSlot) {
                    await this.gunManager.assignHIDDevice(device, nextSlot.index);
                }
            }

            // Refresh the UI
            this.render();
            this.attachListeners();
            
        } catch (error) {
            console.error('Error adding HID devices:', error);
            this.showToast('Failed to add devices.\nMake sure you are using Chrome or Edge browser.');
        }
    }

    /**
     * Unassign a gun from its player slot
     */
    async unassignGun(gunIndex) {
        const gun = this.gunManager.guns[gunIndex];
        if (!gun) return;

        gun.config.pointerId = null;
        gun.config.hidDeviceId = null;
        gun.config.deviceType = 'mouse';
        gun.config.deviceName = '';
        gun.state.isConnected = false;

        this.gunManager.activeGunCount = this.gunManager.guns.filter(g => 
            g.config.hidDeviceId !== null || g.config.pointerId !== null
        ).length;

        await this.gunManager.saveProfiles();
        
        // Update available devices
        this.availableHIDDevices = this.gunManager.getAvailableHIDDevices();
        
        this.render();
        this.attachListeners();
    }

    /**
     * Start calibration for a gun
     */
    startCalibration(gunIndex) {
        const gun = this.gunManager.guns[gunIndex];
        if (!gun || !gun.config.hidDeviceId) {
            this.showToast('Please assign a lightgun device first before calibrating.');
            return;
        }

        this.gunManager.startCalibration(
            gunIndex,
            (result) => {
                // Calibration complete
                this.showToast(`Calibration complete for ${gun.name}!\n\nThe cursor should now track accurately.`);
                this.render();
                this.attachListeners();
            },
            () => {
                // Calibration cancelled
                this.render();
                this.attachListeners();
            }
        );
    }

    /**
     * Show device selector for manual assignment
     */
    showDeviceSelector(gunIndex) {
        const availableDevices = this.gunManager.getAvailableHIDDevices();
        
        if (availableDevices.length === 0) {
            // No HID devices available, prompt to add or use pointer detection
            const webHIDSupported = this.gunManager.shouldUseWebHID();
            if (webHIDSupported) {
                this.showToast('No unassigned lightguns available.\n\nClick "ADD LIGHTGUNS" to select your Gun4IR devices first.');
            } else {
                this.showToast('No devices available.\n\nUse "DETECT (POINTER)" to assign using trigger pull.');
            }
            return;
        }

        // Show device selection overlay
        const overlay = document.createElement('div');
        overlay.className = 'detection-overlay';
        overlay.innerHTML = `
            <div class="detection-message device-selector">
                <h2>SELECT DEVICE FOR ${this.gunManager.guns[gunIndex].name}</h2>
                <div class="device-list">
                    ${availableDevices.map(device => `
                        <button class="device-option" data-device-id="${device.id}">
                            <span class="device-name">${device.productName || 'Unknown Device'}</span>
                            <span class="device-type">${device.type}</span>
                        </button>
                    `).join('')}
                </div>
                <button id="btn-cancel-select">CANCEL</button>
            </div>
        `;
        document.querySelector('.gun-setup-screen').appendChild(overlay);

        // Handle device selection
        overlay.querySelectorAll('.device-option').forEach(btn => {
            btn.onclick = async () => {
                const deviceId = btn.dataset.deviceId;
                const device = availableDevices.find(d => d.id === deviceId);
                if (device) {
                    await this.gunManager.assignHIDDevice(device, gunIndex);
                    this.availableHIDDevices = this.gunManager.getAvailableHIDDevices();
                }
                overlay.remove();
                this.render();
                this.attachListeners();
            };
        });

        // Cancel button
        document.getElementById('btn-cancel-select').onclick = () => {
            overlay.remove();
        };
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
            this.showToast(`Buttons mapped for ${gun.name}!`);

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
