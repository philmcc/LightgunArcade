import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * ActivityService - Manages the social activity feed
 * 
 * Activity Types:
 * - score_posted: User posted a score
 * - personal_best: User beat their personal best
 * - game_played: User played a game
 * - friend_added: User added a friend
 */
export class ActivityService {
    constructor(authService) {
        this.auth = authService;
    }

    /**
     * Get activity feed for the current user
     * Shows own activities and friends' activities based on visibility
     * @param {Object} options 
     * @param {number} options.limit - Max results
     * @param {number} options.offset - Pagination offset
     * @param {string} options.gameId - Filter by game
     * @param {string} options.userId - Filter by user
     * @param {string} options.type - Filter by activity type
     * @returns {Promise<{activities: Array, hasMore: boolean, error: Error}>}
     */
    async getFeed(options = {}) {
        const {
            limit = 20,
            offset = 0,
            gameId = null,
            userId = null,
            type = null
        } = options;

        if (!isSupabaseConfigured()) {
            return { activities: [], hasMore: false, error: new Error('Supabase not configured') };
        }

        const profile = this.auth.getCurrentUser();
        
        try {
            let query = supabase
                .from('activity_feed')
                .select(`
                    id,
                    activity_type,
                    game_id,
                    reference_id,
                    metadata,
                    visibility,
                    created_at,
                    user_id,
                    profiles!inner (
                        username,
                        display_name,
                        avatar_url
                    ),
                    games (
                        name
                    ),
                    activity_reactions (
                        id,
                        reaction,
                        user_id
                    ),
                    activity_comments (
                        id,
                        comment,
                        created_at,
                        user_id,
                        profiles (
                            username,
                            display_name,
                            avatar_url
                        )
                    )
                `)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit);

            // Apply filters
            if (gameId) {
                query = query.eq('game_id', gameId);
            }
            if (userId) {
                query = query.eq('user_id', userId);
            }
            if (type) {
                query = query.eq('activity_type', type);
            }

            const { data, error } = await query;

            if (error) {
                return { activities: [], hasMore: false, error };
            }

            // Format activities
            const activities = data.map(a => this._formatActivity(a, profile?.id));

            return {
                activities,
                hasMore: data.length === limit + 1,
                error: null
            };
        } catch (error) {
            return { activities: [], hasMore: false, error };
        }
    }

    /**
     * Get activities for a specific user
     * @param {string} userId 
     * @param {Object} options 
     * @returns {Promise<{activities: Array, hasMore: boolean, error: Error}>}
     */
    async getUserActivities(userId, options = {}) {
        return this.getFeed({ ...options, userId });
    }

    /**
     * Post a new activity
     * @param {string} type - Activity type
     * @param {Object} data - Activity data
     * @param {string} data.gameId - Related game ID
     * @param {string} data.referenceId - Related record ID (score, etc.)
     * @param {Object} data.metadata - Additional data
     * @param {string} data.visibility - 'public', 'friends', 'private'
     * @returns {Promise<{activity: Object, error: Error}>}
     */
    async postActivity(type, data = {}) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { activity: null, error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { activity: null, error: new Error('Supabase not configured') };
        }

        const { gameId, referenceId, metadata, visibility = 'friends' } = data;

        const { data: activity, error } = await supabase
            .from('activity_feed')
            .insert({
                user_id: profile.id,
                activity_type: type,
                game_id: gameId,
                reference_id: referenceId,
                metadata,
                visibility
            })
            .select()
            .single();

        if (error) {
            return { activity: null, error };
        }

        return { activity, error: null };
    }

    /**
     * Post a score activity
     * @param {string} gameId 
     * @param {number} score 
     * @param {Object} metadata - Score metadata (difficulty, mode, etc.)
     * @param {boolean} isPersonalBest 
     * @returns {Promise<{activity: Object, error: Error}>}
     */
    async postScoreActivity(gameId, score, metadata, isPersonalBest = false) {
        const type = isPersonalBest ? 'personal_best' : 'score_posted';
        
        return this.postActivity(type, {
            gameId,
            metadata: {
                score,
                ...metadata
            }
        });
    }

    /**
     * Post a game played activity
     * @param {string} gameId 
     * @param {Object} sessionData - Session info (duration, players, etc.)
     * @returns {Promise<{activity: Object, error: Error}>}
     */
    async postGamePlayedActivity(gameId, sessionData) {
        return this.postActivity('game_played', {
            gameId,
            metadata: sessionData
        });
    }

    /**
     * Post a friend added activity
     * @param {string} friendId 
     * @param {string} friendUsername 
     * @returns {Promise<{activity: Object, error: Error}>}
     */
    async postFriendAddedActivity(friendId, friendUsername) {
        return this.postActivity('friend_added', {
            metadata: {
                friend_id: friendId,
                friend_username: friendUsername
            }
        });
    }

    /**
     * Add a reaction to an activity
     * @param {string} activityId 
     * @param {string} reaction - 'like', 'trophy', 'fire'
     * @returns {Promise<{error: Error}>}
     */
    async addReaction(activityId, reaction) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('activity_reactions')
            .upsert({
                activity_id: activityId,
                user_id: profile.id,
                reaction
            }, {
                onConflict: 'activity_id,user_id,reaction'
            });

        return { error };
    }

    /**
     * Remove a reaction from an activity
     * @param {string} activityId 
     * @param {string} reaction 
     * @returns {Promise<{error: Error}>}
     */
    async removeReaction(activityId, reaction) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('activity_reactions')
            .delete()
            .eq('activity_id', activityId)
            .eq('user_id', profile.id)
            .eq('reaction', reaction);

        return { error };
    }

    /**
     * Add a comment to an activity
     * @param {string} activityId 
     * @param {string} comment 
     * @returns {Promise<{comment: Object, error: Error}>}
     */
    async addComment(activityId, comment) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { comment: null, error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { comment: null, error: new Error('Supabase not configured') };
        }

        if (!comment || comment.trim().length === 0) {
            return { comment: null, error: new Error('Comment cannot be empty') };
        }

        if (comment.length > 500) {
            return { comment: null, error: new Error('Comment too long (max 500 characters)') };
        }

        const { data, error } = await supabase
            .from('activity_comments')
            .insert({
                activity_id: activityId,
                user_id: profile.id,
                comment: comment.trim()
            })
            .select(`
                id,
                comment,
                created_at,
                user_id,
                profiles (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .single();

        if (error) {
            return { comment: null, error };
        }

        return {
            comment: {
                id: data.id,
                text: data.comment,
                createdAt: data.created_at,
                user: {
                    id: data.user_id,
                    username: data.profiles.username,
                    displayName: data.profiles.display_name,
                    avatarUrl: data.profiles.avatar_url
                }
            },
            error: null
        };
    }

    /**
     * Delete a comment
     * @param {string} commentId 
     * @returns {Promise<{error: Error}>}
     */
    async deleteComment(commentId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('activity_comments')
            .delete()
            .eq('id', commentId)
            .eq('user_id', profile.id);

        return { error };
    }

    /**
     * Get reaction counts for an activity
     * @param {string} activityId 
     * @returns {Promise<{counts: Object, error: Error}>}
     */
    async getReactionCounts(activityId) {
        if (!isSupabaseConfigured()) {
            return { counts: {}, error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('activity_reactions')
            .select('reaction')
            .eq('activity_id', activityId);

        if (error) {
            return { counts: {}, error };
        }

        const counts = {};
        data.forEach(r => {
            counts[r.reaction] = (counts[r.reaction] || 0) + 1;
        });

        return { counts, error: null };
    }

    /**
     * Format an activity for display
     * @private
     */
    _formatActivity(activity, currentUserId) {
        const reactions = {};
        let userReactions = [];

        if (activity.activity_reactions) {
            activity.activity_reactions.forEach(r => {
                reactions[r.reaction] = (reactions[r.reaction] || 0) + 1;
                if (r.user_id === currentUserId) {
                    userReactions.push(r.reaction);
                }
            });
        }

        const comments = (activity.activity_comments || []).map(c => ({
            id: c.id,
            text: c.comment,
            createdAt: c.created_at,
            user: {
                id: c.user_id,
                username: c.profiles?.username,
                displayName: c.profiles?.display_name,
                avatarUrl: c.profiles?.avatar_url
            }
        }));

        return {
            id: activity.id,
            type: activity.activity_type,
            gameId: activity.game_id,
            gameName: activity.games?.name,
            referenceId: activity.reference_id,
            metadata: activity.metadata,
            visibility: activity.visibility,
            createdAt: activity.created_at,
            user: {
                id: activity.user_id,
                username: activity.profiles.username,
                displayName: activity.profiles.display_name,
                avatarUrl: activity.profiles.avatar_url
            },
            reactions,
            userReactions,
            comments,
            commentCount: comments.length
        };
    }

    /**
     * Subscribe to new activities in the feed
     * @param {function} callback - Called with new activity
     * @returns {function} Unsubscribe function
     */
    subscribeToFeed(callback) {
        if (!isSupabaseConfigured()) {
            return () => {};
        }

        const channel = supabase
            .channel('activity-feed')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_feed'
                },
                async (payload) => {
                    // Fetch full activity with relations
                    const { data } = await supabase
                        .from('activity_feed')
                        .select(`
                            id,
                            activity_type,
                            game_id,
                            reference_id,
                            metadata,
                            visibility,
                            created_at,
                            user_id,
                            profiles (
                                username,
                                display_name,
                                avatar_url
                            ),
                            games (
                                name
                            )
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        const profile = this.auth.getCurrentUser();
                        callback(this._formatActivity(data, profile?.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
}
