import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * FriendService - Manages friend relationships
 * 
 * Handles:
 * - Friend requests (send, accept, decline)
 * - Friend list management
 * - Blocking users
 * - Online status tracking
 */
export class FriendService {
    constructor(authService) {
        this.auth = authService;
        this.onlineStatusListeners = [];
        this.friendListeners = [];
        this._presenceChannel = null;
    }

    /**
     * Get all friends for the current user
     * @returns {Promise<{friends: Array, error: Error}>}
     */
    async getFriends() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { friends: [], error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { friends: [], error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                status,
                created_at,
                user_id,
                friend_id,
                requested_by,
                user:profiles!friendships_user_id_fkey (
                    id, username, display_name, avatar_url, last_active
                ),
                friend:profiles!friendships_friend_id_fkey (
                    id, username, display_name, avatar_url, last_active
                )
            `)
            .eq('status', 'accepted')
            .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

        if (error) {
            return { friends: [], error };
        }

        // Format friends list (extract the other user)
        const friends = data.map(f => {
            const friend = f.user_id === profile.id ? f.friend : f.user;
            return {
                friendshipId: f.id,
                ...friend,
                isOnline: this._isRecentlyActive(friend.last_active)
            };
        });

        return { friends, error: null };
    }

    /**
     * Get pending friend requests (received)
     * @returns {Promise<{requests: Array, error: Error}>}
     */
    async getPendingRequests() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { requests: [], error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { requests: [], error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                created_at,
                requested_by,
                requester:profiles!friendships_requested_by_fkey (
                    id, username, display_name, avatar_url
                )
            `)
            .eq('friend_id', profile.id)
            .eq('status', 'pending');

        if (error) {
            return { requests: [], error };
        }

        const requests = data.map(r => ({
            requestId: r.id,
            createdAt: r.created_at,
            from: r.requester
        }));

        return { requests, error: null };
    }

