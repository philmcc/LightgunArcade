/**
 * LeaderboardScreen - Global and friends leaderboards
 * 
 * Features:
 * - Global leaderboards per game
 * - Friends-only leaderboards
 * - Time filters (daily, weekly, monthly, all-time)
 * - Personal rank display
 */
export class LeaderboardScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.leaderboardService = options.leaderboardService;
        this.gameRegistry = options.gameRegistry;
        this.currentUserId = options.currentUserId;
        this.onBack = options.onBack || (() => {});
        
        // State
        this.selectedGame = options.initialGame || null;
        this.selectedMode = 'arcade';
        this.selectedDifficulty = 'normal';
        this.timeFilter = 'all';
        this.showFriendsOnly = false;
        
        this.entries = [];
        this.myRank = null;
        this.total = 0;
        this.isLoading = false;
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
                difficulty: this.selectedDifficulty,
                timeFilter: this.timeFilter,
                limit: 50
            };

            let result;
            if (this.showFriendsOnly) {
                result = await this.leaderboardService.getFriendsLeaderboard(this.selectedGame, options);
            } else {
                result = await this.leaderboardService.getLeaderboard(this.selectedGame, options);
            }

            this.entries = result.entries || [];
            this.total = result.total || this.entries.length;

            // Get my rank
            const rankResult = await this.leaderboardService.getMyRank(this.selectedGame, options);
            this.myRank = rankResult;

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
                        
                        <select id="difficulty-select" class="filter-select">
                            <option value="easy" ${this.selectedDifficulty === 'easy' ? 'selected' : ''}>Easy</option>
                            <option value="normal" ${this.selectedDifficulty === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="hard" ${this.selectedDifficulty === 'hard' ? 'selected' : ''}>Hard</option>
                        </select>
                    </div>
                    
                    <div class="filter-row">
                        <div class="time-filters">
                            <button class="time-btn ${this.timeFilter === 'daily' ? 'active' : ''}" data-time="daily">Today</button>
                            <button class="time-btn ${this.timeFilter === 'weekly' ? 'active' : ''}" data-time="weekly">Week</button>
                            <button class="time-btn ${this.timeFilter === 'monthly' ? 'active' : ''}" data-time="monthly">Month</button>
                            <button class="time-btn ${this.timeFilter === 'all' ? 'active' : ''}" data-time="all">All Time</button>
                        </div>
                        
                        <button id="toggle-friends" class="toggle-btn ${this.showFriendsOnly ? 'active' : ''}">
                            ${this.showFriendsOnly ? '👥 Friends' : '🌍 Global'}
                        </button>
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
        const isCurrentUser = entry.userId === this.currentUserId;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';

        return `
            <div class="leaderboard-entry ${isCurrentUser ? 'current-user' : ''} ${rankClass}">
                <span class="entry-rank">
                    ${rank <= 3 ? this._getRankMedal(rank) : `#${rank}`}
                </span>
                <div class="entry-user">
                    ${entry.avatarUrl 
                        ? `<img src="${entry.avatarUrl}" class="entry-avatar" alt="">`
                        : '<span class="avatar-placeholder">👤</span>'
                    }
                    <span class="entry-name">${entry.displayName || entry.username}</span>
                </div>
                <span class="entry-score">${entry.score.toLocaleString()}</span>
            </div>
        `;
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

        // Difficulty select
        const diffSelect = this.container.querySelector('#difficulty-select');
        if (diffSelect) {
            diffSelect.onchange = (e) => {
                this.selectedDifficulty = e.target.value;
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
    }
}
