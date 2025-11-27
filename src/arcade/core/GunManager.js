/**
 * GunManager class
 * Manages multiple gun devices, detection, and persistence
 */
import { Gun } from './Gun.js';
import { Storage } from '../../platform/storage.js';

export class GunManager {
    constructor() {
        this.guns = [];
        this.maxGuns = 4;
        this.activeGunCount = 0;
        this.isDetecting = false;

        // Initialize empty gun slots
        for (let i = 0; i < this.maxGuns; i++) {
            this.guns.push(new Gun(`gun-${i}`, i));
        }
    }

    /**
     * Initialize the manager and load saved profiles
     */
    async init() {
        await this.loadProfiles();
        console.log('GunManager initialized', this.guns);
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
                    if (this.guns[index].config.pointerId !== null) {
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
        return this.guns.find(gun => gun.config.pointerId === null);
    }

    /**
     * Listen for the next button press from a specific gun
     * @param {number} gunIndex - Index of the gun to listen for
     * @param {function} callback - Called with (buttonIndex)
     * @returns {function} Cleanup function to stop listening
     */
    listenForButton(gunIndex, callback) {
        const gun = this.guns[gunIndex];
        if (!gun || !gun.state.isConnected) {
            console.error('Cannot listen for button: Gun not connected');
            return () => { };
        }

        const handler = (event) => {
            // Only accept input from the specific gun's pointerId
            if (event.pointerId === gun.config.pointerId) {
                window.removeEventListener('pointerdown', handler);
                // Prevent default to avoid side effects
                event.preventDefault();
                event.stopPropagation();

                console.log(`Gun ${gunIndex} button pressed: ${event.button}`);
                callback(event.button);
            }
        };

        window.addEventListener('pointerdown', handler);

        // Return a cancel function
        return () => window.removeEventListener('pointerdown', handler);
    }

    /**
     * Reset all gun assignments
     */
    async resetAssignments() {
        this.guns.forEach(gun => {
            gun.config.pointerId = null;
            gun.state.isConnected = false;
        });
        this.activeGunCount = 0;
        await this.saveProfiles();
    }
}