    /**
     * Get sent friend requests (outgoing)
     * @returns {Promise<{requests: Array, error: Error}>}
     */
    async getSentRequests() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { requests: [], error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { requests: [], error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                created_at,
                friend:profiles!friendships_friend_id_fkey (
                    id, username, display_name, avatar_url
                )
            `)
            .eq('user_id', profile.id)
            .eq('requested_by', profile.id)
            .eq('status', 'pending');

        if (error) {
            return { requests: [], error };
        }

        const requests = data.map(r => ({
            requestId: r.id,
            createdAt: r.created_at,
            to: r.friend
        }));

        return { requests, error: null };
    }

    /**
     * Send a friend request
     * @param {string} targetUserId - User ID to send request to
     * @returns {Promise<{error: Error}>}
     */
    async sendFriendRequest(targetUserId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (targetUserId === profile.id) {
            return { error: new Error('Cannot add yourself as a friend') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        // Check if friendship already exists
        const { data: existing } = await supabase
            .from('friendships')
            .select('id, status')
            .or(`and(user_id.eq.${profile.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${profile.id})`)
            .single();

        if (existing) {
            if (existing.status === 'accepted') {
                return { error: new Error('Already friends') };
            }
            if (existing.status === 'pending') {
                return { error: new Error('Friend request already pending') };
            }
            if (existing.status === 'blocked') {
                return { error: new Error('Cannot send request to this user') };
            }
        }

        // Check target user's privacy settings
        const { data: targetProfile } = await supabase
            .from('profiles')
            .select('privacy_settings')
            .eq('id', targetUserId)
            .single();

        if (targetProfile?.privacy_settings?.friend_requests === 'none') {
            return { error: new Error('This user is not accepting friend requests') };
        }

        // Create friend request
        const { error } = await supabase
            .from('friendships')
            .insert({
                user_id: profile.id,
                friend_id: targetUserId,
                requested_by: profile.id,
                status: 'pending'
            });

        return { error };
    }

    /**
     * Send a friend request by username
     * @param {string} username 
     * @returns {Promise<{error: Error}>}
     */
    async sendFriendRequestByUsername(username) {
        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { data: targetUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username.toLowerCase())
            .single();

        if (!targetUser) {
            return { error: new Error('User not found') };
        }

        return this.sendFriendRequest(targetUser.id);
    }

    /**
     * Accept a friend request
     * @param {string} requestId - Friendship ID
     * @returns {Promise<{error: Error}>}
     */
    async acceptFriendRequest(requestId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('friendships')
            .update({ 
                status: 'accepted',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('friend_id', profile.id)
            .eq('status', 'pending');

        return { error };
    }

    /**
     * Decline a friend request
     * @param {string} requestId - Friendship ID
     * @returns {Promise<{error: Error}>}
     */
    async declineFriendRequest(requestId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', requestId)
            .eq('friend_id', profile.id)
            .eq('status', 'pending');

        return { error };
    }

    /**
     * Cancel a sent friend request
     * @param {string} requestId - Friendship ID
     * @returns {Promise<{error: Error}>}
     */
    async cancelFriendRequest(requestId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', requestId)
            .eq('requested_by', profile.id)
            .eq('status', 'pending');

        return { error };
    }

    /**
     * Remove a friend
     * @param {string} friendshipId - Friendship ID
     * @returns {Promise<{error: Error}>}
     */
    async removeFriend(friendshipId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId)
            .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

        return { error };
    }

    /**
     * Block a user
     * @param {string} userId - User ID to block
     * @returns {Promise<{error: Error}>}
     */
    async blockUser(userId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        // Check if friendship exists
        const { data: existing } = await supabase
            .from('friendships')
            .select('id')
            .or(`and(user_id.eq.${profile.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${profile.id})`)
            .single();

        if (existing) {
            // Update existing to blocked
            const { error } = await supabase
                .from('friendships')
                .update({ 
                    status: 'blocked',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
            return { error };
        } else {
            // Create new blocked entry
            const { error } = await supabase
                .from('friendships')
                .insert({
                    user_id: profile.id,
                    friend_id: userId,
                    requested_by: profile.id,
                    status: 'blocked'
                });
            return { error };
        }
    }

    /**
     * Unblock a user
     * @param {string} userId - User ID to unblock
     * @returns {Promise<{error: Error}>}
     */
    async unblockUser(userId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { error: new Error('Supabase not configured') };
        }

        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('status', 'blocked')
            .or(`and(user_id.eq.${profile.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${profile.id})`);

        return { error };
    }

    /**
     * Get blocked users
     * @returns {Promise<{blocked: Array, error: Error}>}
     */
    async getBlockedUsers() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { blocked: [], error: new Error('Must be logged in') };
        }

        if (!isSupabaseConfigured()) {
            return { blocked: [], error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                friend:profiles!friendships_friend_id_fkey (
                    id, username, display_name, avatar_url
                )
            `)
            .eq('user_id', profile.id)
            .eq('status', 'blocked');

        if (error) {
            return { blocked: [], error };
        }

        const blocked = data.map(b => ({
            blockId: b.id,
            ...b.friend
        }));

        return { blocked, error: null };
    }

    /**
     * Check if a user is a friend
     * @param {string} userId 
     * @returns {Promise<boolean>}
     */
    async isFriend(userId) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return false;
        }

        if (!isSupabaseConfigured()) {
            return false;
        }

        const { data } = await supabase
            .from('friendships')
            .select('id')
            .eq('status', 'accepted')
            .or(`and(user_id.eq.${profile.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${profile.id})`)
            .single();

        return !!data;
    }

    /**
     * Get friend count
     * @returns {Promise<{count: number, error: Error}>}
     */
    async getFriendCount() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { count: 0, error: null };
        }

        if (!isSupabaseConfigured()) {
            return { count: 0, error: new Error('Supabase not configured') };
        }

        const { count, error } = await supabase
            .from('friendships')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'accepted')
            .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

        return { count: count || 0, error };
    }

    /**
     * Get pending request count
     * @returns {Promise<{count: number, error: Error}>}
     */
    async getPendingRequestCount() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return { count: 0, error: null };
        }

        if (!isSupabaseConfigured()) {
            return { count: 0, error: new Error('Supabase not configured') };
        }

        const { count, error } = await supabase
            .from('friendships')
            .select('*', { count: 'exact', head: true })
            .eq('friend_id', profile.id)
            .eq('status', 'pending');

        return { count: count || 0, error };
    }

    /**
     * Check if user was recently active (within 5 minutes)
     * @private
     */
    _isRecentlyActive(lastActive) {
        if (!lastActive) return false;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return new Date(lastActive) > fiveMinutesAgo;
    }

    /**
     * Subscribe to friend list changes
     * @param {function} callback 
     * @returns {function} Unsubscribe function
     */
    subscribeToFriendChanges(callback) {
        if (!isSupabaseConfigured()) {
            return () => {};
        }

        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest) {
            return () => {};
        }

        const channel = supabase
            .channel('friend-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `user_id=eq.${profile.id}`
                },
                () => callback()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'friendships',
                    filter: `friend_id=eq.${profile.id}`
                },
                () => callback()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
}
