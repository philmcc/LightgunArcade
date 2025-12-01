import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';

/**
 * NotificationService - Real-time notifications for social events
 * 
 * Handles:
 * - Friend request notifications
 * - Score beat notifications (when friend beats your score)
 * - Activity notifications
 * - In-app toast notifications
 */
export class NotificationService {
    constructor(authService) {
        this.auth = authService;
        this.listeners = [];
        this._friendshipChannel = null;
        this._scoreChannel = null;
        this._toastContainer = null;
        this._notifications = []; // In-memory notification queue
    }

    /**
     * Initialize notification subscriptions
     * Call this after user logs in
     */
    async init() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !isSupabaseConfigured()) {
            return;
        }

        // Clean up existing subscriptions
        this.cleanup();

        // Create toast container if it doesn't exist
        this._createToastContainer();

        // Subscribe to friend requests
        this._friendshipChannel = supabase
            .channel('friendship-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'friendships',
                    filter: `friend_id=eq.${profile.id}`
                },
                async (payload) => {
                    if (payload.new.status === 'pending') {
                        await this._handleFriendRequest(payload.new);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'friendships',
                    filter: `user_id=eq.${profile.id}`
                },
                async (payload) => {
                    if (payload.new.status === 'accepted' && payload.old?.status === 'pending') {
                        await this._handleFriendAccepted(payload.new);
                    }
                }
            )
            .subscribe();

        // Subscribe to score beats (when someone beats your personal best)
        this._scoreChannel = supabase
            .channel('score-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'personal_bests'
                },
                async (payload) => {
                    // Check if this is a friend beating a score
                    await this._checkScoreBeat(payload.new);
                }
            )
            .subscribe();

        console.log('NotificationService initialized');
    }

    /**
     * Clean up subscriptions
     */
    cleanup() {
        if (this._friendshipChannel) {
            supabase.removeChannel(this._friendshipChannel);
            this._friendshipChannel = null;
        }
        if (this._scoreChannel) {
            supabase.removeChannel(this._scoreChannel);
            this._scoreChannel = null;
        }
    }

    /**
     * Subscribe to notifications
     * @param {function} callback - Called with notification object
     * @returns {function} Unsubscribe function
     */
    onNotification(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Show a toast notification
     * @param {string} message - Notification message
     * @param {string} type - 'info', 'success', 'warning', 'error'
     * @param {Object} options - Additional options
     * @param {number} options.duration - Duration in ms (default 5000)
     * @param {function} options.onClick - Click handler
     */
    showToast(message, type = 'info', options = {}) {
        const { duration = 5000, onClick = null, icon = null } = options;

        this._createToastContainer();

        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        
        const iconMap = {
            'friend-request': '👤',
            'friend-accepted': '🤝',
            'score-beat': '🏆',
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icon || iconMap[type] || iconMap.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        `;

        if (onClick) {
            toast.style.cursor = 'pointer';
            toast.onclick = (e) => {
                if (!e.target.classList.contains('toast-close')) {
                    onClick();
                    toast.remove();
                }
            };
        }

        toast.querySelector('.toast-close').onclick = () => toast.remove();

        this._toastContainer.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    /**
     * Get pending notification count
     * @returns {Promise<number>}
     */
    async getPendingCount() {
        const profile = this.auth.getCurrentUser();
        if (!profile || profile.isGuest || !isSupabaseConfigured()) {
            return 0;
        }

        const { count } = await supabase
            .from('friendships')
            .select('*', { count: 'exact', head: true })
            .eq('friend_id', profile.id)
            .eq('status', 'pending');

        return count || 0;
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    _createToastContainer() {
        if (!this._toastContainer) {
            this._toastContainer = document.getElementById('notification-container');
            if (!this._toastContainer) {
                this._toastContainer = document.createElement('div');
                this._toastContainer.id = 'notification-container';
                this._toastContainer.className = 'notification-container';
                document.body.appendChild(this._toastContainer);
            }
        }
    }

    async _handleFriendRequest(friendship) {
        // Get requester info
        const { data: requester } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', friendship.user_id)
            .single();

        if (requester) {
            const name = requester.display_name || requester.username;
            
            this.showToast(
                `${name} sent you a friend request!`,
                'friend-request',
                {
                    icon: '👤+',
                    duration: 8000
                }
            );

            this._notifyListeners({
                type: 'friend_request',
                from: requester,
                friendshipId: friendship.id
            });
        }
    }

    async _handleFriendAccepted(friendship) {
        // Get friend info
        const { data: friend } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', friendship.friend_id)
            .single();

        if (friend) {
            const name = friend.display_name || friend.username;
            
            this.showToast(
                `${name} accepted your friend request!`,
                'friend-accepted',
                {
                    icon: '🤝',
                    duration: 5000
                }
            );

            this._notifyListeners({
                type: 'friend_accepted',
                friend: friend
            });
        }
    }

    async _checkScoreBeat(personalBest) {
        const profile = this.auth.getCurrentUser();
        if (!profile) return;

        // Don't notify about own scores
        if (personalBest.user_id === profile.id) return;

        // Check if this user is a friend
        const { data: friendship } = await supabase
            .from('friendships')
            .select('id')
            .or(`and(user_id.eq.${profile.id},friend_id.eq.${personalBest.user_id}),and(user_id.eq.${personalBest.user_id},friend_id.eq.${profile.id})`)
            .eq('status', 'accepted')
            .single();

        if (!friendship) return; // Not a friend

        // Check if they beat our score on this game/mode/difficulty
        const { data: myBest } = await supabase
            .from('personal_bests')
            .select('best_score')
            .eq('user_id', profile.id)
            .eq('game_id', personalBest.game_id)
            .eq('mode', personalBest.mode)
            .eq('difficulty', personalBest.difficulty)
            .single();

        if (myBest && personalBest.best_score > myBest.best_score) {
            // Friend beat our score!
            const { data: friend } = await supabase
                .from('profiles')
                .select('username, display_name')
                .eq('id', personalBest.user_id)
                .single();

            const { data: game } = await supabase
                .from('games')
                .select('name')
                .eq('id', personalBest.game_id)
                .single();

            if (friend && game) {
                const friendName = friend.display_name || friend.username;
                
                this.showToast(
                    `${friendName} just beat your score in ${game.name}!`,
                    'score-beat',
                    {
                        icon: '🏆',
                        duration: 8000
                    }
                );

                this._notifyListeners({
                    type: 'score_beat',
                    friend: friend,
                    game: game,
                    theirScore: personalBest.best_score,
                    yourScore: myBest.best_score
                });
            }
        }
    }

    _notifyListeners(notification) {
        this._notifications.push({
            ...notification,
            timestamp: new Date()
        });
        this.listeners.forEach(cb => cb(notification));
    }
}
