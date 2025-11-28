/**
 * Manages the registration and retrieval of games in the arcade.
 */
export class GameRegistry {
    /**
     * Default manifest values for optional fields
     */
    static MANIFEST_DEFAULTS = {
        version: '1.0.0',
        author: 'Unknown',
        description: '',
        isAvailable: true,
        thumbnail: null,
        banner: null,
        multiplayer: {
            minPlayers: 1,
            maxPlayers: 1,
            supportedModes: [],
            defaultMode: null
        },
        difficulties: ['normal'],
        modes: ['arcade'],
        features: {
            requiresReload: false,
            hasAchievements: false,
            hasPowerUps: false
        }
    };

    constructor() {
        this.games = new Map();
    }

    /**
     * Validates and normalizes a game manifest
     * @param {Object} manifest - Raw manifest from game
     * @returns {Object} Normalized manifest with defaults applied
     */
    _normalizeManifest(manifest) {
        const defaults = GameRegistry.MANIFEST_DEFAULTS;

        // Required fields
        if (!manifest.id) {
            throw new Error('Manifest missing required field: id');
        }
        if (!manifest.name) {
            throw new Error('Manifest missing required field: name');
        }

        // Apply defaults for optional fields
        const normalized = {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version || defaults.version,
            author: manifest.author || defaults.author,
            description: manifest.description || defaults.description,
            isAvailable: manifest.isAvailable !== undefined ? manifest.isAvailable : defaults.isAvailable,
            thumbnail: manifest.thumbnail || defaults.thumbnail,
            banner: manifest.banner || defaults.banner,
            difficulties: manifest.difficulties || defaults.difficulties,
            modes: manifest.modes || defaults.modes,
            
            // Deep merge multiplayer config
            multiplayer: {
                ...defaults.multiplayer,
                ...(manifest.multiplayer || {})
            },
            
            // Deep merge features config
            features: {
                ...defaults.features,
                ...(manifest.features || {})
            }
        };

        return normalized;
    }

    /**
     * Registers a game class.
     * @param {class} GameClass - The class of the game to register (must extend BaseGame)
     */
    register(GameClass) {
        try {
            const rawManifest = GameClass.getManifest();
            const manifest = this._normalizeManifest(rawManifest);

            if (this.games.has(manifest.id)) {
                console.warn(`Game with ID '${manifest.id}' is already registered. Overwriting.`);
            }

            this.games.set(manifest.id, {
                ...manifest,
                GameClass: GameClass
            });

            console.log(`Registered game: ${manifest.name} (${manifest.id}) v${manifest.version}`);
        } catch (e) {
            console.error("Failed to register game:", e);
        }
    }

    /**
     * Returns a list of all registered game manifests.
     * @returns {Array} Array of game manifests
     */
    getAllGames() {
        return Array.from(this.games.values());
    }

    /**
     * Gets a specific game by ID.
     * @param {string} id - Game ID
     * @returns {Object|undefined} Game registration object
     */
    getGame(id) {
        return this.games.get(id);
    }
}
