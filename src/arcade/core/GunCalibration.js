/**
 * GunCalibration class
 * Handles calibration of lightgun coordinates to screen coordinates
 * 
 * Key insight: The gun points at the PHYSICAL MONITOR, not the browser window.
 * Calibration captures the raw axis values that correspond to the monitor's corners.
 * Then we map: raw coords -> monitor coords -> canvas coords
 * 
 * This handles:
 * - Window resize
 * - Window move
 * - DevTools open/close
 * - Any canvas position changes
 */
import { Storage } from '../../platform/storage.js';

export class GunCalibration {
    constructor() {
        // Calibration data per device
        // Key: deviceId, Value: { rawXMin, rawXMax, rawYMin, rawYMax, axisSwapped, xInverted, yInverted, screenWidth, screenHeight }
        this.calibrationData = new Map();
        
        // Reference to the target canvas element
        this.targetCanvas = null;
        
        // Default raw range (Gun4IR typical)
        this.defaultRange = {
            min: 0,
            max: 32766
        };
    }
    
    /**
     * Set the target canvas for coordinate mapping
     */
    setTargetCanvas(canvas) {
        this.targetCanvas = canvas;
    }

    /**
     * Load calibration data from storage
     */
    async load() {
        const saved = await Storage.get('gun-calibration');
        if (saved) {
            for (const [deviceId, data] of Object.entries(saved)) {
                this.calibrationData.set(deviceId, data);
            }
        }
        console.log('Loaded calibration data:', this.calibrationData);
    }

    /**
     * Save calibration data to storage
     */
    async save() {
        const data = {};
        for (const [deviceId, calibration] of this.calibrationData) {
            data[deviceId] = calibration;
        }
        await Storage.set('gun-calibration', data);
    }

    /**
     * Check if a device has calibration data
     */
    isCalibrated(deviceId) {
        return this.calibrationData.has(deviceId);
    }

    /**
     * Get calibration for a device
     */
    getCalibration(deviceId) {
        return this.calibrationData.get(deviceId);
    }

    /**
     * Set calibration for a device
     */
    setCalibration(deviceId, calibration) {
        this.calibrationData.set(deviceId, calibration);
        this.save();
    }

    /**
     * Clear calibration for a device
     */
    clearCalibration(deviceId) {
        this.calibrationData.delete(deviceId);
        this.save();
    }

    /**
     * Transform raw gun coordinates to canvas-relative coordinates
     * @param {string} deviceId - Device ID
     * @param {number} rawAxis1 - First raw axis value (bytes 4-5)
     * @param {number} rawAxis2 - Second raw axis value (bytes 6-7)
     * @returns {{x: number, y: number, offscreen: boolean, screenX: number, screenY: number}}
     */
    transform(deviceId, rawAxis1, rawAxis2) {
        const calibration = this.calibrationData.get(deviceId);
        
        if (!calibration) {
            // No calibration - use default mapping (may be inaccurate)
            return this.defaultTransform(rawAxis1, rawAxis2);
        }

        const { scaleX, offsetX, scaleY, offsetY, axisSwapped } = calibration;

        // Apply axis swap if needed (for Gun4IR: axis1 = X, axis2 = Y)
        const rawX = axisSwapped ? rawAxis1 : rawAxis2;
        const rawY = axisSwapped ? rawAxis2 : rawAxis1;

        // Apply linear mapping: screen = raw * scale + offset
        // This directly gives us screen pixel coordinates
        const screenX = rawX * scaleX + offsetX;
        const screenY = rawY * scaleY + offsetY;

        // Now convert from screen coordinates to canvas-relative coordinates
        // Get the canvas bounding rect (position relative to viewport)
        let canvasRect;
        if (this.targetCanvas) {
            canvasRect = this.targetCanvas.getBoundingClientRect();
        } else {
            // Fallback to full window
            canvasRect = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        }

        // Window position on screen
        const windowScreenX = window.screenX || window.screenLeft || 0;
        const windowScreenY = window.screenY || window.screenTop || 0;

        // Canvas position on screen = window position + canvas position in viewport
        const canvasScreenX = windowScreenX + canvasRect.left;
        const canvasScreenY = windowScreenY + canvasRect.top;

        // Convert screen coordinates to canvas-relative coordinates
        const x = screenX - canvasScreenX;
        const y = screenY - canvasScreenY;

        // Check if offscreen (outside canvas bounds with margin)
        const marginX = canvasRect.width * 0.1;
        const marginY = canvasRect.height * 0.1;
        const offscreen = x < -marginX || x > canvasRect.width + marginX || 
                          y < -marginY || y > canvasRect.height + marginY;

        return { 
            x, 
            y, 
            offscreen,
            screenX,
            screenY
        };
    }

