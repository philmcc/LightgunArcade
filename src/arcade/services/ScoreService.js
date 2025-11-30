import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * ScoreService - Manages game scores and personal bests
 * 
 * Handles:
 * - Score submission to Supabase
 * - Personal best tracking
 * - Offline score queue
 * - Score metadata
 */
export class ScoreService {
    constructor(authService) {
        this.auth = authService;
        this.offlineQueue = [];
        this.offlineQueueKey = 'lightgun_arcade_offline_scores';
        
        // Load any queued offline scores
        this._loadOfflineQueue();
        
        // Try to sync when online
        window.addEventListener('online', () => this._syncOfflineScores());
    }

    /**
     * Submit a score
     * @param {string} gameId - Game identifier
     * @param {number} score - Score value
     * @param {Object} options - Additional options
     * @param {string} options.mode - Game mode (e.g., 'arcade', 'endless')
     * @param {string} options.difficulty - Difficulty level
     * @param {Object} options.metadata - Additional score data (accuracy, shots, etc.)
     * @param {string} options.sessionId - Play session ID
     * @returns {Promise<{score: Object, isPersonalBest: boolean, error: Error}>}
     */
    async submitScore(gameId, score, options = {}) {
        const {
            mode = 'arcade',
            difficulty = 'normal',
            metadata = {},
            sessionId = null
        } = options;

        const profile = this.auth.getCurrentUser();
        if (!profile) {
            return { score: null, isPersonalBest: false, error: new Error('No user') };
        }

        // For guest users, store locally only
        if (profile.isGuest) {
            return this._submitLocalScore(gameId, score, { mode, difficulty, metadata });
        }

        // For authenticated users, submit to Supabase
        if (!isSupabaseConfigured()) {
            // Queue for later if offline
            this._queueOfflineScore(gameId, score, { mode, difficulty, metadata, sessionId });
            return { score: null, isPersonalBest: false, error: new Error('Offline - score queued') };
        }

        try {
            // Insert score
            const { data: scoreData, error: scoreError } = await supabase
                .from('scores')
                .insert({
                    user_id: profile.id,
                    game_id: gameId,
                    mode,
                    difficulty,
                    score,
                    metadata,
                    session_id: sessionId
                })
                .select()
                .single();

            if (scoreError) {
                // Queue for later if insert fails
                this._queueOfflineScore(gameId, score, { mode, difficulty, metadata, sessionId });
                return { score: null, isPersonalBest: false, error: scoreError };
            }

            // Check/update personal best
            const isPersonalBest = await this._updatePersonalBest(
                profile.id, gameId, mode, difficulty, score, scoreData.id
            );

            return { score: scoreData, isPersonalBest, error: null };
        } catch (error) {
            this._queueOfflineScore(gameId, score, { mode, difficulty, metadata, sessionId });
            return { score: null, isPersonalBest: false, error };
        }
    }

