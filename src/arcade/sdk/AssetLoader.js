/**
 * AssetLoader - Utility for loading and caching game assets
 * Supports images, audio, and JSON data
 */
export class AssetLoader {
    constructor() {
        this.cache = {
            images: new Map(),
            audio: new Map(),
            json: new Map()
        };
        this.loading = new Map();
    }

    /**
     * Load an image
     * @param {string} path - Path to the image
     * @returns {Promise<HTMLImageElement>}
     */
    async loadImage(path) {
        // Check cache
        if (this.cache.images.has(path)) {
            return this.cache.images.get(path);
        }

        // Check if already loading
        if (this.loading.has(path)) {
            return this.loading.get(path);
        }

        // Load the image
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.cache.images.set(path, img);
                this.loading.delete(path);
                resolve(img);
            };
            img.onerror = () => {
                this.loading.delete(path);
                reject(new Error(`Failed to load image: ${path}`));
            };
            img.src = path;
        });

        this.loading.set(path, promise);
        return promise;
    }

    /**
     * Load multiple images
     * @param {Array<string>} paths - Array of image paths
     * @returns {Promise<Map<string, HTMLImageElement>>}
     */
    async loadImages(paths) {
        const results = new Map();
        await Promise.all(
            paths.map(async (path) => {
                const img = await this.loadImage(path);
                results.set(path, img);
            })
        );
        return results;
    }

    /**
     * Load an audio file
     * @param {string} path - Path to the audio file
     * @returns {Promise<HTMLAudioElement>}
     */
    async loadAudio(path) {
        // Check cache
        if (this.cache.audio.has(path)) {
            return this.cache.audio.get(path);
        }

        // Check if already loading
        if (this.loading.has(path)) {
            return this.loading.get(path);
        }

        // Load the audio
        const promise = new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.cache.audio.set(path, audio);
                this.loading.delete(path);
                resolve(audio);
            };
            audio.onerror = () => {
                this.loading.delete(path);
                reject(new Error(`Failed to load audio: ${path}`));
            };
            audio.src = path;
            audio.load();
        });

        this.loading.set(path, promise);
        return promise;
    }

    /**
     * Load a JSON file
     * @param {string} path - Path to the JSON file
     * @returns {Promise<Object>}
     */
    async loadJSON(path) {
        // Check cache
        if (this.cache.json.has(path)) {
            return this.cache.json.get(path);
        }

        // Check if already loading
        if (this.loading.has(path)) {
            return this.loading.get(path);
        }

        // Load the JSON
        const promise = fetch(path)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load JSON: ${path}`);
                }
                return response.json();
            })
            .then(data => {
                this.cache.json.set(path, data);
                this.loading.delete(path);
                return data;
            })
            .catch(err => {
                this.loading.delete(path);
                throw err;
            });

        this.loading.set(path, promise);
        return promise;
    }

    /**
     * Preload multiple assets with progress callback
     * @param {Object} manifest - Asset manifest
     * @param {Array<string>} manifest.images - Image paths
     * @param {Array<string>} manifest.audio - Audio paths
     * @param {Array<string>} manifest.json - JSON paths
     * @param {Function} onProgress - Called with (loaded, total)
     * @returns {Promise<Object>} Loaded assets
     */
    async preload(manifest, onProgress = null) {
        const { images = [], audio = [], json = [] } = manifest;
        const total = images.length + audio.length + json.length;
        let loaded = 0;

        const results = {
            images: new Map(),
            audio: new Map(),
            json: new Map()
        };

        const updateProgress = () => {
            loaded++;
            if (onProgress) {
                onProgress(loaded, total);
            }
        };

        // Load all assets in parallel
        const promises = [];

        images.forEach(path => {
            promises.push(
                this.loadImage(path)
                    .then(img => {
                        results.images.set(path, img);
                        updateProgress();
                    })
                    .catch(err => {
                        console.warn(err.message);
                        updateProgress();
                    })
            );
        });

        audio.forEach(path => {
            promises.push(
                this.loadAudio(path)
                    .then(aud => {
                        results.audio.set(path, aud);
                        updateProgress();
                    })
                    .catch(err => {
                        console.warn(err.message);
                        updateProgress();
                    })
            );
        });

        json.forEach(path => {
            promises.push(
                this.loadJSON(path)
                    .then(data => {
                        results.json.set(path, data);
                        updateProgress();
                    })
                    .catch(err => {
                        console.warn(err.message);
                        updateProgress();
                    })
            );
        });

        await Promise.all(promises);
        return results;
    }

    /**
     * Get a cached image
     * @param {string} path - Image path
     * @returns {HTMLImageElement|null}
     */
    getImage(path) {
        return this.cache.images.get(path) || null;
    }

    /**
     * Get a cached audio element
     * @param {string} path - Audio path
     * @returns {HTMLAudioElement|null}
     */
    getAudio(path) {
        return this.cache.audio.get(path) || null;
    }

    /**
     * Get cached JSON data
     * @param {string} path - JSON path
     * @returns {Object|null}
     */
    getJSON(path) {
        return this.cache.json.get(path) || null;
    }

    /**
     * Clear all cached assets
     */
    clearCache() {
        this.cache.images.clear();
        this.cache.audio.clear();
        this.cache.json.clear();
    }

    /**
     * Clear specific asset from cache
     * @param {string} path - Asset path
     */
    uncache(path) {
        this.cache.images.delete(path);
        this.cache.audio.delete(path);
        this.cache.json.delete(path);
    }
}

// Singleton instance for shared use
export const assetLoader = new AssetLoader();
