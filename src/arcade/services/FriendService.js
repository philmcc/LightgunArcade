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
    constructor(authService, userService = null) {
        this.auth = authService;
        this.userService = userService;
        this.onlineStatusListeners = [];
        this.friendListeners = [];
        this._presenceChannel = null;
        this._onlineUsers = new Map(); // userId -> { status, lastSeen, currentGame }
        this._presenceUpdateInterval = null;
    }

    // =========================================================================
    // ONLINE PRESENCE SYSTEM
    // =========================================================================

    /**
     * Initialize presence tracking for the current user
     * Call this after user logs in
     */
    async initPresence() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !isSupabaseConfigured()) {
            return;
        }

        // Clean up any existing presence
        this.cleanupPresence();

        // Create presence channel
        this._presenceChannel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: profile.id
                }
            }
        });

        // Track presence state changes
        this._presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = this._presenceChannel.presenceState();
                this._updateOnlineUsers(state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('User joined:', key, newPresences);
                this._notifyOnlineStatusListeners();
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('User left:', key, leftPresences);
                this._notifyOnlineStatusListeners();
            });

        // Subscribe and track our presence
        await this._presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this._presenceChannel.track({
                    user_id: profile.id,
                    username: profile.username,
                    status: 'online',
                    current_game: null,
                    online_at: new Date().toISOString()
                });
            }
        });

        // Update last_active in database periodically
        this._presenceUpdateInterval = setInterval(() => {
            this._updateLastActive();
        }, 60000); // Every minute
    }

    /**
     * Update user's current game status
     * @param {string|null} gameId - Current game ID or null if not playing
     * @param {string|null} gameName - Current game name
     */
    async updateCurrentGame(gameId, gameName = null) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !this._presenceChannel) {
            return;
        }

        await this._presenceChannel.track({
            user_id: profile.id,
            username: profile.username,
            status: gameId ? 'playing' : 'online',
            current_game: gameId,
            current_game_name: gameName,
            online_at: new Date().toISOString()
        });
    }

    /**
     * Set user status (online, away, busy)
     * @param {'online' | 'away' | 'busy'} status 
     */
    async setStatus(status) {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !this._presenceChannel) {
            return;
        }

        const currentState = this._onlineUsers.get(profile.id) || {};
        await this._presenceChannel.track({
            user_id: profile.id,
            username: profile.username,
            status: status,
            current_game: currentState.current_game || null,
            online_at: new Date().toISOString()
        });
    }

    /**
     * Clean up presence tracking
     * Call this on logout
     */
    cleanupPresence() {
        if (this._presenceUpdateInterval) {
            clearInterval(this._presenceUpdateInterval);
            this._presenceUpdateInterval = null;
        }
        if (this._presenceChannel) {
            this._presenceChannel.untrack();
            supabase.removeChannel(this._presenceChannel);
            this._presenceChannel = null;
        }
        this._onlineUsers.clear();
    }

    /**
     * Get online status for a specific user
     * @param {string} userId 
     * @returns {{ isOnline: boolean, status: string, currentGame: string|null, lastSeen: Date }}
     */
    getOnlineStatus(userId) {
        const presence = this._onlineUsers.get(userId);
        if (presence) {
            return {
                isOnline: true,
                status: presence.status || 'online',
                currentGame: presence.current_game,
                currentGameName: presence.current_game_name,
                lastSeen: new Date(presence.online_at)
            };
        }
        return {
            isOnline: false,
            status: 'offline',
            currentGame: null,
            currentGameName: null,
            lastSeen: null
        };
    }

    /**
     * Get all online friends
     * @returns {Array<{ userId: string, username: string, status: string, currentGame: string|null }>}
     */
    async getOnlineFriends() {
        const { friends } = await this.getFriends();
        const onlineFriends = [];

        for (const friend of friends) {
            const status = this.getOnlineStatus(friend.id);
            if (status.isOnline) {
                onlineFriends.push({
                    ...friend,
                    ...status
                });
            }
        }

        return onlineFriends;
    }

    /**
     * Subscribe to online status changes
     * @param {function} callback - Called when any friend's status changes
     * @returns {function} Unsubscribe function
     */
    onOnlineStatusChange(callback) {
        this.onlineStatusListeners.push(callback);
        return () => {
            this.onlineStatusListeners = this.onlineStatusListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Update the online users map from presence state
     * @private
     */
    _updateOnlineUsers(state) {
        this._onlineUsers.clear();
        for (const [userId, presences] of Object.entries(state)) {
            if (presences.length > 0) {
                // Use the most recent presence
                const latest = presences[presences.length - 1];
                this._onlineUsers.set(userId, latest);
            }
        }
        this._notifyOnlineStatusListeners();
    }

    /**
     * Notify all online status listeners
     * @private
     */
    _notifyOnlineStatusListeners() {
        this.onlineStatusListeners.forEach(cb => cb(this._onlineUsers));
    }

    /**
     * Update last_active timestamp in database
     * @private
     */
    async _updateLastActive() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !isSupabaseConfigured()) {
            return;
        }

        await supabase
            .from('profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('id', profile.id);
    }

    /**
     * Set the user service (for dependency injection after construction)
     * @param {UserService} userService 
     */
    setUserService(userService) {
        this.userService = userService;
    }

    /**
     * Search for users by username
     * Delegates to UserService
     * @param {string} query - Search query
     * @param {number} limit - Max results
     * @returns {Promise<{users: Array, error: Error}>}
     */
    async searchUsers(query, limit = 10) {
        if (!this.userService) {
            // Fallback: direct search if no userService
            return this._searchUsersDirect(query, limit);
        }
        return this.userService.searchUsers(query, limit);
    }

    /**
     * Direct user search (fallback if no UserService)
     * @private
     */
    async _searchUsersDirect(query, limit = 10) {
        if (!isSupabaseConfigured()) {
            return { users: [], error: new Error('Supabase not configured') };
        }

        if (!query || query.length < 2) {
            return { users: [], error: null };
        }

        const profile = this.auth.getCurrentUser();

        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .ilike('username', `%${query}%`)
            .neq('id', profile?.id || '') // Exclude self
            .limit(limit);

        if (error) {
            return { users: [], error };
        }

        return { users: data || [], error: null };
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

        // Get pending requests where current user is the recipient (friend_id)
        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                created_at,
                user_id,
                requested_by
            `)
            .eq('friend_id', profile.id)
            .eq('status', 'pending');

        if (error) {
            console.error('Error fetching pending requests:', error);
            return { requests: [], error };
        }

        if (!data || data.length === 0) {
            return { requests: [], error: null };
        }

        // Fetch requester profiles separately
        const requesterIds = data.map(r => r.user_id);
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', requesterIds);

        if (profileError) {
            console.error('Error fetching requester profiles:', profileError);
            return { requests: [], error: profileError };
        }

        const profileMap = new Map(profiles.map(p => [p.id, p]));

        const requests = data.map(r => ({
            requestId: r.id,
            createdAt: r.created_at,
            from: profileMap.get(r.user_id) || { id: r.user_id, username: 'Unknown' }
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

        // Get pending requests where current user is the sender
        const { data, error } = await supabase
            .from('friendships')
            .select(`
                id,
                created_at,
                friend_id
            `)
            .eq('user_id', profile.id)
            .eq('requested_by', profile.id)
            .eq('status', 'pending');

        if (error) {
            console.error('Error fetching sent requests:', error);
            return { requests: [], error };
        }

        if (!data || data.length === 0) {
            return { requests: [], error: null };
        }

        // Fetch recipient profiles separately
        const recipientIds = data.map(r => r.friend_id);
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', recipientIds);

        if (profileError) {
            console.error('Error fetching recipient profiles:', profileError);
            return { requests: [], error: profileError };
        }

        const profileMap = new Map(profiles.map(p => [p.id, p]));

        const requests = data.map(r => ({
            requestId: r.id,
            createdAt: r.created_at,
            to: profileMap.get(r.friend_id) || { id: r.friend_id, username: 'Unknown' }
        }));

        return { requests, error: null };
    }

    /**
     * Send a friend request
     * @param {string} targetUserId - User ID to send request to
     * @returns {Promise<{error: Error}>}
     */
    async sendFriendRequest(targetUserId) {
        console.log('sendFriendRequest called with targetUserId:', targetUserId);
        
        const profile = this.auth.getCurrentUser();
        console.log('Current user profile:', profile?.id, profile?.username);
        
        if (!profile || profile.isGuest) {
            console.log('User not logged in or is guest');
            return { error: new Error('Must be logged in') };
        }

        if (targetUserId === profile.id) {
            console.log('Cannot add self');
            return { error: new Error('Cannot add yourself as a friend') };
        }

        if (!isSupabaseConfigured()) {
            console.log('Supabase not configured');
            return { error: new Error('Supabase not configured') };
        }

        // Check if friendship already exists
        const { data: existing, error: existingError } = await supabase
            .from('friendships')
            .select('id, status')
            .or(`and(user_id.eq.${profile.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${profile.id})`)
            .single();

        console.log('Existing friendship check:', existing, existingError);

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

        console.log('Target profile privacy:', targetProfile?.privacy_settings);

        if (targetProfile?.privacy_settings?.friend_requests === 'none') {
            return { error: new Error('This user is not accepting friend requests') };
        }

        // Create friend request
        console.log('Inserting friendship:', {
            user_id: profile.id,
            friend_id: targetUserId,
            requested_by: profile.id,
            status: 'pending'
        });
        
        const { data: insertData, error } = await supabase
            .from('friendships')
            .insert({
                user_id: profile.id,
                friend_id: targetUserId,
                requested_by: profile.id,
                status: 'pending'
            })
            .select();
        
        console.log('Insert result:', insertData, 'Error:', error);

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
