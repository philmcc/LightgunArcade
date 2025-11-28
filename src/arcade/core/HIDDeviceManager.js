/**
 * HIDDeviceManager class
 * Uses WebHID API to detect and distinguish multiple lightgun devices
 * 
 * This solves the Windows limitation where all pointing devices share
 * a single system cursor and pointerId.
 */

// Known lightgun device identifiers
const KNOWN_DEVICES = {
    // Gun4IR devices (Arduino-based)
    GUN4IR: {
        vendorId: 0x2341,  // Arduino SA
        productIds: [
            0x8042,  // GUN4IR Pro Micro P1
            0x8043,  // GUN4IR Pro Micro P2
            0x8036,  // Arduino Leonardo (common for DIY)
            0x8037,  // Arduino Micro
        ],
        name: 'Gun4IR'
    },
    // Sinden Lightgun
    SINDEN: {
        vendorId: 0x2341,  // Also Arduino-based
        productIds: [0x8036, 0x8037],
        name: 'Sinden'
    }
};

export class HIDDeviceManager {
    constructor() {
        this.devices = new Map();  // Map of deviceId -> HIDDevice
        this.deviceInputHandlers = new Map();  // Map of deviceId -> callback
        this.deviceButtonStates = new Map();  // Map of deviceId -> {left, right, middle}
        this.isSupported = 'hid' in navigator;
        this.onDeviceConnected = null;
        this.onDeviceDisconnected = null;
        this.onDeviceInput = null;
    }

    /**
     * Check if WebHID is supported
     */
    static isSupported() {
        return 'hid' in navigator;
    }

    /**
     * Initialize and set up connection listeners
     */
    async init() {
        if (!this.isSupported) {
            console.warn('WebHID not supported in this browser');
            return false;
        }

        // Listen for device connect/disconnect
        navigator.hid.addEventListener('connect', (event) => {
            console.log('HID device connected:', event.device);
            this.handleDeviceConnected(event.device);
        });

        navigator.hid.addEventListener('disconnect', (event) => {
            console.log('HID device disconnected:', event.device);
            this.handleDeviceDisconnected(event.device);
        });

        // Check for previously granted devices
        await this.checkExistingDevices();

        return true;
    }

    /**
     * Check for devices already granted permission
     */
    async checkExistingDevices() {
        if (!this.isSupported) return [];

        try {
            const devices = await navigator.hid.getDevices();
            console.log('Found existing HID devices:', devices);
            
            for (const device of devices) {
                if (this.isLightgunDevice(device)) {
                    await this.registerDevice(device);
                }
            }
            
            return Array.from(this.devices.values());
        } catch (error) {
            console.error('Error checking existing devices:', error);
            return [];
        }
    }

