/**
 * GameServices - Central service hub for games
 * 
 * Provides a unified interface for games to interact with:
 * - Score submission (local + online)
 * - Session tracking
 * - Leaderboards
 * - Activity posting
 * - User stats
 * 
 * Games access this through BaseGame.services
 */
export class GameServices {
    constructor(system) {
        this.system = system;
        this._currentSession = null;
        
        // Expose underlying services for direct access when needed
        this.scores = system.scores;
        this.sessions = system.sessions;
        this.leaderboards = system.leaderboards;
        this.activity = system.activity;
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    /**
     * Start a game session. Call this when gameplay begins.
     * @param {string} gameId - Game identifier
     * @param {Object} options
     * @param {string} options.mode - Game mode (e.g., 'arcade', 'survival')
     * @param {string} options.difficulty - Difficulty level
     * @param {Array} options.players - Player info for multiplayer
     * @returns {Promise<Object>} Session object
     */
    async startSession(gameId, options = {}) {
        const { session } = await this.system.sessions.startSession(gameId, options);
        this._currentSession = session;
        return session;
    }

    /**
     * End the current game session. Call this when gameplay ends.
     * @param {Object} results
     * @param {Array} results.playerResults - [{score, stats}] per player
     * @returns {Promise<Object>} Completed session object
     */
    async endSession(results = {}) {
        if (!this._currentSession) {
            console.warn('No active session to end');
            return null;
        }

        const { session } = await this.system.sessions.endSession(results);
        this._currentSession = null;
        return session;
    }

    /**
     * Get the current active session
     * @returns {Object|null}
     */
    getCurrentSession() {
        return this._currentSession;
    }

    // =========================================================================
    // SCORE SUBMISSION
    // =========================================================================

    /**
     * Submit a score. Handles both local and online submission.
     * Also posts to activity feed if it's a personal best.
     * 
     * @param {string} gameId - Game identifier
     * @param {number} score - Score value
     * @param {Object} options
     * @param {string} options.mode - Game mode
     * @param {string} options.difficulty - Difficulty level
     * @param {Object} options.metadata - Additional data (accuracy, combos, etc.)
     * @param {string} options.playerName - Player name for local scores
     * @returns {Promise<{score: Object, isPersonalBest: boolean, rank: number|null}>}
     */
    async submitScore(gameId, score, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            metadata = {},
            playerName = null
        } = options;

        // Submit to online service
        const result = await this.system.scores.submitScore(gameId, score, {
            mode,
            difficulty,
            metadata
        });

        // Also save to local high scores (for offline display)
        const user = this.system.auth.getCurrentUser();
        const name = playerName || user?.display_name || user?.username || 'Guest';
        this.system.globalHighScores.addScore(gameId, name, score, difficulty);

        // Post to activity feed if personal best
        if (result.isPersonalBest && !this.system.auth.isGuest()) {
            await this.system.activity.postScoreActivity(
                gameId,
                score,
                { mode, difficulty, ...metadata },
                true // isPersonalBest
            );
        }

        return result;
    }

    /**
     * Submit scores for multiple players (multiplayer game end)
     * Handles both logged-in users and guests properly.
     * 
     * @param {string} gameId 
     * @param {Array} players - Player objects from PlayerManager with user info
     * @param {Object} options
     * @param {string} options.mode - Game mode (default: 'arcade')
     * @param {string} options.difficulty - Difficulty level
     * @param {string} options.gameMode - Multiplayer mode (versus/coop)
     * @returns {Promise<Array>} Results for each player
     */
    async submitMultiplayerScores(gameId, players, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            gameMode = 'versus'
        } = options;
        
        const results = [];

        for (let rank = 0; rank < players.length; rank++) {
            const player = players[rank];
            const playerName = player.user?.display_name || player.user?.username || player.name;
            const score = player.score;
            
            if (score <= 0) continue;
            
            // Save to local high scores
            this.system.globalHighScores.addScore(gameId, playerName, score, difficulty);
            
            // Submit online score if player is logged in
            if (player.user && !player.user.isGuest && player.isLoggedIn) {
                try {
                    const result = await this.scores.submitScoreForUser(gameId, player.user, score, {
                        mode,
                        difficulty,
                        metadata: {
                            hits: player.hits || 0,
                            accuracy: player.accuracy || 0,
                            multiplayer: true,
                            gameMode,
                            rank: rank + 1,
                            playerCount: players.length
                        }
                    });
                    
                    // Update player stats
                    await this.scores.updateUserStats(player.user, {
                        hits: player.hits || 0,
                        shots: player.stats?.totalShots || 0
                    });

                    // Post to activity feed if personal best
                    if (result.isPersonalBest) {
                        await this.system.activity.postScoreActivity(
                            gameId,
                            score,
                            { mode, difficulty, multiplayer: true, gameMode, rank: rank + 1 },
                            true // isPersonalBest
                        );
                    }
                    
                    results.push({ 
                        playerIndex: player.index, 
                        playerName,
                        score,
                        ...result 
                    });
                } catch (e) {
                    console.warn(`Failed to submit score for ${playerName}:`, e);
                    results.push({ 
                        playerIndex: player.index, 
                        playerName,
                        score,
                        error: e 
                    });
                }
            } else {
                // Guest player - local score only
                results.push({ 
                    playerIndex: player.index, 
                    playerName,
                    score,
                    isGuest: true 
                });
            }
        }
        