    /**
     * Default transform without calibration
     */
    defaultTransform(rawAxis1, rawAxis2) {
        // Assume axis2 is X, axis1 is Y (common Gun4IR layout)
        const maxVal = this.defaultRange.max;
        const x = (rawAxis2 / maxVal) * window.innerWidth;
        const y = (rawAxis1 / maxVal) * window.innerHeight;
        
        return { x, y, offscreen: false };
    }

    /**
     * Create calibration wizard UI
     * Simple 2-point calibration: top-left and bottom-right corners
     * @param {string} deviceId - Device ID to calibrate
     * @param {function} onRawInput - Callback that receives raw input: (rawAxis1, rawAxis2, buttons)
     * @param {function} onComplete - Callback when calibration is complete
     * @param {function} onCancel - Callback when calibration is cancelled
     */
    startCalibrationWizard(deviceId, onRawInput, onComplete, onCancel) {
        const overlay = document.createElement('div');
        overlay.id = 'calibration-overlay';
        overlay.innerHTML = `
            <style>
                #calibration-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.95);
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: 'Press Start 2P', monospace;
                }
                .calibration-target {
                    position: absolute;
                    width: 80px;
                    height: 80px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: pulse 1s infinite;
                }
                .calibration-target svg {
                    width: 100%;
                    height: 100%;
                }
                .calibration-instructions {
                    text-align: center;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                }
                .calibration-instructions h2 {
                    color: #00ccff;
                    margin-bottom: 20px;
                    font-size: 24px;
                }
                .calibration-step {
                    font-size: 16px;
                    margin-bottom: 10px;
                    color: #ffcc00;
                }
                .calibration-hint {
                    font-size: 12px;
                    color: #888;
                    margin-top: 20px;
                }
                .calibration-progress {
                    display: flex;
                    gap: 20px;
                    margin-top: 30px;
                    justify-content: center;
                }
                .calibration-dot {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background: #333;
                    border: 3px solid #666;
                }
                .calibration-dot.complete {
                    background: #00ff00;
                    border-color: #00ff00;
                }
                .calibration-dot.active {
                    background: #ff0055;
                    border-color: #ff0055;
                    animation: pulse 0.5s infinite;
                }
                .btn-cancel {
                    position: absolute;
                    bottom: 30px;
                    padding: 15px 40px;
                    background: #444;
                    border: 2px solid #666;
                    color: white;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 14px;
                }
                .btn-cancel:hover {
                    background: #555;
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.15); opacity: 0.8; }
                }
            </style>
            <div class="calibration-instructions">
                <h2>GUN CALIBRATION</h2>
                <div class="calibration-step" id="cal-step-text">Aim at the TOP-LEFT target and pull trigger</div>
                <div class="calibration-progress">
                    <div class="calibration-dot active" data-step="0"></div>
                    <div class="calibration-dot" data-step="1"></div>
                </div>
                <div class="calibration-hint">Calibration works for any window size once complete</div>
            </div>
            <div class="calibration-target" id="cal-target">
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#ff0055" stroke-width="3"/>
                    <circle cx="50" cy="50" r="30" fill="none" stroke="#ff0055" stroke-width="2"/>
                    <circle cx="50" cy="50" r="5" fill="#ff0055"/>
                    <line x1="50" y1="0" x2="50" y2="40" stroke="#ff0055" stroke-width="2"/>
                    <line x1="50" y1="60" x2="50" y2="100" stroke="#ff0055" stroke-width="2"/>
                    <line x1="0" y1="50" x2="40" y2="50" stroke="#ff0055" stroke-width="2"/>
                    <line x1="60" y1="50" x2="100" y2="50" stroke="#ff0055" stroke-width="2"/>
                </svg>
            </div>
            <button class="btn-cancel" id="btn-cancel-cal">CANCEL</button>
        `;
        document.body.appendChild(overlay);

        // Simple 2-point calibration: top-left and bottom-right
        // Use screen coordinates for the targets (not window coordinates)
        // This accounts for window position on screen
        const margin = 60;
        const windowX = window.screenX || window.screenLeft || 0;
        const windowY = window.screenY || window.screenTop || 0;
        
        // Target positions in SCREEN coordinates
        const screenTopLeftX = windowX + margin;
        const screenTopLeftY = windowY + margin;
        const screenBottomRightX = windowX + window.innerWidth - margin;
        const screenBottomRightY = windowY + window.innerHeight - margin;
        
        const points = [
            { 
                name: 'topLeft', 
                x: margin, 
                y: margin, 
                screenX: screenTopLeftX,
                screenY: screenTopLeftY,
                text: 'Aim at the TOP-LEFT target and pull trigger' 
            },
            { 
                name: 'bottomRight', 
                x: window.innerWidth - margin, 
                y: window.innerHeight - margin,
                screenX: screenBottomRightX,
                screenY: screenBottomRightY,
                text: 'Aim at the BOTTOM-RIGHT target and pull trigger' 
            }
        ];

        let currentStep = 0;
        const rawCaptures = [];

        const target = document.getElementById('cal-target');
        const stepText = document.getElementById('cal-step-text');
        const dots = overlay.querySelectorAll('.calibration-dot');

        // Position target
        const positionTarget = (step) => {
            const point = points[step];
            target.style.left = `${point.x - 40}px`;
            target.style.top = `${point.y - 40}px`;
            stepText.textContent = point.text;
            
            // Update dots
            dots.forEach((dot, i) => {
                dot.classList.remove('active', 'complete');
                if (i < step) dot.classList.add('complete');
                if (i === step) dot.classList.add('active');
            });
        };

        positionTarget(0);

        // Handle input
        const inputHandler = (rawAxis1, rawAxis2, buttons) => {
            // Check for trigger press
            if (buttons.leftPressed) {
                const point = points[currentStep];
                rawCaptures.push({
                    name: point.name,
                    rawAxis1,
                    rawAxis2,
                    screenX: point.screenX,
                    screenY: point.screenY
                });

                currentStep++;

                if (currentStep >= points.length) {
                    // Calibration complete - analyze and save
                    const calibrationResult = this.analyzeCalibration(rawCaptures);
                    this.setCalibration(deviceId, calibrationResult);
                    
                    overlay.remove();
                    onComplete(calibrationResult);
                } else {
                    positionTarget(currentStep);
                }
            }
        };

        // Register input handler
        const unsubscribe = onRawInput(inputHandler);

        // Cancel button
        document.getElementById('btn-cancel-cal').onclick = () => {
            unsubscribe();
            overlay.remove();
            onCancel();
        };

        return () => {
            unsubscribe();
            overlay.remove();
        };
    }

