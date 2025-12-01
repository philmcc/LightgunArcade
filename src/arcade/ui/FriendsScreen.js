/**
 * FriendsScreen - Friends management UI
 * 
 * Features:
 * - View friends list with online status
 * - Send/accept/decline friend requests
 * - Search for users
 * - Recent players (people you've played with)
 * - Block/unblock users
 */
export class FriendsScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.friendService = options.friendService;
        this.sessionService = options.sessionService;
        this.onBack = options.onBack || (() => {});
        this.onViewProfile = options.onViewProfile || (() => {});
        
        this.currentTab = 'friends';
        this.friends = [];
        this.pendingRequests = [];
        this.searchResults = [];
        this.recentPlayers = [];
        this.sentRequests = [];
        this.isLoading = false;
    }

    async show() {
        this.render();
        await this.loadData();
    }

    async loadData() {
        this.isLoading = true;
        this.renderLoading();

        try {
            const promises = [
                this.friendService.getFriends(),
                this.friendService.getPendingRequests(),
                this.friendService.getSentRequests()
            ];
            
            // Only load recent players if sessionService is available
            if (this.sessionService) {
                promises.push(this.sessionService.getRecentlyPlayedWith(10));
            }

            const results = await Promise.all(promises);

            this.friends = results[0].friends || [];
            this.pendingRequests = results[1].requests || [];
            this.sentRequests = results[2].requests || [];
            
            if (results[3]) {
                this.recentPlayers = results[3].players || [];
            }
        } catch (error) {
            console.error('Failed to load friends data:', error);
        }

        this.isLoading = false;
        this.render();
    }

    render() {
        const pendingCount = this.pendingRequests.length;

        this.container.innerHTML = `
            <div class="screen friends-screen">
                <h1>FRIENDS</h1>
                
                <div class="tabs">
                    <button class="tab ${this.currentTab === 'friends' ? 'active' : ''}" data-tab="friends">
                        Friends (${this.friends.length})
                    </button>
                    <button class="tab ${this.currentTab === 'requests' ? 'active' : ''}" data-tab="requests">
                        Requests ${pendingCount > 0 ? `<span class="badge">${pendingCount}</span>` : ''}
                    </button>
                    <button class="tab ${this.currentTab === 'recent' ? 'active' : ''}" data-tab="recent">
                        Recent Players
                    </button>
                    <button class="tab ${this.currentTab === 'search' ? 'active' : ''}" data-tab="search">
                        Find Friends
                    </button>
                </div>
                
                <div class="tab-content">
                    ${this._renderTabContent()}
                </div>
                
                <button id="btn-back" class="back-btn">BACK</button>
            </div>
        `;

        this._attachEventListeners();
    }

    _renderTabContent() {
        switch (this.currentTab) {
            case 'friends':
                return this._renderFriendsList();
            case 'requests':
                return this._renderRequests();
            case 'recent':
                return this._renderRecentPlayers();
            case 'search':
                return this._renderSearch();
            default:
                return '';
        }
    }

    _renderFriendsList() {
        if (this.friends.length === 0) {
            return `
                <div class="empty-state">
                    <p>No friends yet!</p>
                    <p class="hint">Search for players to add them as friends.</p>
                </div>
            `;
        }

        return `
            <div class="friends-list">
                ${this.friends.map(friend => `
                    <div class="friend-item" data-user-id="${friend.id}">
                        <div class="friend-avatar">
                            ${friend.avatar_url 
                                ? `<img src="${friend.avatar_url}" alt="${friend.username}">`
                                : '<span class="avatar-placeholder">👤</span>'
                            }
                            <span class="status-dot ${friend.isOnline ? 'online' : 'offline'}"></span>
                        </div>
                        <div class="friend-info">
                            <span class="friend-name">${friend.display_name || friend.username}</span>
                            <span class="friend-username">@${friend.username}</span>
                        </div>
                        <div class="friend-actions">
                            <button class="btn-small btn-remove" data-action="remove" data-user-id="${friend.id}">
                                Remove
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderRequests() {
        const hasIncoming = this.pendingRequests.length > 0;
        const hasSent = this.sentRequests.length > 0;
        
        if (!hasIncoming && !hasSent) {
            return `
                <div class="empty-state">
                    <p>No pending requests</p>
                </div>
            `;
        }

        let html = '<div class="requests-list">';
        
        // Incoming requests
        if (hasIncoming) {
            html += `<h3 class="requests-section-title">Incoming Requests</h3>`;
            html += this.pendingRequests.map(request => {
                const user = request.from || request;
                return `
                    <div class="request-item" data-request-id="${request.requestId}">
                        <div class="friend-avatar">
                            ${user.avatar_url 
                                ? `<img src="${user.avatar_url}" alt="${user.username}">`
                                : '<span class="avatar-placeholder">👤</span>'
                            }
                        </div>
                        <div class="friend-info">
                            <span class="friend-name">${user.display_name || user.username}</span>
                            <span class="friend-username">@${user.username}</span>
                        </div>
                        <div class="request-actions">
                            <button class="btn-small btn-accept" data-action="accept" data-request-id="${request.requestId}">
                                Accept
                            </button>
                            <button class="btn-small btn-decline" data-action="decline" data-request-id="${request.requestId}">
                                Decline
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Sent requests
        if (hasSent) {
            html += `<h3 class="requests-section-title">Sent Requests</h3>`;
            html += this.sentRequests.map(request => {
                const user = request.to || request;
                return `
                    <div class="request-item sent" data-request-id="${request.requestId}">
                        <div class="friend-avatar">
                            ${user.avatar_url 
                                ? `<img src="${user.avatar_url}" alt="${user.username}">`
                                : '<span class="avatar-placeholder">👤</span>'
                            }
                        </div>
                        <div class="friend-info">
                            <span class="friend-name">${user.display_name || user.username}</span>
                            <span class="friend-username">@${user.username}</span>
                            <span class="status-text pending">Pending...</span>
                        </div>
                        <div class="request-actions">
                            <button class="btn-small btn-decline" data-action="cancel" data-request-id="${request.requestId}">
                                Cancel
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        html += '</div>';
        return html;
    }

    _renderRecentPlayers() {
        if (this.recentPlayers.length === 0) {
            return `
                <div class="empty-state">
                    <p>No recent players</p>
                    <p class="hint">Play multiplayer games to see players here.</p>
                </div>
            `;
        }

        return `
            <div class="recent-players-list">
                ${this.recentPlayers.map(player => {
                    const isFriend = this.friends.some(f => f.id === player.id);
                    const hasPending = this.sentRequests.some(r => r.to?.id === player.id);

                    return `
                        <div class="recent-player-item" data-user-id="${player.id}">
                            <div class="friend-avatar">
                                ${player.avatar_url 
                                    ? `<img src="${player.avatar_url}" alt="${player.username}">`
                                    : '<span class="avatar-placeholder">👤</span>'
                                }
                            </div>
                            <div class="friend-info">
                                <span class="friend-name">${player.display_name || player.username}</span>
                                <span class="friend-username">@${player.username}</span>
                                <span class="recent-info">Played ${player.lastGame} • ${this._formatTimeAgo(player.lastPlayedAt)}</span>
                            </div>
                            <div class="friend-actions">
                                ${isFriend 
                                    ? '<span class="status-text">Already friends</span>'
                                    : hasPending
                                        ? '<span class="status-text">Request sent</span>'
                                        : `<button class="btn-small btn-add" data-action="add-by-id" data-user-id="${player.id}">Add Friend</button>`
                                }
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    _formatTimeAgo(dateString) {
        if (!dateString) return 'recently';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    _renderSearch() {
        return `
            <div class="search-section">
                <div class="search-input-group">
                    <input type="text" id="search-input" placeholder="Search by username..." maxlength="20">
                    <button id="btn-search" class="btn-primary">Search</button>
                </div>
                
                <div class="search-results" id="search-results">
                    ${this._renderSearchResults()}
                </div>
            </div>
        `;
    }

    _renderSearchResults() {
        if (this.searchResults.length === 0) {
            return '<div class="empty-state"><p>Enter a username to search</p></div>';
        }

        return this.searchResults.map(user => {
            const isFriend = this.friends.some(f => f.id === user.id);
            const hasPending = user.hasPendingRequest;

            return `
                <div class="search-result-item" data-user-id="${user.id}">
                    <div class="friend-avatar">
                        ${user.avatar_url 
                            ? `<img src="${user.avatar_url}" alt="${user.username}">`
                            : '<span class="avatar-placeholder">👤</span>'
                        }
                    </div>
                    <div class="friend-info">
                        <span class="friend-name">${user.display_name || user.username}</span>
                        <span class="friend-username">@${user.username}</span>
                    </div>
                    <div class="friend-actions">
                        ${isFriend 
                            ? '<span class="status-text">Already friends</span>'
                            : hasPending
                                ? '<span class="status-text">Request pending</span>'
                                : `<button class="btn-small btn-add" data-action="add" data-username="${user.username}">Add Friend</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="screen friends-screen">
                <h1>FRIENDS</h1>
                <div class="loading">Loading...</div>
            </div>
        `;
    }

    _attachEventListeners() {
        // Tab switching
        this.container.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                this.currentTab = tab.dataset.tab;
                this.render();
            };
        });

        // Back button
        const backBtn = this.container.querySelector('#btn-back');
        if (backBtn) {
            backBtn.onclick = () => this.onBack();
        }

        // Search
        const searchBtn = this.container.querySelector('#btn-search');
        const searchInput = this.container.querySelector('#search-input');
        if (searchBtn && searchInput) {
            searchBtn.onclick = () => this._handleSearch(searchInput.value);
            searchInput.onkeypress = (e) => {
                if (e.key === 'Enter') this._handleSearch(searchInput.value);
            };
        }

        // Action buttons
        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = () => this._handleAction(btn.dataset.action, btn.dataset);
        });
    }

    async _handleSearch(query) {
        if (!query || query.length < 2) return;

        const resultsContainer = this.container.querySelector('#search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
        }

        const { users } = await this.friendService.searchUsers(query);
        this.searchResults = users || [];

        if (resultsContainer) {
            resultsContainer.innerHTML = this._renderSearchResults();
            // Re-attach action listeners for new results
            resultsContainer.querySelectorAll('[data-action]').forEach(btn => {
                btn.onclick = () => this._handleAction(btn.dataset.action, btn.dataset);
            });
        }
    }

    async _handleAction(action, data) {
        try {
            let result;
            switch (action) {
                case 'add':
                    result = await this.friendService.sendFriendRequestByUsername(data.username);
                    if (result.error) {
                        this._showNotification(result.error.message, 'error');
                    } else {
                        this._showNotification('Friend request sent!');
                    }
                    await this._handleSearch(this.container.querySelector('#search-input')?.value);
                    break;

                case 'add-by-id':
                    result = await this.friendService.sendFriendRequest(data.userId);
                    if (result.error) {
                        this._showNotification(result.error.message, 'error');
                    } else {
                        this._showNotification('Friend request sent!');
                    }
                    await this.loadData();
                    break;

                case 'accept':
                    result = await this.friendService.acceptFriendRequest(data.requestId);
                    if (result.error) {
                        this._showNotification(result.error.message, 'error');
                    } else {
                        this._showNotification('Friend request accepted!');
                    }
                    await this.loadData();
                    break;

                case 'decline':
                    result = await this.friendService.declineFriendRequest(data.requestId);
                    if (result.error) {
                        this._showNotification(result.error.message, 'error');
                    }
                    await this.loadData();
                    break;

                case 'remove':
                    if (confirm('Remove this friend?')) {
                        result = await this.friendService.removeFriend(data.userId);
                        if (result.error) {
                            this._showNotification(result.error.message, 'error');
                        }
                        await this.loadData();
                    }
                    break;

                case 'cancel':
                    result = await this.friendService.cancelFriendRequest(data.requestId);
                    if (result.error) {
                        this._showNotification(result.error.message, 'error');
                    } else {
                        this._showNotification('Friend request cancelled');
                    }
                    await this.loadData();
                    break;
            }
        } catch (error) {
            console.error('Action failed:', error);
            this._showNotification(error.message || 'Action failed', 'error');
        }
    }

    _showNotification(message, type = 'success') {
        // Simple notification - could be enhanced
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        this.container.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}
