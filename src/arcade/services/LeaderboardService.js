import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * LeaderboardService - Manages game leaderboards
 * 
 * Handles:
 * - Global leaderboards per game/mode/difficulty
 * - Time-filtered leaderboards (daily, weekly, monthly, all-time)
 * - Friends-only leaderboards
 * - Personal rank and percentile
 */
export class LeaderboardService {
    constructor(authService) {
        this.auth = authService;
    }

    /**
     * Get leaderboard for a game
     * @param {string} gameId - Game identifier
     * @param {Object} options - Filter options
     * @param {string} options.mode - Game mode
     * @param {string} options.difficulty - Difficulty level
     * @param {string} options.timeFilter - 'all', 'daily', 'weekly', 'monthly'
     * @param {boolean} options.friendsOnly - Only show friends
     * @param {number} options.limit - Max results
     * @param {number} options.offset - Pagination offset
     * @returns {Promise<{entries: Array, total: number, error: Error}>}
     */
    async getLeaderboard(gameId, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            timeFilter = 'all',
            friendsOnly = false,
            limit = 50,
            offset = 0
        } = options;

        if (!isSupabaseConfigured()) {
            return this._getLocalLeaderboard(gameId, { mode, difficulty, limit });
        }

        try {
            let query = supabase
                .from('scores')
                .select(`
                    id,
                    score,
                    metadata,
                    created_at,
                    user_id,
                    profiles!inner (
                        username,
                        display_name,
                        avatar_url
                    )
                `, { count: 'exact' })
                .eq('game_id', gameId)
                .eq('mode', mode)
                .eq('difficulty', difficulty)
                .order('score', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply time filter
            if (timeFilter !== 'all') {
                const now = new Date();
                let startDate;

                switch (timeFilter) {
                    case 'daily':
                        startDate = new Date(now.setHours(0, 0, 0, 0));
                        break;
                    case 'weekly':
                        startDate = new Date(now.setDate(now.getDate() - 7));
                        break;
                    case 'monthly':
                        startDate = new Date(now.setMonth(now.getMonth() - 1));
                        break;
                }

                if (startDate) {
                    query = query.gte('created_at', startDate.toISOString());
                }
            }

            // Apply friends filter
            if (friendsOnly) {
                const friendIds = await this._getFriendIds();
                if (friendIds.length === 0) {
                    return { entries: [], total: 0, error: null };
                }
                query = query.in('user_id', friendIds);
            }

            const { data, count, error } = await query;

            if (error) {
                return { entries: [], total: 0, error };
            }

            // Format entries with rank
            const entries = data.map((entry, index) => ({
                rank: offset + index + 1,
                score: entry.score,
                metadata: entry.metadata,
                createdAt: entry.created_at,
                user: {
                    id: entry.user_id,
                    username: entry.profiles.username,
                    displayName: entry.profiles.display_name,
                    avatarUrl: entry.profiles.avatar_url
                }
            }));

            return { entries, total: count || 0, error: null };
        } catch (error) {
            return { entries: [], total: 0, error };
        }
    }

    /**
     * Get personal best leaderboard (one entry per user)
     * @param {string} gameId 
     * @param {Object} options 
     * @returns {Promise<{entries: Array, total: number, error: Error}>}
     */
    async getPersonalBestLeaderboard(gameId, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            friendsOnly = false,
            limit = 50,
            offset = 0
        } = options;

        if (!isSupabaseConfigured()) {
            return { entries: [], total: 0, error: new Error('Supabase not configured') };
        }

