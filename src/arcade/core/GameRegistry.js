/**
 * Manages the registration and retrieval of games in the arcade.
 */
export class GameRegistry {
    constructor() {
        this.games = new Map();
    }

    /**
     * Registers a game class.
     * @param {class} GameClass - The class of the game to register (must extend BaseGame)
     */
    register(GameClass) {
        try {
            const manifest = GameClass.getManifest();
            if (!manifest || !manifest.id) {
                console.error("Game registration failed: Invalid manifest", GameClass);
                return;
            }

            if (this.games.has(manifest.id)) {
                console.warn(`Game with ID '${manifest.id}' is already registered. Overwriting.`);
            }

            this.games.set(manifest.id, {
                ...manifest,
                GameClass: GameClass
            });

            console.log(`Registered game: ${manifest.name} (${manifest.id})`);
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
