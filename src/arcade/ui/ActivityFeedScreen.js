/**
 * ActivityFeedScreen - Social activity feed UI
 * 
 * Features:
 * - View friend activity
 * - React to activities
 * - Comment on activities
 * - Filter by game
 */
export class ActivityFeedScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.activityService = options.activityService;
        this.gameRegistry = options.gameRegistry;
        this.currentUserId = options.currentUserId;
        this.onBack = options.onBack || (() => {});
        this.onViewProfile = options.onViewProfile || (() => {});
        
        this.activities = [];
        this.filterGame = null;
        this.isLoading = false;
        this.hasMore = true;
        this.offset = 0;
        this.limit = 20;
    }

    async show() {
        this.render();
        await this.loadActivities();
    }

    async loadActivities(append = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        if (!append) {
            this.renderLoading();
        }

        try {
            const { activities } = await this.activityService.getFeed({
                gameId: this.filterGame,
                limit: this.limit,
                offset: this.offset
            });

            if (append) {
                this.activities = [...this.activities, ...activities];
            } else {
                this.activities = activities || [];
            }

            this.hasMore = activities.length === this.limit;
        } catch (error) {
            console.error('Failed to load activities:', error);
        }

        this.isLoading = false;
        this.render();
    }

    render() {
        const games = this.gameRegistry?.getAllGames().filter(g => g.isAvailable) || [];

        this.container.innerHTML = `
            <div class="screen activity-screen">
                <h1>ACTIVITY FEED</h1>
                
                <div class="filter-bar">
                    <select id="game-filter">
                        <option value="">All Games</option>
                        ${games.map(g => `
                            <option value="${g.id}" ${this.filterGame === g.id ? 'selected' : ''}>
                                ${g.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="activity-list" id="activity-list">
                    ${this._renderActivities()}
                </div>
                
                ${this.hasMore ? `
                    <button id="btn-load-more" class="btn-secondary">Load More</button>
                ` : ''}
                
                <button id="btn-back" class="back-btn">BACK</button>
            </div>
        `;

        this._attachEventListeners();
    }

    _renderActivities() {
        if (this.activities.length === 0) {
            return `
                <div class="empty-state">
                    <p>No activity yet!</p>
                    <p class="hint">Play some games or add friends to see activity here.</p>
                </div>
            `;
        }

        return this.activities.map(activity => this._renderActivity(activity)).join('');
    }

    _renderActivity(activity) {
        const timeAgo = this._formatTimeAgo(activity.createdAt);
        const game = this.gameRegistry?.getGame(activity.gameId);
        const gameName = game?.name || activity.gameId;

        let content = '';
        let icon = '🎮';

        switch (activity.type) {
            case 'score_posted':
                icon = '🏆';
                content = `
                    <span class="activity-text">
                        scored <strong>${activity.data.score?.toLocaleString()}</strong> in ${gameName}
                    </span>
                    ${activity.data.difficulty ? `<span class="difficulty-badge">${activity.data.difficulty}</span>` : ''}
                `;
                break;

            case 'personal_best':
                icon = '⭐';
                content = `
                    <span class="activity-text">
                        set a new personal best of <strong>${activity.data.score?.toLocaleString()}</strong> in ${gameName}!
                    </span>
                `;
                break;

            case 'game_played':
                icon = '🎯';
                content = `
                    <span class="activity-text">
                        played ${gameName}
                    </span>
                `;
                break;

            case 'friend_added':
                icon = '👥';
                content = `
                    <span class="activity-text">
                        became friends with <strong>${activity.data.friendName}</strong>
                    </span>
                `;
                break;

            default:
                content = `<span class="activity-text">${activity.type}</span>`;
        }

        const userReaction = activity.reactions?.find(r => r.userId === this.currentUserId);

        return `
            <div class="activity-item" data-activity-id="${activity.id}">
                <div class="activity-header">
                    <div class="activity-user">
                        ${activity.user?.avatar_url 
                            ? `<img src="${activity.user.avatar_url}" class="activity-avatar" alt="">`
                            : '<span class="avatar-placeholder">👤</span>'
                        }
                        <span class="activity-username">${activity.user?.display_name || activity.user?.username || 'Unknown'}</span>
                    </div>
                    <span class="activity-time">${timeAgo}</span>
                </div>
                
                <div class="activity-content">
                    <span class="activity-icon">${icon}</span>
                    ${content}
                </div>
                
                <div class="activity-actions">
                    <div class="reaction-buttons">
                        <button class="reaction-btn ${userReaction?.type === 'like' ? 'active' : ''}" 
                                data-action="react" data-type="like" data-activity-id="${activity.id}">
                            👍 ${activity.reactionCounts?.like || ''}
                        </button>
                        <button class="reaction-btn ${userReaction?.type === 'trophy' ? 'active' : ''}"
                                data-action="react" data-type="trophy" data-activity-id="${activity.id}">
                            🏆 ${activity.reactionCounts?.trophy || ''}
                        </button>
                        <button class="reaction-btn ${userReaction?.type === 'fire' ? 'active' : ''}"
                                data-action="react" data-type="fire" data-activity-id="${activity.id}">
                            🔥 ${activity.reactionCounts?.fire || ''}
                        </button>
                    </div>
                    <button class="comment-btn" data-action="comment" data-activity-id="${activity.id}">
                        💬 ${activity.commentCount || ''}
                    </button>
                </div>
                
                ${activity.showComments ? this._renderComments(activity) : ''}
            </div>
        `;
    }

    _renderComments(activity) {
        if (!activity.comments || activity.comments.length === 0) {
            return `
                <div class="comments-section">
                    <div class="comment-input">
                        <input type="text" placeholder="Add a comment..." 
                               data-activity-id="${activity.id}" class="comment-text-input">
                        <button class="btn-small" data-action="post-comment" data-activity-id="${activity.id}">
                            Post
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="comments-section">
                ${activity.comments.map(comment => `
                    <div class="comment">
                        <span class="comment-user">${comment.user?.username || 'Unknown'}</span>
                        <span class="comment-text">${comment.content}</span>
                    </div>
                `).join('')}
                <div class="comment-input">
                    <input type="text" placeholder="Add a comment..." 
                           data-activity-id="${activity.id}" class="comment-text-input">
                    <button class="btn-small" data-action="post-comment" data-activity-id="${activity.id}">
                        Post
                    </button>
                </div>
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

    renderLoading() {
        this.container.innerHTML = `
            <div class="screen activity-screen">
                <h1>ACTIVITY FEED</h1>
                <div class="loading">Loading activity...</div>
            </div>
        `;
    }

    _attachEventListeners() {
        // Back button
        const backBtn = this.container.querySelector('#btn-back');
        if (backBtn) {
            backBtn.onclick = () => this.onBack();
        }

        // Game filter
        const gameFilter = this.container.querySelector('#game-filter');
        if (gameFilter) {
            gameFilter.onchange = (e) => {
                this.filterGame = e.target.value || null;
                this.offset = 0;
                this.loadActivities();
            };
        }

        // Load more
        const loadMoreBtn = this.container.querySelector('#btn-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.onclick = () => {
                this.offset += this.limit;
                this.loadActivities(true);
            };
        }

        // Reaction buttons
        this.container.querySelectorAll('[data-action="react"]').forEach(btn => {
            btn.onclick = () => this._handleReaction(btn.dataset.activityId, btn.dataset.type);
        });

        // Comment toggle
        this.container.querySelectorAll('[data-action="comment"]').forEach(btn => {
            btn.onclick = () => this._toggleComments(btn.dataset.activityId);
        });

        // Post comment
        this.container.querySelectorAll('[data-action="post-comment"]').forEach(btn => {
            btn.onclick = () => {
                const input = this.container.querySelector(`.comment-text-input[data-activity-id="${btn.dataset.activityId}"]`);
                if (input && input.value.trim()) {
                    this._postComment(btn.dataset.activityId, input.value.trim());
                }
            };
        });
    }

    async _handleReaction(activityId, type) {
        try {
            await this.activityService.addReaction(activityId, type);
            // Refresh the activity
            await this.loadActivities();
        } catch (error) {
            console.error('Failed to add reaction:', error);
        }
    }

    async _toggleComments(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) return;

        if (!activity.showComments) {
            // Load comments
            const { comments } = await this.activityService.getComments(activityId);
            activity.comments = comments;
            activity.showComments = true;
        } else {
            activity.showComments = false;
        }

        this.render();
    }

    async _postComment(activityId, content) {
        try {
            await this.activityService.addComment(activityId, content);
            // Reload comments
            const activity = this.activities.find(a => a.id === activityId);
            if (activity) {
                const { comments } = await this.activityService.getComments(activityId);
                activity.comments = comments;
                activity.commentCount = (activity.commentCount || 0) + 1;
            }
            this.render();
        } catch (error) {
            console.error('Failed to post comment:', error);
        }
    }
}
