/**
 * GunManager class
 * Manages multiple gun devices, detection, and persistence
 * 
 * Supports two detection modes:
 * 1. WebHID mode (preferred): Distinguishes individual Gun4IR/Sinden devices
 * 2. Pointer mode (fallback): Uses browser pointer events (limited to 1 device on Windows)
 */
import { Gun } from './Gun.js';
import { Storage } from '../../platform/storage.js';
import { HIDDeviceManager } from './HIDDeviceManager.js';
import { GunCursorManager } from './GunCursorManager.js';
import { GunCalibration } from './GunCalibration.js';

export class GunManager {
    constructor() {
        this.guns = [];
        this.maxGuns = 4;
        this.activeGunCount = 0;
        this.isDetecting = false;
        
        // WebHID device manager for multi-gun support
        this.hidManager = new HIDDeviceManager();
        this.useWebHID = HIDDeviceManager.isSupported();
        
        // Calibration system
        this.calibration = new GunCalibration();
        
        // Cursor manager for virtual cursors
        this.cursorManager = null;
        
        // Track pending device assignment
        this.pendingAssignment = null;
        
        // Callbacks for game integration
        this.onShoot = null; // Called when trigger is pressed: (gunIndex, x, y) => {}
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Bound handlers for cleanup
        this._boundPointerHandler = this.handleDetectionInput.bind(this);

        // Initialize empty gun slots
        for (let i = 0; i < this.maxGuns; i++) {
            this.guns.push(new Gun(`gun-${i}`, i));
        }
    }

    /**
     * Initialize the manager and load saved profiles
     */
    async init() {
        // Initialize WebHID if supported
        if (this.useWebHID) {
            await this.hidManager.init();
            
            // Set up HID event handlers
            this.hidManager.onDeviceConnected = (deviceInfo) => {
                console.log('Gun device connected:', deviceInfo);
                this.handleHIDDeviceConnected(deviceInfo);
            };
            
            this.hidManager.onDeviceDisconnected = (deviceInfo) => {
                console.log('Gun device disconnected:', deviceInfo);
                this.handleHIDDeviceDisconnected(deviceInfo);
            };
            
            this.hidManager.onDeviceInput = (inputData) => {
                this.handleHIDInput(inputData);
            };
        }
        
        await this.loadProfiles();
        
        // Load calibration data
        await this.calibration.load();
        
        // Initialize cursor manager
        this.cursorManager = new GunCursorManager(this);
        this.cursorManager.init();
        
        console.log('GunManager initialized', { 
            guns: this.guns, 
            webHIDSupported: this.useWebHID 
        });
    }

