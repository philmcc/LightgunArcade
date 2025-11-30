import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * SessionService - Tracks game play sessions
 * 
 * Handles:
 * - Session start/end tracking
 * - Duration calculation
 * - Multiplayer session tracking
 * - Play history
 */
export class SessionService {
    constructor(authService) {
        this.auth = authService;
        this.currentSession = null;
    }

    /**
     * Start a new play session
     * @param {string} gameId 
     * @param {Object} options 
     * @param {string} options.mode - Game mode
     * @param {string} options.difficulty - Difficulty level
     * @param {Array} options.players - Array of player info [{userId, isGuest}]
     * @returns {Promise<{session: Object, error: Error}>}
     */
    async startSession(gameId, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            players = []
        } = options;

        const profile = this.auth.getCurrentUser();
        
        // Build players array
        const sessionPlayers = players.length > 0 ? players : [{
            user_id: profile?.id || 'guest',
            is_guest: profile?.isGuest || true,
            username: profile?.username || 'Guest'
        }];

        const isMultiplayer = sessionPlayers.length > 1;

        // Create local session object
        this.currentSession = {
            game_id: gameId,
            mode,
            difficulty,
            players: sessionPlayers,
            is_multiplayer: isMultiplayer,
            started_at: new Date().toISOString(),
            ended_at: null,
            duration_seconds: null
        };