    /**
     * Get personal best for a game/mode/difficulty
     * @param {string} gameId 
     * @param {string} mode 
     * @param {string} difficulty 
     * @returns {Promise<{personalBest: Object, error: Error}>}
     */
    async getPersonalBest(gameId, mode = 'arcade', difficulty = 'normal') {
        const profile = this.auth.getCurrentUser();
        if (!profile) {
            return { personalBest: null, error: new Error('No user') };
        }

        if (profile.isGuest) {
            return this._getLocalPersonalBest(gameId, mode, difficulty);
        }

        if (!isSupabaseConfigured()) {
            return { personalBest: null, error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('personal_bests')
            .select('*')
            .eq('user_id', profile.id)
            .eq('game_id', gameId)
            .eq('mode', mode)
            .eq('difficulty', difficulty)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            return { personalBest: null, error };
        }

        return { personalBest: data || null, error: null };
    }

    /**
     * Get all personal bests for a user
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{personalBests: Array, error: Error}>}
     */
    async getAllPersonalBests(userId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { personalBests: [], error: new Error('No user') };
        }

        if (profile?.isGuest && !userId) {
            return this._getAllLocalPersonalBests();
        }

        if (!isSupabaseConfigured()) {
            return { personalBests: [], error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('personal_bests')
            .select(`
                *,
                games (name)
            `)
            .eq('user_id', targetId)
            .order('updated_at', { ascending: false });

        if (error) {
            return { personalBests: [], error };
        }

        return { personalBests: data, error: null };
    }

    /**
     * Get recent scores for a user
     * @param {string} userId - Optional, defaults to current user
     * @param {number} limit - Max results
     * @returns {Promise<{scores: Array, error: Error}>}
     */
    async getRecentScores(userId = null, limit = 10) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { scores: [], error: new Error('No user') };
        }

        if (profile?.isGuest && !userId) {
            return this._getLocalRecentScores(limit);
        }

        if (!isSupabaseConfigured()) {
            return { scores: [], error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('scores')
            .select(`
                *,
                games (name)
            `)
            .eq('user_id', targetId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            return { scores: [], error };
        }

        return { scores: data, error: null };
    }

    /**
     * Get score count for a user
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{count: number, error: Error}>}
     */
    async getScoreCount(userId = null) {
        const profile = this.auth.getCurrentUser();
        const targetId = userId || profile?.id;

        if (!targetId) {
            return { count: 0, error: new Error('No user') };
        }

        if (!isSupabaseConfigured()) {
            return { count: 0, error: new Error('Supabase not configured') };
        }

        const { count, error } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetId);

        if (error) {
            return { count: 0, error };
        }

        return { count: count || 0, error: null };
    }

    // =========================================================================
    // PERSONAL BEST MANAGEMENT
    // =========================================================================

    /**
     * Update personal best if score is higher
     * @private
     */
    async _updatePersonalBest(userId, gameId, mode, difficulty, score, scoreId) {
        // Check existing personal best
        const { data: existing } = await supabase
            .from('personal_bests')
            .select('*')
            .eq('user_id', userId)
            .eq('game_id', gameId)
            .eq('mode', mode)
            .eq('difficulty', difficulty)
            .single();

        if (existing) {
            if (score > existing.best_score) {
                // Update personal best
                await supabase
                    .from('personal_bests')
                    .update({
                        best_score: score,
                        best_score_id: scoreId,
                        attempts: existing.attempts + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
                return true;
            } else {
                // Just increment attempts
                await supabase
                    .from('personal_bests')
                    .update({
                        attempts: existing.attempts + 1
                    })
                    .eq('id', existing.id);
                return false;
            }
        } else {
            // Create new personal best
            await supabase
                .from('personal_bests')
                .insert({
                    user_id: userId,
                    game_id: gameId,
                    mode,
                    difficulty,
                    best_score: score,
                    best_score_id: scoreId,
                    attempts: 1
                });
            return true;
        }
    }

    // =========================================================================
    // LOCAL STORAGE (for guests)
    // =========================================================================

    /**
     * Submit score locally for guest users
     * @private
     */
    _submitLocalScore(gameId, score, options) {
        const key = `lightgun_arcade_${gameId}_scores`;
        const scores = JSON.parse(localStorage.getItem(key) || '[]');
        
        const newScore = {
            id: `local_${Date.now()}`,
            game_id: gameId,
            score,
            mode: options.mode,
            difficulty: options.difficulty,
            metadata: options.metadata,
            created_at: new Date().toISOString()
        };

        scores.push(newScore);
        scores.sort((a, b) => b.score - a.score);
        
        // Keep top 100 scores
        const trimmed = scores.slice(0, 100);
        localStorage.setItem(key, JSON.stringify(trimmed));

        // Check personal best
        const isPersonalBest = this._updateLocalPersonalBest(gameId, score, options);

        return { score: newScore, isPersonalBest, error: null };
    }

    /**
     * Update local personal best
     * @private
     */
    _updateLocalPersonalBest(gameId, score, options) {
        const key = `lightgun_arcade_personal_bests`;
        const bests = JSON.parse(localStorage.getItem(key) || '{}');
        const bestKey = `${gameId}_${options.mode}_${options.difficulty}`;

        if (!bests[bestKey] || score > bests[bestKey].best_score) {
            bests[bestKey] = {
                game_id: gameId,
                mode: options.mode,
                difficulty: options.difficulty,
                best_score: score,
                attempts: (bests[bestKey]?.attempts || 0) + 1,
                updated_at: new Date().toISOString()
            };
            localStorage.setItem(key, JSON.stringify(bests));
            return true;
        }

        bests[bestKey].attempts = (bests[bestKey].attempts || 0) + 1;
        localStorage.setItem(key, JSON.stringify(bests));
        return false;
    }

    /**
     * Get local personal best
     * @private
     */
    _getLocalPersonalBest(gameId, mode, difficulty) {
        const key = `lightgun_arcade_personal_bests`;
        const bests = JSON.parse(localStorage.getItem(key) || '{}');
        const bestKey = `${gameId}_${mode}_${difficulty}`;
        return { personalBest: bests[bestKey] || null, error: null };
    }

    /**
     * Get all local personal bests
     * @private
     */
    _getAllLocalPersonalBests() {
        const key = `lightgun_arcade_personal_bests`;
        const bests = JSON.parse(localStorage.getItem(key) || '{}');
        return { personalBests: Object.values(bests), error: null };
    }

    /**
     * Get local recent scores
     * @private
     */
    _getLocalRecentScores(limit) {
        // Collect scores from all games
        const allScores = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('lightgun_arcade_') && key.endsWith('_scores')) {
                const scores = JSON.parse(localStorage.getItem(key) || '[]');
                allScores.push(...scores);
            }
        }

        // Sort by date and limit
        allScores.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { scores: allScores.slice(0, limit), error: null };
    }

    // =========================================================================
    // OFFLINE QUEUE
    // =========================================================================

    /**
     * Load offline queue from localStorage
     * @private
     */
    _loadOfflineQueue() {
        const saved = localStorage.getItem(this.offlineQueueKey);
        this.offlineQueue = saved ? JSON.parse(saved) : [];
    }

    /**
     * Save offline queue to localStorage
     * @private
     */
    _saveOfflineQueue() {
        localStorage.setItem(this.offlineQueueKey, JSON.stringify(this.offlineQueue));
    }

    /**
     * Queue a score for later submission
     * @private
     */
    _queueOfflineScore(gameId, score, options) {
        this.offlineQueue.push({
            gameId,
            score,
            options,
            queuedAt: new Date().toISOString()
        });
        this._saveOfflineQueue();
    }

    /**
     * Sync offline scores when back online
     * @private
     */
    async _syncOfflineScores() {
        if (this.offlineQueue.length === 0) return;
        if (!isSupabaseConfigured()) return;

        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) return;

        console.log(`Syncing ${this.offlineQueue.length} offline scores...`);

        const queue = [...this.offlineQueue];
        this.offlineQueue = [];
        this._saveOfflineQueue();

        for (const item of queue) {
            try {
                await this.submitScore(item.gameId, item.score, item.options);
            } catch (error) {
                console.error('Failed to sync score:', error);
                // Re-queue failed scores
                this.offlineQueue.push(item);
            }
        }

        this._saveOfflineQueue();
        console.log('Offline score sync complete');
    }

    /**
     * Get number of queued offline scores
     * @returns {number}
     */
    getOfflineQueueCount() {
        return this.offlineQueue.length;
    }
}
