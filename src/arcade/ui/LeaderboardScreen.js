/**
 * LeaderboardScreen - Global and friends leaderboards
 * 
 * Features:
 * - Global leaderboards per game
 * - Friends-only leaderboards
 * - Time filters (daily, weekly, monthly, all-time)
 * - Personal rank display
 * - Add friend from leaderboard
 */
export class LeaderboardScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.leaderboardService = options.leaderboardService;
        this.friendService = options.friendService;
        this.gameRegistry = options.gameRegistry;
        this.currentUserId = options.currentUserId;
        this.onBack = options.onBack || (() => {});
        this.onViewProfile = options.onViewProfile || (() => {}); // Callback to view user profile
        
        // State
        this.selectedGame = options.initialGame || null;
        this.selectedMode = 'arcade';
        this.timeFilter = 'all';
        this.showFriendsOnly = false;
        
        this.entries = [];
        this.myRank = null;
        this.total = 0;
        this.isLoading = false;
        this.friends = [];
        this.pendingRequests = [];
    }

    async show() {
        // Auto-select first available game if none selected
        if (!this.selectedGame) {
            const games = this.gameRegistry?.getAllGames().filter(g => g.isAvailable) || [];
            if (games.length > 0) {
                this.selectedGame = games[0].id;
            }
        }
        
        this.render();
        await this.loadLeaderboard();
    }

    async loadLeaderboard() {
        if (!this.selectedGame) return;
        
        this.isLoading = true;
        this.render();

        try {
            const options = {
                mode: this.selectedMode,
                // Don't filter by difficulty - show all difficulties together
                timeFilter: this.timeFilter,
                limit: 50
            };

            // Load leaderboard and friend data in parallel
            const promises = [
                this.showFriendsOnly 
                    ? this.leaderboardService.getFriendsLeaderboard(this.selectedGame, options)
                    : this.leaderboardService.getLeaderboard(this.selectedGame, options),
                this.leaderboardService.getMyRank(this.selectedGame, options)
            ];

            // Load friends list if friendService available
            if (this.friendService) {
                promises.push(this.friendService.getFriends());
                promises.push(this.friendService.getSentRequests());
            }

            const results = await Promise.all(promises);

            this.entries = results[0].entries || [];
            this.total = results[0].total || this.entries.length;
            this.myRank = results[1];

            if (results[2]) {
                this.friends = results[2].friends || [];
            }
            if (results[3]) {
                this.pendingRequests = results[3].requests || [];
            }

        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }

        this.isLoading = false;
        this.render();
    }

    render() {
        const games = this.gameRegistry?.getAllGames().filter(g => g.isAvailable) || [];
        const selectedGameInfo = games.find(g => g.id === this.selectedGame);

        this.container.innerHTML = `
            <div class="screen leaderboard-screen">
                <h1>LEADERBOARDS</h1>
                
                <div class="leaderboard-filters">
                    <div class="filter-row">
                        <select id="game-select" class="filter-select">
                            ${games.map(g => `
                                <option value="${g.id}" ${this.selectedGame === g.id ? 'selected' : ''}>
                                    ${g.name}
                                </option>
                            `).join('')}
                        </select>
                        
                        <button id="toggle-friends" class="toggle-btn ${this.showFriendsOnly ? 'active' : ''}">
                            ${this.showFriendsOnly ? '👥 Friends' : '🌍 Global'}
                        </button>
                    </div>
                    
                    <div class="filter-row">
                        <div class="time-filters">
                            <button class="time-btn ${this.timeFilter === 'daily' ? 'active' : ''}" data-time="daily">Today</button>
                            <button class="time-btn ${this.timeFilter === 'weekly' ? 'active' : ''}" data-time="weekly">Week</button>
                            <button class="time-btn ${this.timeFilter === 'monthly' ? 'active' : ''}" data-time="monthly">Month</button>
                            <button class="time-btn ${this.timeFilter === 'all' ? 'active' : ''}" data-time="all">All Time</button>
                        </div>
                    </div>
                </div>
                
                ${this._renderMyRank()}
                
                <div class="leaderboard-table">
                    ${this._renderLeaderboard()}
                </div>
                
                <button id="btn-back" class="back-btn">BACK</button>
            </div>
        `;

        this._attachEventListeners();
    }

    _renderMyRank() {
        if (!this.myRank || !this.myRank.rank) {
            return '';
        }

        return `
            <div class="my-rank-card">
                <span class="my-rank-label">Your Rank</span>
                <span class="my-rank-value">#${this.myRank.rank}</span>
                <span class="my-rank-score">${this.myRank.score?.toLocaleString() || '-'}</span>
                <span class="my-rank-percentile">Top ${this.myRank.percentile}%</span>
            </div>
        `;
    }

    _renderLeaderboard() {
        if (this.isLoading) {
            return '<div class="loading">Loading leaderboard...</div>';
        }

        if (this.entries.length === 0) {
            return `
                <div class="empty-state">
                    <p>No scores yet!</p>
                    <p class="hint">Be the first to set a score!</p>
                </div>
            `;
        }

        return `
            <div class="leaderboard-entries">
                ${this.entries.map((entry, index) => this._renderEntry(entry, index)).join('')}
            </div>
        `;
    }

    _renderEntry(entry, index) {
        const rank = entry.rank || index + 1;
        const isCurrentUser = entry.user?.id === this.currentUserId;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const difficultyIcon = this._getDifficultyIcon(entry.difficulty);
        
        // Check friend status
        const isFriend = this.friends.some(f => f.id === entry.user?.id);
        const hasPending = this.pendingRequests.some(r => r.to?.id === entry.user?.id);
        const canAddFriend = this.friendService && !isCurrentUser && !isFriend && entry.user?.id;

        const canViewProfile = entry.user?.id && !isCurrentUser;

        return `
            <div class="leaderboard-entry ${isCurrentUser ? 'current-user' : ''} ${rankClass}">
                <span class="entry-rank">
                    ${rank <= 3 ? this._getRankMedal(rank) : `#${rank}`}
                </span>
                <div class="entry-user ${canViewProfile ? 'clickable' : ''}" ${canViewProfile ? `data-action="view-profile" data-user-id="${entry.user.id}"` : ''}>
                    ${entry.user?.avatarUrl 
                        ? `<img src="${entry.user.avatarUrl}" class="entry-avatar" alt="">`
                        : '<span class="avatar-placeholder">👤</span>'
                    }
                    <span class="entry-name">${entry.user?.displayName || entry.user?.username || 'Unknown'}</span>
                </div>
                <span class="entry-difficulty" title="${entry.difficulty || 'normal'}">${difficultyIcon}</span>
                <span class="entry-score">${entry.score.toLocaleString()}</span>
                ${canAddFriend ? `
                    <div class="entry-actions">
                        ${hasPending 
                            ? '<span class="status-text pending">Pending</span>'
                            : `<button class="btn-add-friend" data-action="add-friend" data-user-id="${entry.user.id}" title="Add Friend">👤+</button>`
                        }
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    _getDifficultyIcon(difficulty) {
        switch (difficulty) {
            case 'easy':
            case 'beginner':
                return '<span class="diff-icon diff-easy" title="Easy">🟢</span>';
            case 'normal':
            case 'medium':
                return '<span class="diff-icon diff-normal" title="Normal">🟡</span>';
            case 'hard':
                return '<span class="diff-icon diff-hard" title="Hard">🔴</span>';
            default:
                return '<span class="diff-icon diff-normal" title="Normal">🟡</span>';
        }
    }

    _getRankMedal(rank) {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    }

    _attachEventListeners() {
        // Back button
        const backBtn = this.container.querySelector('#btn-back');
        if (backBtn) {
            backBtn.onclick = () => this.onBack();
        }

        // Game select
        const gameSelect = this.container.querySelector('#game-select');
        if (gameSelect) {
            gameSelect.onchange = (e) => {
                this.selectedGame = e.target.value;
                this.loadLeaderboard();
            };
        }

        // Time filters
        this.container.querySelectorAll('.time-btn').forEach(btn => {
            btn.onclick = () => {
                this.timeFilter = btn.dataset.time;
                this.loadLeaderboard();
            };
        });

        // Friends toggle
        const toggleFriends = this.container.querySelector('#toggle-friends');
        if (toggleFriends) {
            toggleFriends.onclick = () => {
                this.showFriendsOnly = !this.showFriendsOnly;
                this.loadLeaderboard();
            };
        }

        // Add friend buttons
        this.container.querySelectorAll('[data-action="add-friend"]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this._handleAddFriend(btn.dataset.userId);
            };
        });

        // View profile clicks
        this.container.querySelectorAll('[data-action="view-profile"]').forEach(el => {
            el.onclick = () => this.onViewProfile(el.dataset.userId);
        });
    }

    async _handleAddFriend(userId) {
        if (!this.friendService || !userId) return;

        try {
            const { error } = await this.friendService.sendFriendRequest(userId);
            if (error) {
                this._showNotification(error.message || 'Failed to send request', 'error');
            } else {
                this._showNotification('Friend request sent!');
                // Reload to update button state
                await this.loadLeaderboard();
            }
        } catch (error) {
            console.error('Failed to send friend request:', error);
            this._showNotification('Failed to send request', 'error');
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
