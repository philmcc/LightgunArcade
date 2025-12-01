/**
 * PlayerManager - Manages players in multiplayer sessions
 * 
 * Handles:
 * - Player registration and assignment
 * - Per-player state (score, lives, etc.)
 * - Player colors and visual identification
 * - Turn management for turn-based modes
 */

export class PlayerManager {
    /**
     * Player colors for visual identification
     */
    static PLAYER_COLORS = [
        { primary: '#ff4444', secondary: '#ff8888', name: 'Red' },    // Player 1
        { primary: '#4444ff', secondary: '#8888ff', name: 'Blue' },   // Player 2
        { primary: '#44ff44', secondary: '#88ff88', name: 'Green' },  // Player 3
        { primary: '#ffff44', secondary: '#ffff88', name: 'Yellow' }  // Player 4
    ];

    constructor() {
        this.players = [];
        this.maxPlayers = 4;
        this.activePlayerCount = 0;
        this.currentPlayerIndex = 0; // For turn-based modes
        
        // Game mode settings
        this.gameMode = 'single'; // 'single', 'coop', 'versus', 'turns'
        this.isSimultaneous = true; // All players play at once vs turn-based
    }

    /**
     * Initialize players for a game session
     * @param {number} playerCount - Number of players (1-4)
     * @param {Object} options - Configuration options
     * @param {string} options.mode - Game mode ('coop', 'versus', 'turns')
     * @param {boolean} options.simultaneous - Whether players play simultaneously
     * @param {Array} options.gunAssignments - Gun indices assigned to each player
     * @param {Array} options.playerUsers - User objects for each player slot (from LocalPlayersManager)
     */
    initSession(playerCount, options = {}) {
        const {
            mode = playerCount > 1 ? 'coop' : 'single',
            simultaneous = true,
            gunAssignments = null,
            playerUsers = null
        } = options;

        this.gameMode = mode;
        this.isSimultaneous = simultaneous;
        this.players = [];
        this.currentPlayerIndex = 0;

        for (let i = 0; i < playerCount; i++) {
            const gunIndex = gunAssignments ? gunAssignments[i] : i;
            const userData = playerUsers ? playerUsers[i] : null;
            this.players.push(this._createPlayer(i, gunIndex, userData));
        }

        this.activePlayerCount = playerCount;
        console.log(`PlayerManager: Initialized ${playerCount} player(s) in ${mode} mode`);
        
        return this.players;
    }

    /**
     * Create a player object
     * @private
     * @param {number} index - Player index
     * @param {number} gunIndex - Gun index assigned to this player
     * @param {Object} userData - User data from LocalPlayersManager (optional)
     */
    _createPlayer(index, gunIndex, userData = null) {
        const colors = PlayerManager.PLAYER_COLORS[index] || PlayerManager.PLAYER_COLORS[0];
        
        // Determine player name from user data or fallback
        const name = userData?.display_name || userData?.username || `Player ${index + 1}`;
        const isLoggedIn = userData && !userData.isGuest;
        
        return {
            index,
            gunIndex,
            name,
            colors,
            
            // User account info (for score submission)
            user: userData || null,
            isLoggedIn,
            
            // Game state (reset per game)
            score: 0,
            lives: 3,
            hits: 0,
            misses: 0,
            accuracy: 0,
            
            // Session state
            isActive: true,
            isEliminated: false,
            
            // Stats tracking
            stats: {
                totalShots: 0,
                totalHits: 0,
                streak: 0,
                maxStreak: 0,
                bonusPoints: 0
            }
        };
    }

    /**
     * Reset all players for a new game
     * @param {number} lives - Starting lives for each player
     */
    resetGame(lives = 3) {
        this.players.forEach(player => {
            player.score = 0;
            player.lives = lives;
            player.hits = 0;
            player.misses = 0;
            player.accuracy = 0;
            player.isActive = true;
            player.isEliminated = false;
            player.stats = {
                totalShots: 0,
                totalHits: 0,
                streak: 0,
                maxStreak: 0,
                bonusPoints: 0
            };
        });
        this.currentPlayerIndex = 0;
    }

    /**
     * Get player by index
     * @param {number} index - Player index
     * @returns {Object|null}
     */
    getPlayer(index) {
        return this.players[index] || null;
    }

    /**
     * Get player by gun index
     * @param {number} gunIndex - Gun index
     * @returns {Object|null}
     */
    getPlayerByGun(gunIndex) {
        return this.players.find(p => p.gunIndex === gunIndex) || null;
    }

    /**
     * Get all active (non-eliminated) players
     * @returns {Array}
     */
    getActivePlayers() {
        return this.players.filter(p => p.isActive && !p.isEliminated);
    }

