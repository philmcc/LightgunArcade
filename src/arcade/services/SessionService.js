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
     * Get users that the current user has recently played with
     * @param {number} limit - Max results
     * @returns {Promise<{players: Array, error: Error}>}
     */
    async getRecentlyPlayedWith(limit = 10) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { players: [], error: null };
        }

        if (!isSupabaseConfigured()) {
            return { players: [], error: new Error('Supabase not configured') };
        }

        try {
            // Get recent multiplayer sessions that include this user
            const { data: sessions, error } = await supabase
                .from('play_sessions')
                .select(`
                    id,
                    players,
                    started_at,
                    game_id,
                    games (name)
                `)
                .eq('is_multiplayer', true)
                .order('started_at', { ascending: false })
                .limit(50); // Get more sessions to find unique players

            if (error) {
                return { players: [], error };
            }

            // Extract unique players from sessions (excluding self)
            const playerMap = new Map();
            
            for (const session of sessions) {
                if (!session.players) continue;
                
                // Check if current user was in this session
                const userInSession = session.players.some(p => p.user_id === profile.id);
                if (!userInSession) continue;

                for (const player of session.players) {
                    // Skip self and guests
                    if (player.user_id === profile.id || player.user_id === 'guest' || player.is_guest) {
                        continue;
                    }

                    if (!playerMap.has(player.user_id)) {
                        playerMap.set(player.user_id, {
                            userId: player.user_id,
                            username: player.username,
                            lastPlayedAt: session.started_at,
                            lastGame: session.games?.name || session.game_id,
                            playCount: 1
                        });
                    } else {
                        playerMap.get(player.user_id).playCount++;
                    }
                }
            }

            // Get full profile info for these users
            const userIds = Array.from(playerMap.keys());
            if (userIds.length === 0) {
                return { players: [], error: null };
            }

            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url')
                .in('id', userIds);

            if (profileError) {
                // Return what we have from session data
                const players = Array.from(playerMap.values())
                    .sort((a, b) => new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt))
                    .slice(0, limit);
                return { players, error: null };
            }

            // Merge profile data
            const players = Array.from(playerMap.values())
                .map(p => {
                    const profile = profiles.find(pr => pr.id === p.userId);
                    return {
                        ...p,
                        id: p.userId,
                        username: profile?.username || p.username,
                        display_name: profile?.display_name,
                        avatar_url: profile?.avatar_url
                    };
                })
                .sort((a, b) => new Date(b.lastPlayedAt) - new Date(a.lastPlayedAt))
                .slice(0, limit);

            return { players, error: null };
        } catch (error) {
            return { players: [], error };
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
        if (!isSupabaseConfigured()) {
            return;
        }

        // Get all non-guest players from the session
        const players = this.currentSession?.players || [];
        const userIds = players
            .filter(p => p.user_id && p.user_id !== 'guest' && !p.is_guest)
            .map(p => p.user_id);
        
        // If no logged-in players, try the main auth user
        if (userIds.length === 0) {
            const profile = this.auth.getCurrentUser();
            if (profile && !profile.isGuest) {
                userIds.push(profile.id);
            }
        }
        
        // Update stats for each player
        for (const userId of userIds) {
            await this._updateStatsForUser(userId, durationSeconds);
        }
    }
    
    /**
     * Update stats for a specific user
     * @param {string} userId 
     * @param {number} durationSeconds 
     * @private
     */
    async _updateStatsForUser(userId, durationSeconds) {
        try {
            // Get current stats
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('stats')
                .eq('id', userId)
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
                    .eq('id', userId);
                    
                console.log(`Updated stats for user ${userId}: games=${newStats.total_games_played}, playtime=${newStats.total_playtime_seconds}s`);
            }
        } catch (e) {
            console.error(`Failed to update stats for user ${userId}:`, e);
        }
    }
}