        console.log(`Submitted scores for ${results.length} players`);
        return results;
    }

    // =========================================================================
    // LEADERBOARDS
    // =========================================================================

    /**
     * Get leaderboard for a game
     * @param {string} gameId 
     * @param {Object} options
     * @param {string} options.mode
     * @param {string} options.difficulty
     * @param {string} options.timeFilter - 'daily', 'weekly', 'monthly', 'all'
     * @param {number} options.limit
     * @returns {Promise<{entries: Array, total: number}>}
     */
    async getLeaderboard(gameId, options = {}) {
        return this.system.leaderboards.getLeaderboard(gameId, options);
    }

    /**
     * Get the current user's rank on a leaderboard
     * @param {string} gameId 
     * @param {Object} options - mode, difficulty
     * @returns {Promise<{rank: number, percentile: number, score: number}>}
     */
    async getMyRank(gameId, options = {}) {
        return this.system.leaderboards.getMyRank(gameId, options);
    }

    /**
     * Get friends leaderboard
     * @param {string} gameId 
     * @param {Object} options
     * @returns {Promise<{entries: Array}>}
     */
    async getFriendsLeaderboard(gameId, options = {}) {
        return this.system.leaderboards.getFriendsLeaderboard(gameId, options);
    }

    // =========================================================================
    // USER INFO
    // =========================================================================

    /**
     * Get the current user
     * @returns {Object} User profile
     */
    getCurrentUser() {
        return this.system.auth.getCurrentUser();
    }

    /**
     * Check if current user is a guest
     * @returns {boolean}
     */
    isGuest() {
        return this.system.auth.isGuest();
    }

    /**
     * Check if user is authenticated (not guest)
     * @returns {boolean}
     */
    isAuthenticated() {
        return !this.system.auth.isGuest();
    }

    // =========================================================================
    // STATS
    // =========================================================================

    /**
     * Get user stats for a specific game
     * @param {string} gameId 
     * @returns {Promise<Object>} Game-specific stats
     */
    async getGameStats(gameId) {
        return this.system.stats.getGameStats(gameId);
    }

    /**
     * Get personal best for a game/mode/difficulty
     * @param {string} gameId 
     * @param {string} mode 
     * @param {string} difficulty 
     * @returns {Promise<Object>}
     */
    async getPersonalBest(gameId, mode = 'arcade', difficulty = 'normal') {
        return this.system.scores.getPersonalBest(gameId, mode, difficulty);
    }

    // =========================================================================
    // ACTIVITY
    // =========================================================================

    /**
     * Post a game-related activity
     * @param {string} type - Activity type
     * @param {Object} data - Activity data
     */
    async postActivity(type, data) {
        if (this.isGuest()) return;
        
        return this.system.activity.postActivity(type, data);
    }

    // =========================================================================
    // CONVENIENCE METHODS
    // =========================================================================

    /**
     * Complete game flow: end session and submit score
     * Call this when a game ends to handle everything at once.
     * 
     * @param {string} gameId 
     * @param {number} score 
     * @param {Object} options
     * @param {string} options.mode
     * @param {string} options.difficulty
     * @param {Object} options.metadata
     * @param {string} options.playerName
     * @returns {Promise<{session: Object, scoreResult: Object}>}
     */
    async completeGame(gameId, score, options = {}) {
        // End session
        const session = await this.endSession({
            playerResults: [{ score, stats: options.metadata }]
        });

        // Submit score
        const scoreResult = await this.submitScore(gameId, score, options);

        return { session, scoreResult };
    }

    /**
     * Complete multiplayer game flow
     * @param {string} gameId 
     * @param {Array} playerScores - [{playerIndex, score, name, metadata}]
     * @param {Object} options - mode, difficulty
     * @returns {Promise<{session: Object, scoreResults: Array}>}
     */
    async completeMultiplayerGame(gameId, playerScores, options = {}) {
        // End session with all player results
        const session = await this.endSession({
            playerResults: playerScores.map(ps => ({
                score: ps.score,
                stats: ps.metadata
            }))
        });

        // Submit all scores
        const scoreResults = await this.submitMultiplayerScores(gameId, playerScores, options);

        return { session, scoreResults };
    }
}