        try {
            let query = supabase
                .from('personal_bests')
                .select(`
                    id,
                    best_score,
                    attempts,
                    updated_at,
                    user_id,
                    profiles!inner (
                        username,
                        display_name,
                        avatar_url
                    )
                `, { count: 'exact' })
                .eq('game_id', gameId)
                .eq('mode', mode)
                .eq('difficulty', difficulty)
                .order('best_score', { ascending: false })
                .range(offset, offset + limit - 1);

            // Apply friends filter
            if (friendsOnly) {
                const friendIds = await this._getFriendIds();
                if (friendIds.length === 0) {
                    return { entries: [], total: 0, error: null };
                }
                query = query.in('user_id', friendIds);
            }

            const { data, count, error } = await query;

            if (error) {
                return { entries: [], total: 0, error };
            }

            // Format entries with rank
            const entries = data.map((entry, index) => ({
                rank: offset + index + 1,
                score: entry.best_score,
                attempts: entry.attempts,
                updatedAt: entry.updated_at,
                user: {
                    id: entry.user_id,
                    username: entry.profiles.username,
                    displayName: entry.profiles.display_name,
                    avatarUrl: entry.profiles.avatar_url
                }
            }));

            return { entries, total: count || 0, error: null };
        } catch (error) {
            return { entries: [], total: 0, error };
        }
    }

    /**
     * Get the current user's rank on a leaderboard
     * @param {string} gameId 
     * @param {Object} options 
     * @returns {Promise<{rank: number, percentile: number, totalPlayers: number, error: Error}>}
     */
    async getMyRank(gameId, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal'
        } = options;

        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { rank: null, percentile: null, totalPlayers: 0, error: null };
        }

        if (!isSupabaseConfigured()) {
            return { rank: null, percentile: null, totalPlayers: 0, error: new Error('Supabase not configured') };
        }

        try {
            // Get user's personal best
            const { data: myBest } = await supabase
                .from('personal_bests')
                .select('best_score')
                .eq('user_id', profile.id)
                .eq('game_id', gameId)
                .eq('mode', mode)
                .eq('difficulty', difficulty)
                .single();

            if (!myBest) {
                return { rank: null, percentile: null, totalPlayers: 0, error: null };
            }

            // Count players with higher scores
            const { count: higherCount } = await supabase
                .from('personal_bests')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', gameId)
                .eq('mode', mode)
                .eq('difficulty', difficulty)
                .gt('best_score', myBest.best_score);

            // Count total players
            const { count: totalCount } = await supabase
                .from('personal_bests')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', gameId)
                .eq('mode', mode)
                .eq('difficulty', difficulty);

            const rank = (higherCount || 0) + 1;
            const percentile = totalCount > 0 
                ? Math.round((1 - (rank - 1) / totalCount) * 100) 
                : 100;

            return {
                rank,
                percentile,
                totalPlayers: totalCount || 0,
                error: null
            };
        } catch (error) {
            return { rank: null, percentile: null, totalPlayers: 0, error };
        }
    }

    /**
     * Get entries around the current user's rank
     * @param {string} gameId 
     * @param {Object} options 
     * @param {number} options.surrounding - Number of entries above and below
     * @returns {Promise<{entries: Array, myRank: number, error: Error}>}
     */
    async getEntriesAroundMe(gameId, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            surrounding = 5
        } = options;

        const { rank, error: rankError } = await this.getMyRank(gameId, { mode, difficulty });
        
        if (rankError || !rank) {
            return { entries: [], myRank: null, error: rankError };
        }

        const offset = Math.max(0, rank - surrounding - 1);
        const limit = surrounding * 2 + 1;

        const { entries, error } = await this.getPersonalBestLeaderboard(gameId, {
            mode,
            difficulty,
            limit,
            offset
        });

        return { entries, myRank: rank, error };
    }

    /**
     * Get friend IDs for the current user
     * @private
     */
    async _getFriendIds() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return [];
        }

        const { data } = await supabase
            .from('friendships')
            .select('user_id, friend_id')
            .eq('status', 'accepted')
            .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

        if (!data) return [];

        // Extract friend IDs (the other user in each friendship)
        const friendIds = data.map(f => 
            f.user_id === profile.id ? f.friend_id : f.user_id
        );

        // Include self
        friendIds.push(profile.id);

        return friendIds;
    }

    /**
     * Get local leaderboard for guest users
     * @private
     */
    _getLocalLeaderboard(gameId, options) {
        const key = `lightgun_arcade_${gameId}_scores`;
        const scores = JSON.parse(localStorage.getItem(key) || '[]');

        // Filter by mode/difficulty
        const filtered = scores.filter(s => 
            s.mode === options.mode && s.difficulty === options.difficulty
        );

        // Sort and limit
        filtered.sort((a, b) => b.score - a.score);
        const entries = filtered.slice(0, options.limit).map((s, i) => ({
            rank: i + 1,
            score: s.score,
            metadata: s.metadata,
            createdAt: s.created_at,
            user: {
                id: 'guest',
                username: 'Guest',
                displayName: 'Guest',
                avatarUrl: null
            }
        }));

        return { entries, total: filtered.length, error: null };
    }

    /**
     * Subscribe to real-time leaderboard updates
     * @param {string} gameId 
     * @param {function} callback - Called with new score entries
     * @returns {function} Unsubscribe function
     */
    subscribeToLeaderboard(gameId, callback) {
        if (!isSupabaseConfigured()) {
            return () => {};
        }

        const channel = supabase
            .channel(`leaderboard:${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'scores',
                    filter: `game_id=eq.${gameId}`
                },
                async (payload) => {
                    // Fetch the full entry with profile
                    const { data } = await supabase
                        .from('scores')
                        .select(`
                            id,
                            score,
                            metadata,
                            created_at,
                            user_id,
                            profiles (
                                username,
                                display_name,
                                avatar_url
                            )
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        callback({
                            score: data.score,
                            metadata: data.metadata,
                            createdAt: data.created_at,
                            user: {
                                id: data.user_id,
                                username: data.profiles.username,
                                displayName: data.profiles.display_name,
                                avatarUrl: data.profiles.avatar_url
                            }
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
}