    /**
     * Analyze calibration captures to determine axis mapping and create linear mapping
     * @param {Array} captures - Array of {name, rawAxis1, rawAxis2, screenX, screenY}
     * @returns {Object} Calibration data
     */
    analyzeCalibration(captures) {
        const topLeft = captures.find(c => c.name === 'topLeft');
        const bottomRight = captures.find(c => c.name === 'bottomRight');

        console.log('Calibration captures:', { topLeft, bottomRight });

        // We have two points with known screen coordinates and raw values
        // We need to create a linear mapping: raw -> screen
        
        // For Gun4IR, axis1 = X, axis2 = Y (swapped from typical)
        // This was determined empirically in previous testing
        
        // Raw values at each calibration point
        const rawXAtTopLeft = topLeft.rawAxis1;
        const rawXAtBottomRight = bottomRight.rawAxis1;
        const rawYAtTopLeft = topLeft.rawAxis2;
        const rawYAtBottomRight = bottomRight.rawAxis2;
        
        // Screen coordinates at each calibration point
        const screenXAtTopLeft = topLeft.screenX;
        const screenXAtBottomRight = bottomRight.screenX;
        const screenYAtTopLeft = topLeft.screenY;
        const screenYAtBottomRight = bottomRight.screenY;
        
        // Calculate linear mapping coefficients: screen = raw * scale + offset
        // For X: screenX = rawX * scaleX + offsetX
        // For Y: screenY = rawY * scaleY + offsetY
        
        const scaleX = (screenXAtBottomRight - screenXAtTopLeft) / (rawXAtBottomRight - rawXAtTopLeft);
        const offsetX = screenXAtTopLeft - (rawXAtTopLeft * scaleX);
        
        const scaleY = (screenYAtBottomRight - screenYAtTopLeft) / (rawYAtBottomRight - rawYAtTopLeft);
        const offsetY = screenYAtTopLeft - (rawYAtTopLeft * scaleY);

        const result = {
            // Linear mapping coefficients
            scaleX,
            offsetX,
            scaleY,
            offsetY,
            // Keep axis swap flag for transform function
            axisSwapped: true, // axis1 = X, axis2 = Y
            // Store screen dimensions for reference
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
        };

        console.log('Calibration result:', result);
        console.log('Screen dimensions:', window.screen.width, 'x', window.screen.height);
        return result;
    }
}