        // If authenticated and online, create in database
        if (profile && !profile.isGuest && isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('play_sessions')
                    .insert({
                        game_id: gameId,
                        mode,
                        difficulty,
                        players: sessionPlayers,
                        is_multiplayer: isMultiplayer,
                        started_at: this.currentSession.started_at
                    })
                    .select()
                    .single();

                if (!error && data) {
                    this.currentSession.id = data.id;
                }
            } catch (e) {
                console.error('Failed to create session in database:', e);
            }
        }

        // Increment game play count
        this._incrementGamePlayCount(gameId);

        return { session: this.currentSession, error: null };
    }

    /**
     * End the current play session
     * @param {Object} results - Session results
     * @param {Array} results.playerResults - [{userId, score, stats}]
     * @returns {Promise<{session: Object, error: Error}>}
     */
    async endSession(results = {}) {
        if (!this.currentSession) {
            return { session: null, error: new Error('No active session') };
        }

        const endedAt = new Date();
        const startedAt = new Date(this.currentSession.started_at);
        const durationSeconds = Math.round((endedAt - startedAt) / 1000);

        // Update session with results
        this.currentSession.ended_at = endedAt.toISOString();
        this.currentSession.duration_seconds = durationSeconds;

        // Merge player results
        if (results.playerResults) {
            this.currentSession.players = this.currentSession.players.map((p, i) => ({
                ...p,
                ...(results.playerResults[i] || {})
            }));
        }

        // Update in database if we have an ID
        if (this.currentSession.id && isSupabaseConfigured()) {
            try {
                await supabase
                    .from('play_sessions')
                    .update({
                        ended_at: this.currentSession.ended_at,
                        duration_seconds: durationSeconds,
                        players: this.currentSession.players
                    })
                    .eq('id', this.currentSession.id);
            } catch (e) {
                console.error('Failed to update session in database:', e);
            }
        }

        // Update user stats
        await this._updateUserStats(durationSeconds);

        const session = { ...this.currentSession };
        this.currentSession = null;

        return { session, error: null };
    }

    /**
     * Get the current active session
     * @returns {Object|null}
     */
    getCurrentSession() {
        return this.currentSession;
    }

    /**
     * Get play history for a user
     * @param {string} userId - Optional, defaults to current user
     * @param {Object} options 
     * @param {number} options.limit 
     * @param {number} options.offset 
     * @param {string} options.gameId - Filter by game
     * @returns {Promise<{sessions: Array, error: Error}>}
     */
    async getPlayHistory(userId = null, options = {}) {
        const {
            limit = 20,
            offset = 0,
            gameId = null
        } = options;

        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId || profile?.isGuest) {
            return { sessions: [], error: null };
        }

        if (!isSupabaseConfigured()) {
            return { sessions: [], error: new Error('Supabase not configured') };
        }

        try {
            let query = supabase
                .from('play_sessions')
                .select(`
                    id,
                    game_id,
                    mode,
                    difficulty,
                    duration_seconds,
                    players,
                    is_multiplayer,
                    started_at,
                    ended_at,
                    games (name)
                `)
                .contains('players', [{ user_id: targetId }])
                .order('started_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (gameId) {
                query = query.eq('game_id', gameId);
            }

            const { data, error } = await query;

            if (error) {
                return { sessions: [], error };
            }

            const sessions = data.map(s => ({
                id: s.id,
                gameId: s.game_id,
                gameName: s.games?.name,
                mode: s.mode,
                difficulty: s.difficulty,
                durationSeconds: s.duration_seconds,
                players: s.players,
                isMultiplayer: s.is_multiplayer,
                startedAt: s.started_at,
                endedAt: s.ended_at
            }));

            return { sessions, error: null };
        } catch (error) {
            return { sessions: [], error };
        }
    }

    /**
     * Get total playtime for a user
     * @param {string} userId - Optional, defaults to current user
     * @param {string} gameId - Optional, filter by game
     * @returns {Promise<{totalSeconds: number, error: Error}>}
     */
    async getTotalPlaytime(userId = null, gameId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId || profile?.isGuest) {
            return { totalSeconds: 0, error: null };
        }

        if (!isSupabaseConfigured()) {
            return { totalSeconds: 0, error: new Error('Supabase not configured') };
        }

        try {
            let query = supabase
                .from('play_sessions')
                .select('duration_seconds')
                .contains('players', [{ user_id: targetId }])
                .not('duration_seconds', 'is', null);

            if (gameId) {
                query = query.eq('game_id', gameId);
            }

            const { data, error } = await query;

            if (error) {
                return { totalSeconds: 0, error };
            }

            const totalSeconds = data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

            return { totalSeconds, error: null };
        } catch (error) {
            return { totalSeconds: 0, error };
        }
    }

    /**
     * Get games played by a user
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{games: Array, error: Error}>}
     */
    async getGamesPlayed(userId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId || profile?.isGuest) {
            return { games: [], error: null };
        }

        if (!isSupabaseConfigured()) {
            return { games: [], error: new Error('Supabase not configured') };
        }

        try {
            const { data, error } = await supabase
                .from('play_sessions')
                .select(`
                    game_id,
                    games (name),
                    duration_seconds
                `)
                .contains('players', [{ user_id: targetId }]);

            if (error) {
                return { games: [], error };
            }

            // Aggregate by game
            const gameMap = new Map();
            data.forEach(s => {
                if (!gameMap.has(s.game_id)) {
                    gameMap.set(s.game_id, {
                        gameId: s.game_id,
                        gameName: s.games?.name,
                        playCount: 0,
                        totalPlaytime: 0
                    });
                }
                const game = gameMap.get(s.game_id);
                game.playCount++;
                game.totalPlaytime += s.duration_seconds || 0;
            });

            const games = Array.from(gameMap.values())
                .sort((a, b) => b.playCount - a.playCount);

            return { games, error: null };
        } catch (error) {
            return { games: [], error };
        }
    }

    /**
     * Increment game play count
     * @private
     */
    async _incrementGamePlayCount(gameId) {
        if (!isSupabaseConfigured()) return;

        try {
            await supabase.rpc('increment_game_play_count', { game_id: gameId });
        } catch (e) {
            // Fallback: direct update (less safe but works without RPC)
            try {
                const { data } = await supabase
                    .from('games')
                    .select('play_count')
                    .eq('id', gameId)
                    .single();

                if (data) {
                    await supabase
                        .from('games')
                        .update({ play_count: (data.play_count || 0) + 1 })
                        .eq('id', gameId);
                }
            } catch (e2) {
                console.error('Failed to increment play count:', e2);
            }
        }
    }

    /**
     * Update user stats after session ends
     * @private
     */
    async _updateUserStats(durationSeconds) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !isSupabaseConfigured()) {
            return;
        }

        try {
            // Get current stats
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('stats')
                .eq('id', profile.id)
                .single();

            if (currentProfile) {
                const stats = currentProfile.stats || {};
                const newStats = {
                    ...stats,
                    total_games_played: (stats.total_games_played || 0) + 1,
                    total_playtime_seconds: (stats.total_playtime_seconds || 0) + durationSeconds
                };

                await supabase
                    .from('profiles')
                    .update({ 
                        stats: newStats,
                        last_active: new Date().toISOString()
                    })
                    .eq('id', profile.id);
            }
        } catch (e) {
            console.error('Failed to update user stats:', e);
        }
    }
}
