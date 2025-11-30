/**
 * FriendsScreen - Friends management UI
 * 
 * Features:
 * - View friends list with online status
 * - Send/accept/decline friend requests
 * - Search for users
 * - Block/unblock users
 */
export class FriendsScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.friendService = options.friendService;
        this.onBack = options.onBack || (() => {});
        this.onViewProfile = options.onViewProfile || (() => {});
        
        this.currentTab = 'friends';
        this.friends = [];
        this.pendingRequests = [];
        this.searchResults = [];
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
            const [friendsResult, pendingResult] = await Promise.all([
                this.friendService.getFriends(),
                this.friendService.getPendingRequests()
            ]);

            this.friends = friendsResult.friends || [];
            this.pendingRequests = pendingResult.requests || [];
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
        if (this.pendingRequests.length === 0) {
            return `
                <div class="empty-state">
                    <p>No pending requests</p>
                </div>
            `;
        }

        return `
            <div class="requests-list">
                ${this.pendingRequests.map(request => `
                    <div class="request-item" data-request-id="${request.id}">
                        <div class="friend-avatar">
                            ${request.avatar_url 
                                ? `<img src="${request.avatar_url}" alt="${request.username}">`
                                : '<span class="avatar-placeholder">👤</span>'
                            }
                        </div>
                        <div class="friend-info">
                            <span class="friend-name">${request.display_name || request.username}</span>
                            <span class="friend-username">@${request.username}</span>
                        </div>
                        <div class="request-actions">
                            <button class="btn-small btn-accept" data-action="accept" data-request-id="${request.id}">
                                Accept
                            </button>
                            <button class="btn-small btn-decline" data-action="decline" data-request-id="${request.id}">
                                Decline
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
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
            switch (action) {
                case 'add':
                    await this.friendService.sendFriendRequestByUsername(data.username);
                    this._showNotification('Friend request sent!');
                    await this._handleSearch(this.container.querySelector('#search-input')?.value);
                    break;

                case 'accept':
                    await this.friendService.acceptFriendRequest(data.requestId);
                    this._showNotification('Friend request accepted!');
                    await this.loadData();
                    break;

                case 'decline':
                    await this.friendService.declineFriendRequest(data.requestId);
                    await this.loadData();
                    break;

                case 'remove':
                    if (confirm('Remove this friend?')) {
                        await this.friendService.removeFriend(data.userId);
                        await this.loadData();
                    }
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
