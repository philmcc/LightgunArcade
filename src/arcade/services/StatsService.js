import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * StatsService - Aggregates and provides user statistics
 * 
 * Provides:
 * - Overall user statistics
 * - Per-game statistics
 * - Score progression over time
 * - Accuracy trends
 * - Comparison with friends
 */
export class StatsService {
    constructor(authService) {
        this.auth = authService;
    }

    /**
     * Get comprehensive stats for a user
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{stats: Object, error: Error}>}
     */
    async getUserStats(userId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { stats: null, error: new Error('No user specified') };
        }

        if (profile?.isGuest && !userId) {
            return this._getLocalStats();
        }

        if (!isSupabaseConfigured()) {
            return { stats: null, error: new Error('Supabase not configured') };
        }

        try {
            // Get profile stats
            const { data: profileData } = await supabase
                .from('profiles')
                .select('stats, created_at')
                .eq('id', targetId)
                .single();

            // Get score stats
            const { data: scores } = await supabase
                .from('scores')
                .select('score, metadata, created_at, game_id')
                .eq('user_id', targetId);

            // Get personal bests count
            const { count: pbCount } = await supabase
                .from('personal_bests')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', targetId);

            // Get friend count
            const { count: friendCount } = await supabase
                .from('friendships')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'accepted')
                .or(`user_id.eq.${targetId},friend_id.eq.${targetId}`);

            // Calculate derived stats
            const totalScores = scores?.length || 0;
            const totalPoints = scores?.reduce((sum, s) => sum + s.score, 0) || 0;
            const avgScore = totalScores > 0 ? Math.round(totalPoints / totalScores) : 0;

            // Calculate accuracy if available in metadata
            let totalShots = 0;
            let totalHits = 0;
            scores?.forEach(s => {
                if (s.metadata?.shots) totalShots += s.metadata.shots;
                if (s.metadata?.hits) totalHits += s.metadata.hits;
            });
            const overallAccuracy = totalShots > 0 
                ? Math.round((totalHits / totalShots) * 100) 
                : null;

            // Get unique games played
            const uniqueGames = new Set(scores?.map(s => s.game_id) || []);

            // Get best score
            const bestScore = scores?.length > 0 
                ? Math.max(...scores.map(s => s.score))
                : 0;

            const stats = {
                // From profile
                totalGamesPlayed: profileData?.stats?.total_games_played || 0,
                totalPlaytimeSeconds: profileData?.stats?.total_playtime_seconds || 0,
                memberSince: profileData?.created_at,

                // Calculated
                totalScoresSubmitted: totalScores,
                totalPointsEarned: totalPoints,
                averageScore: avgScore,
                bestScore,
                personalBests: pbCount || 0,
                uniqueGamesPlayed: uniqueGames.size,
                friendCount: friendCount || 0,

                // Accuracy (if available)
                overallAccuracy,
                totalShots,
                totalHits
            };

