/**
 * Per-game high score manager provided by the SDK.
 * Each game instance gets its own GameHighScores with isolated storage.
 */
export class GameHighScores {
    /**
     * @param {string} gameId - Unique game identifier from manifest
     */
    constructor(gameId) {
        this.gameId = gameId;
        this.storageKey = `lightgun_arcade_${gameId}_scores`;
        this.maxScores = 10;
    }

    /**
     * Load scores from localStorage.
     * @returns {Array} Array of score objects
     */
    load() {
        const saved = localStorage.getItem(this.storageKey);
        return saved ? JSON.parse(saved) : [];
    }

    /**
     * Save scores to localStorage.
     * @param {Array} scores - Array of score objects
     */
    save(scores) {
        localStorage.setItem(this.storageKey, JSON.stringify(scores));
    }

    /**
     * Add a new score.
     * @param {string} name - Player name (max 10 chars)
     * @param {number} score - Score value
     * @param {string} difficulty - Difficulty level
     * @param {string} [mode] - Optional game mode (e.g., 'campaign', 'endless')
     * @returns {Array} Updated scores array
     */
    addScore(name, score, difficulty, mode = null) {
        const scores = this.load();
        
        const entry = {
            name: name.substring(0, 10),
            score: score,
            difficulty: difficulty,
            date: new Date().toISOString()
        };

        if (mode) {
            entry.gameMode = mode;
        }

        scores.push(entry);

        // Sort by score descending
        scores.sort((a, b) => b.score - a.score);

        // Keep only top scores
        const trimmed = scores.slice(0, this.maxScores);
        this.save(trimmed);

        return trimmed;
    }

    /**
     * Check if a score qualifies as a high score.
     * @param {number} score - Score to check
     * @returns {boolean} True if score would make the leaderboard
     */
    isHighScore(score) {
        const scores = this.load();
        if (scores.length < this.maxScores) return true;
        return score > scores[scores.length - 1].score;
    }

    /**
     * Get all scores.
     * @returns {Array} Array of score objects sorted by score descending
     */
    getScores() {
        return this.load();
    }

    /**
     * Get scores filtered by difficulty.
     * @param {string} difficulty - Difficulty to filter by
     * @returns {Array} Filtered scores
     */
    getScoresByDifficulty(difficulty) {
        return this.load().filter(s => s.difficulty === difficulty);
    }

    /**
     * Get scores filtered by game mode.
     * @param {string} mode - Game mode to filter by
     * @returns {Array} Filtered scores
     */
    getScoresByMode(mode) {
        return this.load().filter(s => s.gameMode === mode);
    }

    /**
     * Clear all scores for this game.
     */
    clearScores() {
        this.save([]);
    }
}