    /**
     * Request user to select lightgun devices
     * Must be called from a user gesture (click, etc.)
     */
    async requestDevices() {
        if (!this.isSupported) {
            throw new Error('WebHID not supported');
        }

        // Build filter for known lightgun devices
        const filters = [];
        
        // Add Gun4IR filters
        for (const productId of KNOWN_DEVICES.GUN4IR.productIds) {
            filters.push({
                vendorId: KNOWN_DEVICES.GUN4IR.vendorId,
                productId: productId
            });
        }

        try {
            // Request devices - this shows a browser picker dialog
            const devices = await navigator.hid.requestDevice({ filters });
            
            console.log('User selected devices:', devices);
            
            const registered = [];
            for (const device of devices) {
                const info = await this.registerDevice(device);
                if (info) registered.push(info);
            }
            
            return registered;
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                console.log('User cancelled device selection');
                return [];
            }
            throw error;
        }
    }

    /**
     * Check if a device is a known lightgun
     */
    isLightgunDevice(device) {
        for (const type of Object.values(KNOWN_DEVICES)) {
            if (device.vendorId === type.vendorId && 
                type.productIds.includes(device.productId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get device type name
     */
    getDeviceType(device) {
        for (const [key, type] of Object.entries(KNOWN_DEVICES)) {
            if (device.vendorId === type.vendorId && 
                type.productIds.includes(device.productId)) {
                return type.name;
            }
        }
        return 'Unknown';
    }

    /**
     * Generate unique device ID
     */
    getDeviceId(device) {
        // Use vendor:product:serialNumber if available
        // If no serial, use a combination of properties to try to make it unique
        const serial = device.serialNumber || '';
        const productName = device.productName || '';
        
        // If we have a serial number, use it
        if (serial) {
            return `${device.vendorId.toString(16)}:${device.productId.toString(16)}:${serial}`;
        }
        
        // Otherwise, try to use the device object reference to create a unique key
        // by checking if we already have this exact device object
        for (const [existingId, existingDevice] of this.devices) {
            if (existingDevice === device) {
                return existingId;
            }
        }
        
        // Generate a new unique ID based on count of similar devices
        const baseId = `${device.vendorId.toString(16)}:${device.productId.toString(16)}`;
        let counter = 0;
        let candidateId = `${baseId}:${counter}`;
        while (this.devices.has(candidateId)) {
            counter++;
            candidateId = `${baseId}:${counter}`;
        }
        return candidateId;
    }

    /**
     * Register a device and open connection
     */
    async registerDevice(device) {
        // Check if this exact device object is already registered
        for (const [existingId, existingDevice] of this.devices) {
            if (existingDevice === device) {
                console.log('Device already registered:', existingId);
                return this.getDeviceInfo(device, existingId);
            }
        }
        
        const deviceId = this.getDeviceId(device);
        
        if (this.devices.has(deviceId)) {
            console.log('Device ID already in use:', deviceId);
            return this.getDeviceInfo(device, deviceId);
        }

        try {
            // Open the device if not already open
            if (!device.opened) {
                console.log(`Opening device: ${deviceId}`);
                await device.open();
                console.log(`Device opened successfully: ${deviceId}, opened=${device.opened}`);
            } else {
                console.log(`Device already open: ${deviceId}`);
            }

            // Store the assigned ID on the device object for consistent lookup
            device._assignedId = deviceId;
            this.devices.set(deviceId, device);

            // Set up input report listener - use the captured deviceId
            console.log(`Setting up input listener for device: ${deviceId}`);
            device.addEventListener('inputreport', (event) => {
                this.handleInputReport(deviceId, event);
            });

            const info = this.getDeviceInfo(device, deviceId);
            console.log('Registered device:', info);

            if (this.onDeviceConnected) {
                this.onDeviceConnected(info);
            }

            return info;
        } catch (error) {
            console.error('Error registering device:', error);
            return null;
        }
    }

    /**
     * Get device info object
     * @param {HIDDevice} device 
     * @param {string} knownId - Optional known ID to use instead of recalculating
     */
    getDeviceInfo(device, knownId = null) {
        // Use the assigned ID if available, or the known ID, or calculate it
        const id = knownId || device._assignedId || this.getDeviceId(device);
        return {
            id,
            vendorId: device.vendorId,
            productId: device.productId,
            productName: device.productName || 'Unknown Device',
            serialNumber: device.serialNumber || '',
            type: this.getDeviceType(device),
            device: device
        };
    }

    /**
     * Handle device connected event
     */
    handleDeviceConnected(device) {
        if (this.isLightgunDevice(device)) {
            this.registerDevice(device);
        }
    }

    /**
     * Handle device disconnected event
     */
    handleDeviceDisconnected(device) {
        // Use the stored ID if available
        const deviceId = device._assignedId || this.getDeviceId(device);
        
        if (this.devices.has(deviceId)) {
            this.devices.delete(deviceId);
            this.deviceInputHandlers.delete(deviceId);
            this.deviceButtonStates.delete(deviceId);
            
            if (this.onDeviceDisconnected) {
                this.onDeviceDisconnected(this.getDeviceInfo(device, deviceId));
            }
        }
    }

    /**
     * Handle input report from device
     */
    handleInputReport(deviceId, event) {
        const { data, device, reportId } = event;
        
        // Debug: Log raw data for first few reports or when buttons change
        const prevState = this.deviceButtonStates.get(deviceId) || { left: false, right: false, middle: false, raw: 0 };
        const rawByte0 = data.getUint8(0);
        const rawByte1 = data.byteLength > 1 ? data.getUint8(1) : 0;
        const rawByte2 = data.byteLength > 2 ? data.getUint8(2) : 0;
        const rawByte3 = data.byteLength > 3 ? data.getUint8(3) : 0;
        
        // Log when any button byte changes (for debugging button mapping)
        if (rawByte0 !== prevState.raw || rawByte1 !== prevState.rawByte1 || rawByte2 !== prevState.rawByte2) {
            console.log(`HID Report [${deviceId}]: bytes=[${rawByte0}, ${rawByte1}, ${rawByte2}, ${rawByte3}] len=${data.byteLength} reportId=${reportId}`);
        }
        
        // Gun4IR in joystick mode has buttons in different positions
        // Try to detect the format based on data length and report ID
        let buttons, leftButton, rightButton, middleButton;
        
        if (data.byteLength >= 8) {
            // Gun4IR joystick mode (reportId 7 for 15-byte reports)
            // Byte 0: Buttons (trigger=bit0, A=bit1, B=bit2, etc.)
            buttons = rawByte0;
            leftButton = (buttons & 0x01) !== 0;
            rightButton = (buttons & 0x02) !== 0;
            middleButton = (buttons & 0x04) !== 0;
            
            // Also check if buttons might be in a different byte (some Gun4IR configs)
            // If byte 0 is always 0 but byte 1 has button data
            if (buttons === 0 && rawByte1 !== 0) {
                buttons = rawByte1;
                leftButton = (buttons & 0x01) !== 0;
                rightButton = (buttons & 0x02) !== 0;
                middleButton = (buttons & 0x04) !== 0;
            }
        } else {
            // Standard HID mouse report format:
            // Byte 0: Button state (bit 0 = left, bit 1 = right, bit 2 = middle)
            buttons = rawByte0;
            leftButton = (buttons & 0x01) !== 0;
            rightButton = (buttons & 0x02) !== 0;
            middleButton = (buttons & 0x04) !== 0;
        }
        
        // Detect button press events (transition from false to true)
        const leftPressed = leftButton && !prevState.left;
        const rightPressed = rightButton && !prevState.right;
        const middlePressed = middleButton && !prevState.middle;
        
        // Update stored state (include raw bytes for debug logging comparison)
        this.deviceButtonStates.set(deviceId, { left: leftButton, right: rightButton, middle: middleButton, raw: rawByte0, rawByte1, rawByte2 });
        
        // Parse X/Y coordinates
        let x = 0, y = 0;
        let isAbsolute = false;
        
        // Raw axis values for calibration
        let rawAxis1 = 0, rawAxis2 = 0;
        
        if (data.byteLength >= 8) {
            // Gun4IR joystick mode (15 bytes):
            // Byte 0: Buttons
            // Bytes 1-3: Padding (00 00 00)
            // Bytes 4-5: First axis (little-endian 16-bit)
            // Bytes 6-7: Second axis (little-endian 16-bit)
            rawAxis1 = data.getUint8(4) | (data.getUint8(5) << 8);
            rawAxis2 = data.getUint8(6) | (data.getUint8(7) << 8);
            
            // Calibration will handle the actual transformation
            // For now, pass raw values - GunManager will transform using calibration
            isAbsolute = true;
        } else if (data.byteLength >= 3) {
            // Standard HID mouse: relative movements
            x = data.getInt8(1);
            y = data.getInt8(2);
            isAbsolute = false;
        }

        const inputData = {
            deviceId,
            reportId,
            buttons: {
                left: leftButton,
                right: rightButton,
                middle: middleButton,
                raw: buttons,
                // Press events (just became true this frame)
                leftPressed,
                rightPressed,
                middlePressed
            },
            position: { x, y, isAbsolute, rawAxis1, rawAxis2 },
            rawData: data,
            timestamp: Date.now()
        };

        // Call device-specific handler if registered
        const handler = this.deviceInputHandlers.get(deviceId);
        if (handler) {
            handler(inputData);
        }

        // Call global handler
        if (this.onDeviceInput) {
            this.onDeviceInput(inputData);
        }
    }

    /**
     * Register input handler for specific device
     */
    setDeviceInputHandler(deviceId, handler) {
        this.deviceInputHandlers.set(deviceId, handler);
    }

    /**
     * Remove input handler for device
     */
    removeDeviceInputHandler(deviceId) {
        this.deviceInputHandlers.delete(deviceId);
    }

    /**
     * Get all registered devices
     */
    getDevices() {
        return Array.from(this.devices.entries()).map(([id, device]) => 
            this.getDeviceInfo(device)
        );
    }

    /**
     * Get device by ID
     */
    getDevice(deviceId) {
        const device = this.devices.get(deviceId);
        return device ? this.getDeviceInfo(device) : null;
    }

    /**
     * Close all device connections
     */
    async closeAll() {
        for (const [id, device] of this.devices) {
            try {
                await device.close();
            } catch (e) {
                console.error('Error closing device:', e);
            }
        }
        this.devices.clear();
        this.deviceInputHandlers.clear();
    }
}