            return { stats, error: null };
        } catch (error) {
            return { stats: null, error };
        }
    }

    /**
     * Get stats for a specific game
     * @param {string} gameId 
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{stats: Object, error: Error}>}
     */
    async getGameStats(gameId, userId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { stats: null, error: new Error('No user specified') };
        }

        if (!isSupabaseConfigured()) {
            return { stats: null, error: new Error('Supabase not configured') };
        }

        try {
            // Get all scores for this game
            const { data: scores } = await supabase
                .from('scores')
                .select('score, mode, difficulty, metadata, created_at')
                .eq('user_id', targetId)
                .eq('game_id', gameId)
                .order('created_at', { ascending: true });

            // Get personal bests for this game
            const { data: personalBests } = await supabase
                .from('personal_bests')
                .select('mode, difficulty, best_score, attempts')
                .eq('user_id', targetId)
                .eq('game_id', gameId);

            if (!scores || scores.length === 0) {
                return {
                    stats: {
                        gamesPlayed: 0,
                        bestScore: 0,
                        averageScore: 0,
                        personalBests: [],
                        scoreHistory: [],
                        accuracyHistory: []
                    },
                    error: null
                };
            }

            // Calculate stats
            const totalScores = scores.length;
            const totalPoints = scores.reduce((sum, s) => sum + s.score, 0);
            const avgScore = Math.round(totalPoints / totalScores);
            const bestScore = Math.max(...scores.map(s => s.score));

            // Score history (last 20)
            const scoreHistory = scores.slice(-20).map(s => ({
                score: s.score,
                date: s.created_at,
                mode: s.mode,
                difficulty: s.difficulty
            }));

            // Accuracy history
            const accuracyHistory = scores
                .filter(s => s.metadata?.shots && s.metadata?.hits)
                .slice(-20)
                .map(s => ({
                    accuracy: Math.round((s.metadata.hits / s.metadata.shots) * 100),
                    date: s.created_at
                }));

            // Mode breakdown
            const modeBreakdown = {};
            scores.forEach(s => {
                const key = `${s.mode}_${s.difficulty}`;
                if (!modeBreakdown[key]) {
                    modeBreakdown[key] = {
                        mode: s.mode,
                        difficulty: s.difficulty,
                        count: 0,
                        totalScore: 0,
                        bestScore: 0
                    };
                }
                modeBreakdown[key].count++;
                modeBreakdown[key].totalScore += s.score;
                modeBreakdown[key].bestScore = Math.max(modeBreakdown[key].bestScore, s.score);
            });

            const stats = {
                gamesPlayed: totalScores,
                bestScore,
                averageScore: avgScore,
                personalBests: personalBests || [],
                scoreHistory,
                accuracyHistory,
                modeBreakdown: Object.values(modeBreakdown),
                firstPlayed: scores[0]?.created_at,
                lastPlayed: scores[scores.length - 1]?.created_at
            };

            return { stats, error: null };
        } catch (error) {
            return { stats: null, error };
        }
    }

    /**
     * Get score progression over time
     * @param {string} userId - Optional, defaults to current user
     * @param {Object} options 
     * @param {string} options.gameId - Filter by game
     * @param {string} options.period - 'week', 'month', 'year', 'all'
     * @returns {Promise<{progression: Array, error: Error}>}
     */
    async getScoreProgression(userId = null, options = {}) {
        const {
            gameId = null,
            period = 'month'
        } = options;

        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { progression: [], error: new Error('No user specified') };
        }

        if (!isSupabaseConfigured()) {
            return { progression: [], error: new Error('Supabase not configured') };
        }

        try {
            // Calculate start date based on period
            const now = new Date();
            let startDate;
            switch (period) {
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'year':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    startDate = null;
            }

            let query = supabase
                .from('scores')
                .select('score, created_at, game_id')
                .eq('user_id', targetId)
                .order('created_at', { ascending: true });

            if (gameId) {
                query = query.eq('game_id', gameId);
            }

            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }

            const { data, error } = await query;

            if (error) {
                return { progression: [], error };
            }

            // Group by day and calculate daily best
            const dailyBests = new Map();
            data.forEach(s => {
                const date = s.created_at.split('T')[0];
                if (!dailyBests.has(date) || s.score > dailyBests.get(date).score) {
                    dailyBests.set(date, {
                        date,
                        score: s.score,
                        gameId: s.game_id
                    });
                }
            });

            const progression = Array.from(dailyBests.values());

            return { progression, error: null };
        } catch (error) {
            return { progression: [], error };
        }
    }

    /**
     * Compare stats with a friend
     * @param {string} friendId 
     * @param {string} gameId - Optional, compare for specific game
     * @returns {Promise<{comparison: Object, error: Error}>}
     */
    async compareWithFriend(friendId, gameId = null) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { comparison: null, error: new Error('Must be logged in') };
        }

        try {
            // Get both users' stats
            const [myStats, friendStats] = await Promise.all([
                gameId 
                    ? this.getGameStats(gameId, profile.id)
                    : this.getUserStats(profile.id),
                gameId
                    ? this.getGameStats(gameId, friendId)
                    : this.getUserStats(friendId)
            ]);

            if (myStats.error || friendStats.error) {
                return { 
                    comparison: null, 
                    error: myStats.error || friendStats.error 
                };
            }

            // Get friend profile
            const { data: friendProfile } = await supabase
                .from('profiles')
                .select('username, display_name, avatar_url')
                .eq('id', friendId)
                .single();

            const comparison = {
                me: {
                    ...myStats.stats,
                    username: profile.username,
                    displayName: profile.display_name
                },
                friend: {
                    ...friendStats.stats,
                    username: friendProfile?.username,
                    displayName: friendProfile?.display_name,
                    avatarUrl: friendProfile?.avatar_url
                },
                gameId
            };

            return { comparison, error: null };
        } catch (error) {
            return { comparison: null, error };
        }
    }

    /**
     * Get play activity heatmap data
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{heatmap: Object, error: Error}>}
     */
    async getPlayActivityHeatmap(userId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { heatmap: null, error: new Error('No user specified') };
        }

        if (!isSupabaseConfigured()) {
            return { heatmap: null, error: new Error('Supabase not configured') };
        }

        try {
            // Get sessions from last year
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const { data } = await supabase
                .from('play_sessions')
                .select('started_at, duration_seconds')
                .contains('players', [{ user_id: targetId }])
                .gte('started_at', oneYearAgo.toISOString());

            // Build heatmap data
            const heatmap = {
                byDayOfWeek: Array(7).fill(0), // Sun-Sat
                byHour: Array(24).fill(0),
                byDate: {}
            };

            data?.forEach(s => {
                const date = new Date(s.started_at);
                const dayOfWeek = date.getDay();
                const hour = date.getHours();
                const dateKey = s.started_at.split('T')[0];

                heatmap.byDayOfWeek[dayOfWeek]++;
                heatmap.byHour[hour]++;
                heatmap.byDate[dateKey] = (heatmap.byDate[dateKey] || 0) + 1;
            });

            return { heatmap, error: null };
        } catch (error) {
            return { heatmap: null, error };
        }
    }

    /**
     * Get local stats for guest users
     * @private
     */
    _getLocalStats() {
        const key = 'lightgun_arcade_personal_bests';
        const bests = JSON.parse(localStorage.getItem(key) || '{}');
        
        const personalBests = Object.values(bests);
        const totalAttempts = personalBests.reduce((sum, pb) => sum + (pb.attempts || 0), 0);
        const bestScore = personalBests.length > 0 
            ? Math.max(...personalBests.map(pb => pb.best_score))
            : 0;

        return {
            stats: {
                totalGamesPlayed: totalAttempts,
                totalScoresSubmitted: totalAttempts,
                personalBests: personalBests.length,
                bestScore,
                uniqueGamesPlayed: new Set(personalBests.map(pb => pb.game_id)).size,
                isGuest: true
            },
            error: null
        };
    }
}
