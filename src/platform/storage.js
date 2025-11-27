/**
 * Storage abstraction layer
 * Simple web storage using LocalStorage
 */

export const Storage = {
    /**
     * Get a value from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Parsed value or null
     */
    async get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    /**
     * Save a value to storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store (will be stringified)
     * @returns {Promise<void>}
     */
    async set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage set error:', e);
        }
    },

    /**
     * Remove a value from storage
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Storage remove error:', e);
        }
    },

    /**
     * Clear all storage
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Storage clear error:', e);
        }
    }
};
