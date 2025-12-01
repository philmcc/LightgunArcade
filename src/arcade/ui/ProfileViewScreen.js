/**
 * ProfileViewScreen - View another user's profile
 * 
 * Features:
 * - Display user info (avatar, username, bio)
 * - Show user stats
 * - Show recent activity
 * - Friend actions (add, remove, block)
 * - Online status
 */
export class ProfileViewScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.userService = options.userService;
        this.friendService = options.friendService;
        this.statsService = options.statsService;
        this.activityService = options.activityService;
        this.currentUserId = options.currentUserId;
        this.onBack = options.onBack || (() => {});
        this.onViewProfile = options.onViewProfile || (() => {}); // For viewing other profiles from activity
        
        this.targetUserId = null;
        this.profile = null;
        this.stats = null;
        this.activities = [];
        this.friendshipStatus = null; // 'none', 'friends', 'pending_sent', 'pending_received', 'blocked'
        this.isLoading = false;
    }

    async show(userId) {
        this.targetUserId = userId;
        this.isLoading = true;
        this.render();
        await this.loadProfile();
    }

    async loadProfile() {
        if (!this.targetUserId) return;

        try {
            // Load profile, stats, friendship status, and activities in parallel
            const promises = [
                this.userService?.getProfile(this.targetUserId),
                this.statsService?.getUserStats(this.targetUserId),
                this._getFriendshipStatus(),
                this.activityService?.getUserActivities(this.targetUserId, { limit: 5 })
            ];

            const results = await Promise.all(promises);

            this.profile = results[0]?.profile || null;
            this.stats = results[1]?.stats || null;
            this.friendshipStatus = results[2];
            this.activities = results[3]?.activities || [];

        } catch (error) {
            console.error('Failed to load profile:', error);
        }

        this.isLoading = false;
        this.render();
    }

    async _getFriendshipStatus() {
        if (!this.friendService || !this.currentUserId || this.targetUserId === this.currentUserId) {
            return 'self';
        }

        // Check if friends
        const isFriend = await this.friendService.isFriend(this.targetUserId);
        if (isFriend) return 'friends';

        // Check for pending requests
        const { requests: sent } = await this.friendService.getSentRequests();
        if (sent.some(r => r.to?.id === this.targetUserId)) {
            return 'pending_sent';
        }

        const { requests: received } = await this.friendService.getPendingRequests();
        if (received.some(r => r.from?.id === this.targetUserId)) {
            return 'pending_received';
        }

        // Check if blocked
        const { blocked } = await this.friendService.getBlockedUsers();
        if (blocked.some(b => b.id === this.targetUserId)) {
            return 'blocked';
        }

        return 'none';
    }

    render() {
        if (this.isLoading) {
            this.container.innerHTML = `
                <div class="screen profile-view-screen">
                    <div class="loading">Loading profile...</div>
                    <button id="btn-back" class="back-btn">BACK</button>
                </div>
            `;
            this._attachEventListeners();
            return;
        }

        if (!this.profile) {
            this.container.innerHTML = `
                <div class="screen profile-view-screen">
                    <div class="error-state">
                        <p>Profile not found</p>
                    </div>
                    <button id="btn-back" class="back-btn">BACK</button>
                </div>
            `;
            this._attachEventListeners();
            return;
        }

        const onlineStatus = this.friendService?.getOnlineStatus(this.targetUserId);
        const isOnline = onlineStatus?.isOnline || false;
        const statusText = this._getStatusText(onlineStatus);

        this.container.innerHTML = `
            <div class="screen profile-view-screen">
                <div class="profile-header">
                    <div class="profile-avatar-large ${isOnline ? 'online' : 'offline'}">
                        ${this.profile.avatar_url 
                            ? `<img src="${this.profile.avatar_url}" alt="${this.profile.username}">`
                            : '<span class="avatar-placeholder-large">👤</span>'
                        }
                        <span class="online-indicator ${isOnline ? 'online' : ''}"></span>
                    </div>
                    <div class="profile-info-main">
                        <h1 class="profile-display-name">${this.profile.display_name || this.profile.username}</h1>
                        <span class="profile-username">@${this.profile.username}</span>
                        <span class="profile-status ${isOnline ? 'online' : 'offline'}">${statusText}</span>
                    </div>
                </div>

                ${this.profile.bio ? `
                    <div class="profile-bio">
                        <p>${this.profile.bio}</p>
                    </div>
                ` : ''}

                ${this._renderFriendActions()}

                <div class="profile-stats-section">
                    <h2>Stats</h2>
                    ${this._renderStats()}
                </div>

                <div class="profile-activity-section">
                    <h2>Recent Activity</h2>
                    ${this._renderActivities()}
                </div>

                <button id="btn-back" class="back-btn">BACK</button>
            </div>
        `;

        this._attachEventListeners();
    }

    _getStatusText(onlineStatus) {
        if (!onlineStatus?.isOnline) {
            return 'Offline';
        }
        if (onlineStatus.status === 'playing' && onlineStatus.currentGameName) {
            return `Playing ${onlineStatus.currentGameName}`;
        }
        if (onlineStatus.status === 'away') {
            return 'Away';
        }
        if (onlineStatus.status === 'busy') {
            return 'Busy';
        }
        return 'Online';
    }

    _renderFriendActions() {
        if (this.friendshipStatus === 'self') {
            return ''; // Don't show actions on own profile
        }

        let actions = '';

        switch (this.friendshipStatus) {
            case 'friends':
                actions = `
                    <button class="btn-secondary" data-action="remove-friend">
                        Remove Friend
                    </button>
                    <button class="btn-danger" data-action="block">
                        Block User
                    </button>
                `;
                break;
            case 'pending_sent':
                actions = `
                    <button class="btn-secondary" disabled>
                        Request Sent
                    </button>
                    <button class="btn-danger" data-action="block">
                        Block User
                    </button>
                `;
                break;
            case 'pending_received':
                actions = `
                    <button class="btn-primary" data-action="accept">
                        Accept Request
                    </button>
                    <button class="btn-secondary" data-action="decline">
                        Decline
                    </button>
                `;
                break;
            case 'blocked':
                actions = `
                    <button class="btn-secondary" data-action="unblock">
                        Unblock User
                    </button>
                `;
                break;
            default: // 'none'
                actions = `
                    <button class="btn-primary" data-action="add-friend">
                        Add Friend
                    </button>
                    <button class="btn-danger" data-action="block">
                        Block User
                    </button>
                `;
        }

        return `<div class="profile-actions">${actions}</div>`;
    }

    _renderStats() {
        if (!this.stats) {
            return '<p class="empty-state">No stats available</p>';
        }

        const totalGames = this.stats.total_games_played || 0;
        const totalTime = this.stats.total_playtime_seconds || 0;
        const hours = Math.floor(totalTime / 3600);
        const minutes = Math.floor((totalTime % 3600) / 60);

        return `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">${totalGames}</span>
                    <span class="stat-label">Games Played</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${hours}h ${minutes}m</span>
                    <span class="stat-label">Play Time</span>
                </div>
                ${this.stats.favorite_game ? `
                    <div class="stat-item">
                        <span class="stat-value">${this.stats.favorite_game}</span>
                        <span class="stat-label">Favorite Game</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderActivities() {
        if (this.activities.length === 0) {
            return '<p class="empty-state">No recent activity</p>';
        }

        return `
            <div class="activity-list compact">
                ${this.activities.map(activity => this._renderActivityItem(activity)).join('')}
            </div>
        `;
    }

    _renderActivityItem(activity) {
        const timeAgo = this._formatTimeAgo(activity.created_at);
        let icon = '🎮';
        let text = '';

        switch (activity.activity_type) {
            case 'score_posted':
                icon = '🎯';
                text = `Scored ${activity.metadata?.score?.toLocaleString() || '?'} in ${activity.game?.name || 'a game'}`;
                break;
            case 'personal_best':
                icon = '🏆';
                text = `New personal best: ${activity.metadata?.score?.toLocaleString() || '?'} in ${activity.game?.name || 'a game'}`;
                break;
            case 'game_played':
                icon = '🎮';
                text = `Played ${activity.game?.name || 'a game'}`;
                break;
            case 'friend_added':
                icon = '👥';
                text = `Added ${activity.metadata?.friend_username || 'someone'} as a friend`;
                break;
            default:
                text = activity.activity_type;
        }

        return `
            <div class="activity-item-compact">
                <span class="activity-icon">${icon}</span>
                <span class="activity-text">${text}</span>
                <span class="activity-time">${timeAgo}</span>
            </div>
        `;
    }

    _formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    _attachEventListeners() {
        const backBtn = this.container.querySelector('#btn-back');
        if (backBtn) {
            backBtn.onclick = () => this.onBack();
        }

        // Friend action buttons
        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = () => this._handleAction(btn.dataset.action);
        });
    }

    async _handleAction(action) {
        if (!this.friendService) return;

        try {
            let result;
            switch (action) {
                case 'add-friend':
                    result = await this.friendService.sendFriendRequest(this.targetUserId);
                    if (!result.error) {
                        this._showNotification('Friend request sent!');
                        this.friendshipStatus = 'pending_sent';
                        this.render();
                    } else {
                        this._showNotification(result.error.message, 'error');
                    }
                    break;

                case 'remove-friend':
                    if (confirm('Remove this friend?')) {
                        result = await this.friendService.removeFriend(this.targetUserId);
                        if (!result.error) {
                            this._showNotification('Friend removed');
                            this.friendshipStatus = 'none';
                            this.render();
                        }
                    }
                    break;

                case 'accept':
                    // Need to find the request ID
                    const { requests } = await this.friendService.getPendingRequests();
                    const request = requests.find(r => r.from?.id === this.targetUserId);
                    if (request) {
                        result = await this.friendService.acceptFriendRequest(request.requestId);
                        if (!result.error) {
                            this._showNotification('Friend request accepted!');
                            this.friendshipStatus = 'friends';
                            this.render();
                        }
                    }
                    break;

                case 'decline':
                    const { requests: reqs } = await this.friendService.getPendingRequests();
                    const req = reqs.find(r => r.from?.id === this.targetUserId);
                    if (req) {
                        result = await this.friendService.declineFriendRequest(req.requestId);
                        if (!result.error) {
                            this.friendshipStatus = 'none';
                            this.render();
                        }
                    }
                    break;

                case 'block':
                    if (confirm('Block this user? They won\'t be able to send you friend requests.')) {
                        result = await this.friendService.blockUser(this.targetUserId);
                        if (!result.error) {
                            this._showNotification('User blocked');
                            this.friendshipStatus = 'blocked';
                            this.render();
                        }
                    }
                    break;

                case 'unblock':
                    result = await this.friendService.unblockUser(this.targetUserId);
                    if (!result.error) {
                        this._showNotification('User unblocked');
                        this.friendshipStatus = 'none';
                        this.render();
                    }
                    break;
            }
        } catch (error) {
            console.error('Action failed:', error);
            this._showNotification(error.message || 'Action failed', 'error');
        }
    }

    _showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        this.container.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}