    /**
     * Register an event listener
     * @param {string} event - Event name ('startButton', etc.)
     * @param {function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {function} callback - Callback to remove
     */
    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event to all listeners
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to listeners
     */
    emit(event, ...args) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(...args));
        }
    }
    
    /**
     * Enable/disable virtual cursors (master switch)
     */
    setCursorsEnabled(enabled) {
        if (this.cursorManager) {
            this.cursorManager.setCursorsEnabled(enabled);
        }
    }

    /**
     * Set whether we're currently in a game
     * Cursors always show in menus, but respect showCursorsInGame setting during gameplay
     */
    setInGame(inGame) {
        if (this.cursorManager) {
            this.cursorManager.setInGame(inGame);
        }
    }

    /**
     * Set whether cursors should show during gameplay (user setting)
     */
    setShowCursorsInGame(show) {
        if (this.cursorManager) {
            this.cursorManager.setShowCursorsInGame(show);
        }
    }

    /**
     * Set the target canvas for coordinate mapping
     * This is needed so the gun knows where the play area is on screen
     */
    setTargetCanvas(canvas) {
        this.calibration.setTargetCanvas(canvas);
    }

    /**
     * Start calibration for a specific gun
     * @param {number} gunIndex - Index of gun to calibrate
     * @param {function} onComplete - Callback when calibration completes
     * @param {function} onCancel - Callback when calibration is cancelled
     */
    startCalibration(gunIndex, onComplete, onCancel) {
        const gun = this.guns[gunIndex];
        if (!gun || !gun.config.hidDeviceId) {
            console.error('Cannot calibrate: Gun not connected via HID');
            onCancel();
            return;
        }

        const deviceId = gun.config.hidDeviceId;
        
        // Create input handler that forwards raw data to calibration wizard
        const onRawInput = (callback) => {
            const handler = (inputData) => {
                if (inputData.deviceId === deviceId && inputData.position) {
                    callback(
                        inputData.position.rawAxis1,
                        inputData.position.rawAxis2,
                        inputData.buttons
                    );
                }
            };
            
            this.hidManager.setDeviceInputHandler(deviceId, handler);
            
            return () => {
                this.hidManager.removeDeviceInputHandler(deviceId);
            };
        };

        // Hide cursors during calibration
        if (this.cursorManager) {
            this.cursorManager.setCursorsEnabled(false);
        }

        this.calibration.startCalibrationWizard(
            deviceId,
            onRawInput,
            (result) => {
                console.log('Calibration complete:', result);
                if (this.cursorManager) {
                    this.cursorManager.setCursorsEnabled(true);
                }
                onComplete(result);
            },
            () => {
                if (this.cursorManager) {
                    this.cursorManager.setCursorsEnabled(true);
                }
                onCancel();
            }
        );
    }

    /**
     * Check if a gun is calibrated
     */
    isGunCalibrated(gunIndex) {
        const gun = this.guns[gunIndex];
        if (!gun || !gun.config.hidDeviceId) return false;
        return this.calibration.isCalibrated(gun.config.hidDeviceId);
    }

    /**
     * Clear calibration for a gun
     */
    clearGunCalibration(gunIndex) {
        const gun = this.guns[gunIndex];
        if (gun && gun.config.hidDeviceId) {
            this.calibration.clearCalibration(gun.config.hidDeviceId);
        }
    }

    /**
     * Load gun profiles from storage
     */
    async loadProfiles() {
        const profiles = await Storage.get('gun-profiles');
        if (profiles && Array.isArray(profiles)) {
            profiles.forEach((profile, index) => {
                if (this.guns[index]) {
                    this.guns[index].fromJSON(profile);
                    // Check if gun has either a pointerId or hidDeviceId
                    if (this.guns[index].config.pointerId !== null || 
                        this.guns[index].config.hidDeviceId !== null) {
                        this.activeGunCount++;
                    }
                }
            });
        }
    }

    /**
     * Save current gun profiles to storage
     */
    async saveProfiles() {
        const profiles = this.guns.map(gun => gun.toJSON());
        await Storage.set('gun-profiles', profiles);
    }

    /**
     * Start listening for new devices (assignment mode)
     * @param {function} onGunAssigned - Callback when a gun is assigned
     */
    startDetection(onGunAssigned) {
        this.isDetecting = true;
        this.onGunAssigned = onGunAssigned;

        // Add global listener for pointer events
        window.addEventListener('pointerdown', this.handleDetectionInput.bind(this));
    }

    /**
     * Stop listening for new devices
     */
    stopDetection() {
        this.isDetecting = false;
        this.onGunAssigned = null;
        window.removeEventListener('pointerdown', this.handleDetectionInput.bind(this));
    }

    /**
     * Handle input during detection mode
     * @param {PointerEvent} event 
     */
    handleDetectionInput(event) {
        if (!this.isDetecting) return;

        // Check if this pointer is already assigned
        const existingGun = this.getGunByPointerId(event.pointerId);
        if (existingGun) {
            console.log(`Pointer ${event.pointerId} already assigned to ${existingGun.name}`);
            return;
        }

        // Assign to next available slot
        const nextSlot = this.getNextAvailableSlot();
        if (nextSlot) {
            nextSlot.config.pointerId = event.pointerId;
            nextSlot.state.isConnected = true;
            this.activeGunCount++;

            console.log(`Assigned pointer ${event.pointerId} to ${nextSlot.name}`);

            this.saveProfiles();

            if (this.onGunAssigned) {
                this.onGunAssigned(nextSlot);
            }
        } else {
            console.log('No more gun slots available');
            this.stopDetection();
        }
    }

    /**
     * Get gun assigned to a specific pointer ID
     * @param {number} pointerId 
     * @returns {Gun|null}
     */
    getGunByPointerId(pointerId) {
        return this.guns.find(gun => gun.config.pointerId === pointerId);
    }

    /**
     * Get next available gun slot
     * @returns {Gun|null}
     */
    getNextAvailableSlot() {
        return this.guns.find(gun => 
            gun.config.pointerId === null && gun.config.hidDeviceId === null
        );
    }

    /**
     * Get gun by HID device ID
     * @param {string} hidDeviceId 
     * @returns {Gun|null}
     */
    getGunByHIDDeviceId(hidDeviceId) {
        return this.guns.find(gun => gun.config.hidDeviceId === hidDeviceId);
    }

    // ==================== WebHID Methods ====================

    /**
     * Request WebHID device selection (must be called from user gesture)
     * Opens browser's device picker for Gun4IR/Sinden devices
     */
    async requestHIDDevices() {
        if (!this.useWebHID) {
            console.warn('WebHID not supported, falling back to pointer detection');
            return [];
        }

        try {
            const devices = await this.hidManager.requestDevices();
            return devices;
        } catch (error) {
            console.error('Error requesting HID devices:', error);
            return [];
        }
    }

    /**
     * Assign a specific HID device to a player slot
     * @param {object} deviceInfo - Device info from HIDDeviceManager
     * @param {number} playerIndex - Player slot (0-3)
     */
    async assignHIDDevice(deviceInfo, playerIndex) {
        const gun = this.guns[playerIndex];
        if (!gun) {
            console.error('Invalid player index:', playerIndex);
            return false;
        }

        // Check if device is already assigned to another player
        const existingGun = this.getGunByHIDDeviceId(deviceInfo.id);
        if (existingGun && existingGun.index !== playerIndex) {
            console.warn(`Device already assigned to ${existingGun.name}`);
            return false;
        }

        // Assign device to gun
        gun.config.hidDeviceId = deviceInfo.id;
        gun.config.deviceType = deviceInfo.type.toLowerCase();
        gun.config.deviceName = deviceInfo.productName;
        gun.state.isConnected = true;
        
        // Clear any pointer ID since we're using HID
        gun.config.pointerId = null;

        this.activeGunCount = this.guns.filter(g => 
            g.config.hidDeviceId !== null || g.config.pointerId !== null
        ).length;

        await this.saveProfiles();

        console.log(`Assigned HID device to ${gun.name}:`, {
            deviceId: deviceInfo.id,
            productName: deviceInfo.productName,
            storedInGun: gun.config.hidDeviceId
        });

        if (this.onGunAssigned) {
            this.onGunAssigned(gun);
        }

        return true;
    }

    /**
     * Handle HID device connected event
     */
    handleHIDDeviceConnected(deviceInfo) {
        // Check if this device was previously assigned
        const gun = this.getGunByHIDDeviceId(deviceInfo.id);
        if (gun) {
            gun.state.isConnected = true;
            console.log(`Reconnected ${deviceInfo.productName} to ${gun.name}`);
        }
    }

    /**
     * Handle HID device disconnected event
     */
    handleHIDDeviceDisconnected(deviceInfo) {
        const gun = this.getGunByHIDDeviceId(deviceInfo.id);
        if (gun) {
            gun.state.isConnected = false;
            console.log(`Disconnected ${deviceInfo.productName} from ${gun.name}`);
        }
    }

    /**
     * Handle HID input from a device
     */
    handleHIDInput(inputData) {
        // Check for pending button mapping first
        if (this._pendingButtonMap) {
            const { targetDeviceId, callback } = this._pendingButtonMap;
            
            // Log for debugging
            if (inputData.buttons.leftPressed || inputData.buttons.rightPressed || inputData.buttons.middlePressed) {
                console.log('Button press during mapping:', {
                    received: inputData.deviceId,
                    expected: targetDeviceId,
                    match: inputData.deviceId === targetDeviceId,
                    buttons: inputData.buttons
                });
            }
            
            // Only accept input from the target device
            if (inputData.deviceId === targetDeviceId) {
                // Determine which button was just pressed
                let buttonIndex = -1;
                if (inputData.buttons.leftPressed) buttonIndex = 0;
                else if (inputData.buttons.rightPressed) buttonIndex = 1;
                else if (inputData.buttons.middlePressed) buttonIndex = 2;

                if (buttonIndex >= 0) {
                    callback(buttonIndex);
                    return; // Don't process further
                }
            }
        }
        
        const gun = this.getGunByHIDDeviceId(inputData.deviceId);
        if (!gun) return;

        // Update gun state based on HID input
        gun.state.lastActive = inputData.timestamp;
        
        // Mark as connected when we receive input (handles reconnection after page reload)
        if (!gun.state.isConnected) {
            gun.state.isConnected = true;
            console.log(`Gun ${gun.index} connected via HID input`);
        }
        
        // Update position if absolute coordinates are available
        if (inputData.position && inputData.position.isAbsolute) {
            const { rawAxis1, rawAxis2 } = inputData.position;
            
            // Transform using calibration
            const transformed = this.calibration.transform(
                inputData.deviceId, 
                rawAxis1, 
                rawAxis2
            );
            
            gun.state.x = transformed.x;
            gun.state.y = transformed.y;
            gun.state.offscreen = transformed.offscreen;
            
            // Update cursor position - always, regardless of game state
            if (this.cursorManager) {
                this.cursorManager.updateCursor(gun.index, gun.state.x, gun.state.y);
            }
        }

        // Handle button presses
        const triggerBtn = gun.config.buttons.trigger;
        const reloadBtn = gun.config.buttons.reload;
        const startBtn = gun.config.buttons.start;

        // Map HID buttons to configured gun buttons
        // Standard HID: left=0, right=1, middle=2
        const leftPressed = inputData.buttons.leftPressed;
        const rightPressed = inputData.buttons.rightPressed;
        const middlePressed = inputData.buttons.middlePressed;
        
        // Check if trigger was pressed
        const triggerPressed = (triggerBtn === 0 && leftPressed) ||
                               (triggerBtn === 1 && rightPressed) ||
                               (triggerBtn === 2 && middlePressed);
        
        // Check if start button was pressed
        const startPressed = (startBtn === 0 && leftPressed) ||
                             (startBtn === 1 && rightPressed) ||
                             (startBtn === 2 && middlePressed);
        
        // Update trigger state
        gun.state.isTriggerDown = (triggerBtn === 0 && inputData.buttons.left) ||
                                  (triggerBtn === 1 && inputData.buttons.right) ||
                                  (triggerBtn === 2 && inputData.buttons.middle);
        
        // Fire start button event if pressed (for pause/menu)
        if (startPressed) {
            this.emit('startButton', gun.index);
        }
        
        // Fire shoot event if trigger was just pressed
        if (triggerPressed) {
            // Try to click UI element first
            let clickedUI = false;
            if (this.cursorManager) {
                clickedUI = this.cursorManager.simulateClick(gun.index);
            }
            
            // If no UI was clicked, fire shoot event for game
            if (!clickedUI && this.onShoot) {
                this.onShoot(gun.index, gun.state.x, gun.state.y);
            }
        }

        // If we're in detection mode and waiting for this device
        if (this.isDetecting && this.pendingHIDCallback) {
            if (inputData.buttons.leftPressed || inputData.buttons.rightPressed) {
                this.pendingHIDCallback(inputData);
            }
        }
    }

    /**
     * Start HID-based detection mode
     * Listens for trigger pulls from unassigned HID devices
     */
    startHIDDetection(onGunAssigned) {
        if (!this.useWebHID) {
            console.warn('WebHID not supported');
            return false;
        }

        this.isDetecting = true;
        this.onGunAssigned = onGunAssigned;

        // Set up callback for HID input during detection
        this.pendingHIDCallback = async (inputData) => {
            // Check if this device is already assigned
            const existingGun = this.getGunByHIDDeviceId(inputData.deviceId);
            if (existingGun) {
                console.log(`Device already assigned to ${existingGun.name}`);
                return;
            }

            // Get next available slot
            const nextSlot = this.getNextAvailableSlot();
            if (!nextSlot) {
                console.log('No more gun slots available');
                this.stopDetection();
                return;
            }

            // Get device info
            const deviceInfo = this.hidManager.getDevice(inputData.deviceId);
            if (deviceInfo) {
                await this.assignHIDDevice(deviceInfo, nextSlot.index);
            }
        };

        return true;
    }

    // ==================== Unified Methods ====================

    /**
     * Listen for the next button press from a specific gun
     * Works with both HID and pointer-based guns
     * @param {number} gunIndex - Index of the gun to listen for
     * @param {function} callback - Called with (buttonIndex)
     * @returns {function} Cleanup function to stop listening
     */
    listenForButton(gunIndex, callback) {
        const gun = this.guns[gunIndex];
        if (!gun) {
            console.error('Cannot listen for button: Gun not found');
            return () => { };
        }
        
        // Allow mapping even if not marked as connected - HID device may be assigned but no input received yet
        if (!gun.config.hidDeviceId && !gun.config.pointerId) {
            console.error('Cannot listen for button: No device assigned');
            return () => { };
        }

        // If using HID device
        if (gun.config.hidDeviceId) {
            let resolved = false;
            const targetDeviceId = gun.config.hidDeviceId;
            console.log(`Setting up HID listener for gun ${gunIndex}, deviceId: ${targetDeviceId}`);
            
            // Store pending button mapping request
            this._pendingButtonMap = {
                gunIndex,
                targetDeviceId,
                callback: (buttonIndex) => {
                    if (resolved) return;
                    resolved = true;
                    this._pendingButtonMap = null;
                    console.log(`Gun ${gunIndex} HID button pressed: ${buttonIndex}`);
                    callback(buttonIndex);
                }
            };

            return () => {
                resolved = true;
                this._pendingButtonMap = null;
            };
        }

        // Fallback to pointer events
        const handler = (event) => {
            // Only accept input from the specific gun's pointerId
            if (event.pointerId === gun.config.pointerId) {
                window.removeEventListener('pointerdown', handler);
                event.preventDefault();
                event.stopPropagation();

                console.log(`Gun ${gunIndex} button pressed: ${event.button}`);
                callback(event.button);
            }
        };

        window.addEventListener('pointerdown', handler);
        return () => window.removeEventListener('pointerdown', handler);
    }

    /**
     * Reset all gun assignments
     */
    async resetAssignments() {
        this.guns.forEach(gun => {
            gun.config.pointerId = null;
            gun.config.hidDeviceId = null;
            gun.config.deviceType = 'mouse';
            gun.config.deviceName = '';
            gun.state.isConnected = false;
        });
        this.activeGunCount = 0;
        await this.saveProfiles();
    }

    /**
     * Get available (unassigned) HID devices
     */
    getAvailableHIDDevices() {
        if (!this.useWebHID) return [];
        
        const allDevices = this.hidManager.getDevices();
        return allDevices.filter(device => 
            !this.getGunByHIDDeviceId(device.id)
        );
    }

    /**
     * Check if WebHID is available and should be used
     */
    shouldUseWebHID() {
        return this.useWebHID;
    }
}
