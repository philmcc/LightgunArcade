/**
 * Platform detection utility
 * Web-only version (Tauri support can be added later)
 */
export const Platform = {
    /**
     * Check if running in native app (always false for now)
     * @returns {boolean}
     */
    isNative: () => false,

    /**
     * Check if running in web browser
     * @returns {boolean}
     */
    isWeb: () => true,

    /**
     * Check if running on macOS
     * @returns {boolean}
     */
    isMac: () => navigator.platform.toUpperCase().indexOf('MAC') >= 0,

    /**
     * Check if running on Windows
     * @returns {boolean}
     */
    isWindows: () => navigator.platform.toUpperCase().indexOf('WIN') >= 0,

    /**
     * Check if running on Linux
     * @returns {boolean}
     */
    isLinux: () => navigator.platform.toUpperCase().indexOf('LINUX') >= 0,

    /**
     * Get current OS type
     * @returns {Promise<string>} Browser platform string
     */
    async getOS() {
        return navigator.platform;
    }
};