    /**
     * Get current player (for turn-based modes)
     * @returns {Object|null}
     */
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex] || null;
    }

    /**
     * Advance to next player's turn
     * @returns {Object} Next player
     */
    nextTurn() {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length === 0) return null;

        // Find next active player
        let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
        while (!this.players[nextIndex].isActive || this.players[nextIndex].isEliminated) {
            nextIndex = (nextIndex + 1) % this.players.length;
            if (nextIndex === this.currentPlayerIndex) break; // Prevent infinite loop
        }

        this.currentPlayerIndex = nextIndex;
        return this.getCurrentPlayer();
    }

    /**
     * Add score to a player
     * @param {number} playerIndex - Player index
     * @param {number} points - Points to add
     * @returns {number} New total score
     */
    addScore(playerIndex, points) {
        const player = this.getPlayer(playerIndex);
        if (!player) return 0;
        
        player.score += points;
        return player.score;
    }

    /**
     * Record a hit for a player
     * @param {number} playerIndex - Player index
     * @param {number} points - Points for this hit
     */
    recordHit(playerIndex, points = 0) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        player.hits++;
        player.stats.totalHits++;
        player.stats.totalShots++;
        player.stats.streak++;
        
        if (player.stats.streak > player.stats.maxStreak) {
            player.stats.maxStreak = player.stats.streak;
        }

        if (points > 0) {
            player.score += points;
        }

        this._updateAccuracy(player);
    }

    /**
     * Record a miss for a player
     * @param {number} playerIndex - Player index
     */
    recordMiss(playerIndex) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        player.misses++;
        player.stats.totalShots++;
        player.stats.streak = 0;

        this._updateAccuracy(player);
    }

    /**
     * Lose a life for a player
     * @param {number} playerIndex - Player index
     * @returns {boolean} True if player is now eliminated
     */
    loseLife(playerIndex) {
        const player = this.getPlayer(playerIndex);
        if (!player) return false;

        player.lives--;
        
        if (player.lives <= 0) {
            player.lives = 0;
            player.isEliminated = true;
            return true;
        }
        
        return false;
    }

    /**
     * Add a life to a player
     * @param {number} playerIndex - Player index
     * @param {number} maxLives - Maximum lives allowed
     */
    addLife(playerIndex, maxLives = 9) {
        const player = this.getPlayer(playerIndex);
        if (!player) return;

        player.lives = Math.min(player.lives + 1, maxLives);
    }

    /**
     * Update accuracy calculation
     * @private
     */
    _updateAccuracy(player) {
        if (player.stats.totalShots > 0) {
            player.accuracy = Math.round((player.stats.totalHits / player.stats.totalShots) * 100);
        }
    }

    /**
     * Check if game is over (all players eliminated in coop, or winner determined in versus)
     * @returns {Object} { isOver: boolean, winner: player|null, reason: string }
     */
    checkGameOver() {
        const activePlayers = this.getActivePlayers();

        if (this.gameMode === 'coop' || this.gameMode === 'single') {
            // Game over when all players are eliminated
            if (activePlayers.length === 0) {
                return { isOver: true, winner: null, reason: 'eliminated' };
            }
        } else if (this.gameMode === 'versus') {
            // Game over when only one player remains
            if (activePlayers.length === 1) {
                return { isOver: true, winner: activePlayers[0], reason: 'last_standing' };
            }
            if (activePlayers.length === 0) {
                // Tie - both eliminated at same time
                return { isOver: true, winner: null, reason: 'tie' };
            }
        }

        return { isOver: false, winner: null, reason: null };
    }

    /**
     * Get final results sorted by score
     * @returns {Array} Players sorted by score (highest first)
     */
    getFinalResults() {
        return [...this.players].sort((a, b) => b.score - a.score);
    }

    /**
     * Get combined team score (for coop mode)
     * @returns {number}
     */
    getTeamScore() {
        return this.players.reduce((sum, p) => sum + p.score, 0);
    }

    /**
     * Get combined team stats (for coop mode)
     * @returns {Object}
     */
    getTeamStats() {
        return {
            totalScore: this.getTeamScore(),
            totalHits: this.players.reduce((sum, p) => sum + p.hits, 0),
            totalMisses: this.players.reduce((sum, p) => sum + p.misses, 0),
            totalShots: this.players.reduce((sum, p) => sum + p.stats.totalShots, 0),
            accuracy: this._calculateTeamAccuracy()
        };
    }

    /**
     * Calculate team accuracy
     * @private
     */
    _calculateTeamAccuracy() {
        const totalShots = this.players.reduce((sum, p) => sum + p.stats.totalShots, 0);
        const totalHits = this.players.reduce((sum, p) => sum + p.stats.totalHits, 0);
        
        if (totalShots === 0) return 0;
        return Math.round((totalHits / totalShots) * 100);
    }

    /**
     * Check if this is a multiplayer session
     * @returns {boolean}
     */
    isMultiplayer() {
        return this.players.length > 1;
    }

    /**
     * Check if playing cooperatively
     * @returns {boolean}
     */
    isCooperative() {
        return this.gameMode === 'coop';
    }

    /**
     * Check if playing competitively
     * @returns {boolean}
     */
    isCompetitive() {
        return this.gameMode === 'versus';
    }

    /**
     * Serialize player data for saving
     * @returns {Object}
     */
    toJSON() {
        return {
            players: this.players.map(p => ({
                index: p.index,
                name: p.name,
                score: p.score,
                lives: p.lives,
                hits: p.hits,
                misses: p.misses,
                accuracy: p.accuracy,
                stats: { ...p.stats }
            })),
            gameMode: this.gameMode,
            isSimultaneous: this.isSimultaneous
        };
    }
}
