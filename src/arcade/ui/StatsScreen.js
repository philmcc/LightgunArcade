/**
 * StatsScreen - User statistics dashboard
 * 
 * Features:
 * - Overall stats summary
 * - Per-game statistics
 * - Score progression charts
 * - Play activity heatmap
 */
export class StatsScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.statsService = options.statsService;
        this.gameRegistry = options.gameRegistry;
        this.onBack = options.onBack || (() => {});
        
        this.userStats = null;
        this.selectedGame = null;
        this.gameStats = null;
        this.isLoading = false;
    }

    async show() {
        this.render();
        await this.loadStats();
    }

    async loadStats() {
        this.isLoading = true;
        this.renderLoading();

        try {
            const { stats } = await this.statsService.getUserStats();
            this.userStats = stats;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }

        this.isLoading = false;
        this.render();
    }

    async loadGameStats(gameId) {
        this.selectedGame = gameId;
        this.isLoading = true;
        this.render();

        try {
            const { stats } = await this.statsService.getGameStats(gameId);
            this.gameStats = stats;
        } catch (error) {
            console.error('Failed to load game stats:', error);
        }

        this.isLoading = false;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="screen stats-screen">
                <h1>STATISTICS</h1>
                
                ${this.selectedGame ? this._renderGameStats() : this._renderOverview()}
                
                <button id="btn-back" class="back-btn">
                    ${this.selectedGame ? 'BACK TO OVERVIEW' : 'BACK'}
                </button>
            </div>
        `;

        this._attachEventListeners();
    }

    _renderOverview() {
        if (!this.userStats) {
            return '<div class="loading">Loading stats...</div>';
        }

        const stats = this.userStats;
        const playtime = this._formatPlaytime(stats.totalPlaytimeSeconds || 0);

        return `
            <div class="stats-overview">
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalGamesPlayed || 0}</span>
                        <span class="stat-label">Games Played</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.totalScoresSubmitted || 0}</span>
                        <span class="stat-label">Scores Submitted</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.personalBests || 0}</span>
                        <span class="stat-label">Personal Bests</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.bestScore?.toLocaleString() || 0}</span>
                        <span class="stat-label">Best Score</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${playtime}</span>
                        <span class="stat-label">Total Playtime</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.overallAccuracy !== null ? stats.overallAccuracy + '%' : '-'}</span>
                        <span class="stat-label">Accuracy</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.friendCount || 0}</span>
                        <span class="stat-label">Friends</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.uniqueGamesPlayed || 0}</span>
                        <span class="stat-label">Unique Games</span>
                    </div>
                </div>
                
                <h2>Game Statistics</h2>
                <div class="game-stats-list">
                    ${this._renderGameList()}
                </div>
            </div>
        `;
    }

    _renderGameList() {
        const games = this.gameRegistry?.getAllGames() || [];
        
        if (games.length === 0) {
            return '<p class="hint">No games available</p>';
        }

        return games.filter(g => g.isAvailable).map(game => `
            <div class="game-stat-item" data-game-id="${game.id}">
                <div class="game-icon">🎯</div>
                <div class="game-info">
                    <span class="game-name">${game.name}</span>
                </div>
                <button class="btn-small" data-action="view-game" data-game-id="${game.id}">
                    View Stats
                </button>
            </div>
        `).join('');
    }

    _renderGameStats() {
        if (this.isLoading || !this.gameStats) {
            return '<div class="loading">Loading game stats...</div>';
        }

        const stats = this.gameStats;
        const game = this.gameRegistry?.getGame(this.selectedGame);
        const gameName = game?.name || this.selectedGame;

        return `
            <div class="game-stats-detail">
                <h2>${gameName}</h2>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-value">${stats.gamesPlayed || 0}</span>
                        <span class="stat-label">Times Played</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.bestScore?.toLocaleString() || 0}</span>
                        <span class="stat-label">Best Score</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.averageScore?.toLocaleString() || 0}</span>
                        <span class="stat-label">Average Score</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-value">${stats.personalBests?.length || 0}</span>
                        <span class="stat-label">Personal Bests</span>
                    </div>
                </div>
                
                ${this._renderScoreHistory(stats.scoreHistory)}
                ${this._renderModeBreakdown(stats.modeBreakdown)}
            </div>
        `;
    }

    _renderScoreHistory(history) {
        if (!history || history.length === 0) {
            return '';
        }

        // Simple text-based chart (could be enhanced with canvas)
        const maxScore = Math.max(...history.map(h => h.score));
        
        return `
            <div class="score-history">
                <h3>Recent Scores</h3>
                <div class="score-chart">
                    ${history.slice(-10).map(h => {
                        const height = Math.round((h.score / maxScore) * 100);
                        return `
                            <div class="score-bar" style="height: ${height}%" title="${h.score.toLocaleString()}">
                                <span class="score-value">${this._formatScore(h.score)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    _renderModeBreakdown(breakdown) {
        if (!breakdown || breakdown.length === 0) {
            return '';
        }

        return `
            <div class="mode-breakdown">
                <h3>Mode Breakdown</h3>
                <div class="breakdown-list">
                    ${breakdown.map(m => `
                        <div class="breakdown-item">
                            <span class="mode-name">${m.mode} (${m.difficulty})</span>
                            <span class="mode-stats">
                                ${m.count} plays • Best: ${m.bestScore.toLocaleString()}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _formatPlaytime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }

    _formatScore(score) {
        if (score >= 1000000) return (score / 1000000).toFixed(1) + 'M';
        if (score >= 1000) return (score / 1000).toFixed(1) + 'K';
        return score.toString();
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="screen stats-screen">
                <h1>STATISTICS</h1>
                <div class="loading">Loading stats...</div>
            </div>
        `;
    }

    _attachEventListeners() {
        // Back button
        const backBtn = this.container.querySelector('#btn-back');
        if (backBtn) {
            backBtn.onclick = () => {
                if (this.selectedGame) {
                    this.selectedGame = null;
                    this.gameStats = null;
                    this.render();
                } else {
                    this.onBack();
                }
            };
        }

        // Game stat buttons
        this.container.querySelectorAll('[data-action="view-game"]').forEach(btn => {
            btn.onclick = () => this.loadGameStats(btn.dataset.gameId);
        });
    }
}
