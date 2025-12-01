import { Settings } from '../../shared/Settings.js';
import { SoundManager } from '../../shared/SoundManager.js';
import { GlobalHighScores } from '../GlobalHighScores.js';
import { GameRegistry } from './GameRegistry.js';
import { AuthService } from '../services/AuthService.js';
import { UserService } from '../services/UserService.js';
import { ScoreService } from '../services/ScoreService.js';
import { LeaderboardService } from '../services/LeaderboardService.js';
import { FriendService } from '../services/FriendService.js';
import { ActivityService } from '../services/ActivityService.js';
import { SessionService } from '../services/SessionService.js';
import { StatsService } from '../services/StatsService.js';
import { NotificationService } from '../services/NotificationService.js';
import { GunManager } from './GunManager.js';
import { LocalPlayersManager } from './LocalPlayersManager.js';
import { PlayerManager } from './PlayerManager.js';
import { GunSetupMenu } from '../ui/GunSetupMenu.js';
import { SettingsScreen } from '../sdk/SettingsScreen.js';
import { FriendsScreen } from '../ui/FriendsScreen.js';
import { StatsScreen } from '../ui/StatsScreen.js';
import { ActivityFeedScreen } from '../ui/ActivityFeedScreen.js';
import { LeaderboardScreen } from '../ui/LeaderboardScreen.js';
import { EditProfileScreen } from '../ui/EditProfileScreen.js';
import { ProfileViewScreen } from '../ui/ProfileViewScreen.js';

export class ArcadeSystem {
    constructor(canvas, uiLayer) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;
        this.ctx = canvas.getContext('2d');

        this.settings = new Settings();
        this.soundManager = new SoundManager(); // Shared SoundManager for all games
        this.globalHighScores = new GlobalHighScores();
        this.registry = new GameRegistry();
        
        // Auth and user services
        this.auth = new AuthService();
        this.users = new UserService(this.auth);
        this.scores = new ScoreService(this.auth);
        this.leaderboards = new LeaderboardService(this.auth);
        this.friends = new FriendService(this.auth, this.users);
        this.activity = new ActivityService(this.auth);
        this.sessions = new SessionService(this.auth);
        this.stats = new StatsService(this.auth);
        this.notifications = new NotificationService(this.auth);
        
        // Gun management
        this.gunManager = new GunManager();
        this.gunSetupMenu = new GunSetupMenu(this);
        
        // Local multiplayer - multiple users on same device
        this.localPlayers = new LocalPlayersManager(this.auth);

        this.init();

        this.currentGame = null;
        this.state = 'ARCADE_MENU'; // ARCADE_MENU, PLAYING_GAME, HIGH_SCORES, SETTINGS, PROFILE

        // Centralized resize handling
        this._handleResize = this._handleResize.bind(this);
        this._handleResize();
        window.addEventListener('resize', this._handleResize);
    }

    async init() {
        // Wait for auth to initialize
        await this.auth.waitForInit();
        
        // Listen for auth state changes to update UI
        this.auth.addListener(async () => {
            console.log('ArcadeSystem: Auth state changed, current state:', this.state);
            
            // Initialize or cleanup social services based on auth state
            if (!this.auth.isGuest()) {
                // User logged in - initialize presence and notifications
                await this.friends.initPresence();
                await this.notifications.init();
            } else {
                // User logged out - cleanup
                this.friends.cleanupPresence();
                this.notifications.cleanup();
            }
            
            // If we're on the login screen and user just signed in, go to profile
            if (this.state === 'LOGIN' && !this.auth.isGuest()) {
                console.log('ArcadeSystem: User signed in, showing profile');
                this.showProfile();
            }
            // If we're on profile and user signed out, refresh the profile view
            else if (this.state === 'PROFILE') {
                console.log('ArcadeSystem: Refreshing profile view');
                this.showProfile();
            }
        });
        
        await this.gunManager.init();
        
        // Link settings with gunManager for cursor control
        this.settings.gunManager = this.gunManager;
        
        // Set the target canvas for gun coordinate mapping
        this.gunManager.setTargetCanvas(this.canvas);
        
        // Apply the in-game cursor visibility setting
        this.gunManager.setShowCursorsInGame(this.settings.showGunCursors);
        
        // Start in menu mode (not in game)
        this.gunManager.setInGame(false);
        
        // Sync local players slot 0 with primary auth
        this.localPlayers.syncWithPrimaryAuth();
        
        // Keep slot 0 in sync with primary auth changes
        this.auth.addListener(() => {
            this.localPlayers.syncWithPrimaryAuth();
        });
        
        // Update last active periodically
        this._startActivityTracking();
    }

    /**
     * Start periodic activity tracking
     */
    _startActivityTracking() {
        // Update last active every 5 minutes
        setInterval(() => {
            this.users.updateLastActive();
        }, 5 * 60 * 1000);
    }

    /**
     * Internal resize handler - routes to game if active.
     */
    _handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Always update canvas size
        this.canvas.width = width;
        this.canvas.height = height;

        // Notify current game if one is running
        if (this.currentGame && typeof this.currentGame.onResize === 'function') {
            this.currentGame.onResize(width, height);
        }
    }

    /**
     * @deprecated Use _handleResize internally. Games should use onResize() hook.
     */
    resize() {
        this._handleResize();
    }

    /**
     * Registers a game class with the system.
     * @param {class} GameClass 
     */
    registerGame(GameClass) {
        this.registry.register(GameClass);
    }

    showArcadeMenu() {
        this.state = 'ARCADE_MENU';
        this.currentGame = null;
        
        // Not in game - cursors always visible
        this.gunManager.setInGame(false);
        const games = this.registry.getAllGames();
        const user = this.auth.getCurrentUser();

        this.uiLayer.innerHTML = `
            <div class="arcade-menu">
                <div class="arcade-header">
                    <h1 class="arcade-title">LIGHTGUN ARCADE</h1>
                    <div class="user-profile-widget" id="btn-profile">
                        <span class="user-name">${user?.display_name || user?.username || 'Guest'}</span>
                        ${user?.avatar_url 
                            ? `<img src="${user.avatar_url}" class="user-avatar" alt="avatar">`
                            : '<span class="user-icon">👤</span>'
                        }
                    </div>
                </div>
                
                <!-- Player Slots Bar -->
                <div class="player-slots-bar">
                    ${this._renderPlayerSlotsBar()}
                </div>
                
                <div class="game-grid">
                    ${games.map(game => `
                        <div class="game-card ${game.isAvailable ? '' : 'locked'}" 
                             data-game-id="${game.id}">
                            <div class="game-icon">
                                ${game.isAvailable ? '🎯' : '🔒'}
                            </div>
                            <h3>${game.name}</h3>
                            <p>${game.description}</p>
                            ${!game.isAvailable ? '<span class="coming-soon">COMING SOON</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="arcade-buttons">
                    <button id="btn-leaderboards">LEADERBOARDS</button>
                    <button id="btn-activity">ACTIVITY</button>
                    <button id="btn-arcade-highscores">LOCAL SCORES</button>
                    <button id="btn-arcade-settings">SETTINGS</button>
                    <button id="btn-gun-setup" class="btn-primary">GUN SETUP</button>
                </div>
            </div>
        `;

        // Add event listeners
        document.querySelectorAll('.game-card').forEach(card => {
            const gameId = card.dataset.gameId;
            const game = this.registry.getGame(gameId);

            if (game && game.isAvailable) {
                card.onclick = () => this.launchGame(gameId);
                card.style.cursor = 'pointer';
            }
        });

        document.getElementById('btn-leaderboards').onclick = () => this.showLeaderboards();
        document.getElementById('btn-activity').onclick = () => this.showActivityFeed();
        document.getElementById('btn-arcade-highscores').onclick = () => this.showGlobalHighScores();
        document.getElementById('btn-arcade-settings').onclick = () => this.showSettings();
        document.getElementById('btn-profile').onclick = () => this.showProfile();
        document.getElementById('btn-gun-setup').onclick = () => this.showGunSetup();
        
        // Player slot login buttons
        this._bindPlayerSlotButtons();
    }
    
    /**
     * Render the player slots bar for the arcade menu
     * @private
     */
    _renderPlayerSlotsBar() {
        let html = '';
        
        for (let i = 0; i < 4; i++) {
            const slot = this.localPlayers.getSlot(i);
            const colors = PlayerManager.PLAYER_COLORS[i];
            const user = slot?.user;
            const gun = this.localPlayers.getGunForSlot(i);
            const gunLabel = gun !== null ? `GUN ${gun + 1}` : 'NO GUN';
            
            html += `
                <div class="player-slot-chip ${user ? 'has-user' : 'empty'}" 
                     data-slot="${i}"
                     style="--player-color: ${colors.primary};">
                    <span class="slot-label">P${i + 1}</span>
                    ${user ? `
                        <span class="slot-user-name">${user.display_name || user.username}</span>
                        <span class="slot-gun-label">${gunLabel}</span>
                    ` : `
                        <span class="slot-login-text">TAP TO LOGIN</span>
                    `}
                </div>
            `;
        }
        return html;
    }
    
    /**
     * Bind click handlers for player slot chips
     * @private
     */
    _bindPlayerSlotButtons() {
        document.querySelectorAll('.player-slot-chip').forEach(chip => {
            chip.onclick = () => {
                const slotIndex = parseInt(chip.dataset.slot);
                this.showPlayerSlotLogin(slotIndex);
            };
        });
    }
    
    /**
     * Show login screen for a player slot
     * @param {number} slotIndex
     */
    showPlayerSlotLogin(slotIndex) {
        const colors = PlayerManager.PLAYER_COLORS[slotIndex];
        const slot = this.localPlayers.getSlot(slotIndex);
        const isLoggedIn = slot?.isLoggedIn;
        
        this.state = 'PLAYER_LOGIN';
        
        if (isLoggedIn) {
            // Show logout option
            this.uiLayer.innerHTML = `
                <div class="screen slot-login-screen" style="--player-color: ${colors.primary};">
                    <h1>PLAYER ${slotIndex + 1}</h1>
                    <div class="current-user-info">
                        <div class="user-avatar-large">
                            ${slot.user?.avatar_url 
                                ? `<img src="${slot.user.avatar_url}" alt="">` 
                                : '👤'}
                        </div>
                        <div class="user-name-large">${slot.user?.display_name || slot.user?.username}</div>
                        <div class="user-email">${slot.user?.email || ''}</div>
                    </div>
                    <div class="login-form">
                        <button id="btn-slot-logout" class="btn-danger">LOGOUT</button>
                        <button id="btn-slot-back">BACK</button>
                    </div>
                </div>
            `;
            
            document.getElementById('btn-slot-logout').onclick = async () => {
                await this.localPlayers.logoutFromSlot(slotIndex);
                this.showArcadeMenu();
            };
            document.getElementById('btn-slot-back').onclick = () => this.showArcadeMenu();
        } else {
            // Show login form
            this.uiLayer.innerHTML = `
                <div class="screen slot-login-screen" style="--player-color: ${colors.primary};">
                    <h1>LOGIN - PLAYER ${slotIndex + 1}</h1>
                    
                    <div class="login-form">
                        <input type="email" id="slot-email" placeholder="Email" />
                        <input type="password" id="slot-password" placeholder="Password" />
                        <div id="slot-login-error" class="error-message" style="display: none;"></div>
                        <button id="btn-slot-login" class="btn-primary">SIGN IN</button>
                        <div class="login-divider">or</div>
                        <button id="btn-slot-register" class="btn-secondary">CREATE ACCOUNT</button>
                        <button id="btn-slot-guest">PLAY AS GUEST</button>
                        <button id="btn-slot-back">BACK</button>
                    </div>
                </div>
            `;
            
            document.getElementById('btn-slot-login').onclick = () => this._handleSlotLogin(slotIndex);
            document.getElementById('btn-slot-register').onclick = () => this._showSlotRegister(slotIndex);
            document.getElementById('btn-slot-guest').onclick = () => {
                this.localPlayers.setSlotAsGuest(slotIndex);
                this.showArcadeMenu();
            };
            document.getElementById('btn-slot-back').onclick = () => this.showArcadeMenu();
        }
    }
    
    /**
     * Handle slot login
     * @private
     */
    async _handleSlotLogin(slotIndex) {
        const email = document.getElementById('slot-email').value;
        const password = document.getElementById('slot-password').value;
        const errorEl = document.getElementById('slot-login-error');
        
        if (!email || !password) {
            errorEl.textContent = 'Please enter email and password';
            errorEl.style.display = 'block';
            return;
        }
        
        errorEl.style.display = 'none';
        
        const { user, error } = await this.localPlayers.loginToSlot(slotIndex, email, password);
        
        if (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
        } else {
            this.showArcadeMenu();
        }
    }
    
    /**
     * Show registration form for a slot
     * @private
     */
    _showSlotRegister(slotIndex) {
        const colors = PlayerManager.PLAYER_COLORS[slotIndex];
        
        this.uiLayer.innerHTML = `
            <div class="screen slot-login-screen" style="--player-color: ${colors.primary};">
                <h1>REGISTER - PLAYER ${slotIndex + 1}</h1>
                
                <div class="login-form">
                    <input type="text" id="slot-username" placeholder="Username" />
                    <input type="email" id="slot-email" placeholder="Email" />
                    <input type="password" id="slot-password" placeholder="Password" />
                    <input type="password" id="slot-password-confirm" placeholder="Confirm Password" />
                    <div id="slot-login-error" class="error-message" style="display: none;"></div>
                    <button id="btn-slot-register" class="btn-primary">CREATE ACCOUNT</button>
                    <div class="login-divider">or</div>
                    <button id="btn-slot-login-link">ALREADY HAVE AN ACCOUNT?</button>
                    <button id="btn-slot-back">BACK</button>
                </div>
            </div>
        `;
        
        document.getElementById('btn-slot-register').onclick = () => this._handleSlotRegister(slotIndex);
        document.getElementById('btn-slot-login-link').onclick = () => this.showPlayerSlotLogin(slotIndex);
        document.getElementById('btn-slot-back').onclick = () => this.showArcadeMenu();
    }
    
    /**
     * Handle slot registration
     * @private
     */
    async _handleSlotRegister(slotIndex) {
        const username = document.getElementById('slot-username').value;
        const email = document.getElementById('slot-email').value;
        const password = document.getElementById('slot-password').value;
        const passwordConfirm = document.getElementById('slot-password-confirm').value;
        const errorEl = document.getElementById('slot-login-error');
        
        if (!username || !email || !password) {
            errorEl.textContent = 'Please fill in all fields';
            errorEl.style.display = 'block';
            return;
        }
        
        if (password !== passwordConfirm) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.style.display = 'block';
            return;
        }
        
        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters';
            errorEl.style.display = 'block';
            return;
        }
        
        errorEl.style.display = 'none';
        
        const { user, error } = await this.localPlayers.registerToSlot(slotIndex, email, password, username);
        
        if (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
        } else {
            this.showArcadeMenu();
        }
    }

    async launchGame(gameId) {
        const gameRegistration = this.registry.getGame(gameId);
        if (!gameRegistration || !gameRegistration.isAvailable) return;

        try {
            this.state = 'PLAYING_GAME';
            
            // In game - cursor visibility controlled by setting
            this.gunManager.setInGame(true);
            
            // Update presence to show playing this game
            this.friends.updateCurrentGame(gameId, gameRegistration.name);
            
            // Instantiate the game class
            this.currentGame = new gameRegistration.GameClass(this.canvas, this.uiLayer, this);

            // Initialize the game
            await this.currentGame.init();

        } catch (error) {
            console.error("Failed to launch game:", error);
            this.friends.updateCurrentGame(null); // Clear game presence on error
            this.showArcadeMenu(); // Fallback to menu on error
            // TODO: Show error notification to user
        }
    }

    returnToArcade() {
        if (this.currentGame) {
            // Use SDK cleanup which calls destroy() internally
            if (typeof this.currentGame._cleanup === 'function') {
                this.currentGame._cleanup();
            } else {
                this.currentGame.destroy();
            }
            this.currentGame = null;
        }
        
        // Clear game presence
        this.friends.updateCurrentGame(null);
        
        // Leaving game - cursors always visible in menus
        this.gunManager.setInGame(false);
        this.showArcadeMenu();
    }

    showProfile() {
        this.state = 'PROFILE';
        const user = this.auth.getCurrentUser();
        const isGuest = this.auth.isGuest();

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>USER PROFILE</h1>
                <div class="profile-card">
                    ${user?.avatar_url 
                        ? `<img src="${user.avatar_url}" class="profile-avatar" alt="avatar">`
                        : '<div class="profile-icon">👤</div>'
                    }
                    <h2>${user?.display_name || user?.username || 'Guest'}</h2>
                    <p class="profile-id">@${user?.username || 'guest'}</p>
                    ${isGuest ? '<span class="guest-badge">GUEST</span>' : ''}
                </div>
                
                ${isGuest ? `
                    <div class="auth-prompt">
                        <p>Sign in to save your scores online and compete on leaderboards!</p>
                        <button id="btn-sign-in" class="btn-primary">SIGN IN / REGISTER</button>
                    </div>
                ` : `
                    <div class="profile-stats">
                        <div class="stat-item">
                            <span class="stat-value" id="stat-games">-</span>
                            <span class="stat-label">Games Played</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value" id="stat-friends">-</span>
                            <span class="stat-label">Friends</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value" id="stat-best">-</span>
                            <span class="stat-label">Best Score</span>
                        </div>
                    </div>
                    
                    <div class="profile-actions">
                        <button id="btn-edit-profile">EDIT PROFILE</button>
                        <button id="btn-view-stats">VIEW STATS</button>
                        <button id="btn-friends">FRIENDS</button>
                        <button id="btn-logout" class="danger-btn">SIGN OUT</button>
                    </div>
                `}

                <button id="btn-back-arcade" style="margin-top: 30px;">BACK TO ARCADE</button>
            </div>
        `;

        // Load stats for authenticated users
        if (!isGuest) {
            this._loadProfileStats();
        }

        // Event listeners
        const btnSignIn = document.getElementById('btn-sign-in');
        if (btnSignIn) {
            btnSignIn.onclick = () => this.showLoginScreen();
        }

        const btnEditProfile = document.getElementById('btn-edit-profile');
        if (btnEditProfile) {
            btnEditProfile.onclick = () => this.showEditProfile();
        }

        const btnViewStats = document.getElementById('btn-view-stats');
        if (btnViewStats) {
            btnViewStats.onclick = () => this.showStatsScreen();
        }

        const btnFriends = document.getElementById('btn-friends');
        if (btnFriends) {
            btnFriends.onclick = () => this.showFriendsScreen();
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = async () => {
                // Clear all local player slots first
                for (let i = 0; i < 4; i++) {
                    this.localPlayers.setSlotAsGuest(i);
                }
                await this.auth.signOut();
                this.showProfile();
            };
        }

        document.getElementById('btn-back-arcade').onclick = () => this.showArcadeMenu();
    }

    /**
     * Load and display profile stats
     */
    async _loadProfileStats() {
        const { stats } = await this.stats.getUserStats();
        if (stats) {
            const gamesEl = document.getElementById('stat-games');
            const friendsEl = document.getElementById('stat-friends');
            const bestEl = document.getElementById('stat-best');
            
            if (gamesEl) gamesEl.textContent = stats.totalGamesPlayed || 0;
            if (friendsEl) friendsEl.textContent = stats.friendCount || 0;
            if (bestEl) bestEl.textContent = stats.bestScore || 0;
        }
    }

    /**
     * Show login/register screen
     * TODO: Implement full login UI
     */
    showLoginScreen() {
        this.state = 'LOGIN';
        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>SIGN IN</h1>
                <p style="margin-bottom: 20px;">Sign in to save scores and compete!</p>
                
                <div class="auth-buttons">
                    <button id="btn-google" class="oauth-btn google">
                        <span>🔵</span> Continue with Google
                    </button>
                    <button id="btn-discord" class="oauth-btn discord">
                        <span>🟣</span> Continue with Discord
                    </button>
                    <button id="btn-github" class="oauth-btn github">
                        <span>⚫</span> Continue with GitHub
                    </button>
                </div>
                
                <div class="divider"><span>or</span></div>
                
                <div class="email-form">
                    <input type="email" id="input-email" placeholder="Email" />
                    <input type="password" id="input-password" placeholder="Password" />
                    <button id="btn-email-signin" class="btn-primary">SIGN IN</button>
                    <button id="btn-email-register">CREATE ACCOUNT</button>
                </div>
                
                <div id="auth-error" class="error-message" style="display: none;"></div>
                
                <button id="btn-back" style="margin-top: 30px;">BACK</button>
            </div>
        `;

        // OAuth buttons
        document.getElementById('btn-google').onclick = () => this._signInWithProvider('google');
        document.getElementById('btn-discord').onclick = () => this._signInWithProvider('discord');
        document.getElementById('btn-github').onclick = () => this._signInWithProvider('github');

        // Email sign in
        document.getElementById('btn-email-signin').onclick = () => this._signInWithEmail();
        document.getElementById('btn-email-register').onclick = () => this.showRegisterScreen();

        document.getElementById('btn-back').onclick = () => this.showProfile();
    }

    /**
     * Sign in with OAuth provider
     */
    async _signInWithProvider(provider) {
        const { error } = await this.auth.signInWithProvider(provider);
        if (error) {
            this._showAuthError(error.message);
        }
        // OAuth will redirect, so no need to handle success here
    }

    /**
     * Sign in with email/password
     */
    async _signInWithEmail() {
        const email = document.getElementById('input-email').value;
        const password = document.getElementById('input-password').value;

        if (!email || !password) {
            this._showAuthError('Please enter email and password');
            return;
        }

        const { error } = await this.auth.signIn(email, password);
        if (error) {
            this._showAuthError(error.message);
        } else {
            this.showProfile();
        }
    }

    /**
     * Show registration screen
     */
    showRegisterScreen() {
        this.state = 'REGISTER';
        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>CREATE ACCOUNT</h1>
                
                <div class="register-form">
                    <input type="text" id="input-username" placeholder="Username (3-20 chars)" maxlength="20" />
                    <input type="email" id="input-email" placeholder="Email" />
                    <input type="password" id="input-password" placeholder="Password (min 6 chars)" />
                    <input type="password" id="input-password-confirm" placeholder="Confirm Password" />
                    <button id="btn-register" class="btn-primary">CREATE ACCOUNT</button>
                </div>
                
                <div id="auth-error" class="error-message" style="display: none;"></div>
                
                <button id="btn-back" style="margin-top: 30px;">BACK TO SIGN IN</button>
            </div>
        `;

        document.getElementById('btn-register').onclick = () => this._register();
        document.getElementById('btn-back').onclick = () => this.showLoginScreen();
    }

    /**
     * Register new account
     */
    async _register() {
        const username = document.getElementById('input-username').value.trim();
        const email = document.getElementById('input-email').value;
        const password = document.getElementById('input-password').value;
        const passwordConfirm = document.getElementById('input-password-confirm').value;

        if (!username || !email || !password) {
            this._showAuthError('Please fill in all fields');
            return;
        }

        if (password !== passwordConfirm) {
            this._showAuthError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            this._showAuthError('Password must be at least 6 characters');
            return;
        }

        const { error } = await this.auth.signUp(email, password, username);
        if (error) {
            this._showAuthError(error.message);
        } else {
            // Show success message
            this.uiLayer.innerHTML = `
                <div class="screen">
                    <h1>CHECK YOUR EMAIL</h1>
                    <p>We've sent a confirmation link to ${email}</p>
                    <p>Click the link to activate your account.</p>
                    <button id="btn-back" style="margin-top: 30px;">BACK TO ARCADE</button>
                </div>
            `;
            document.getElementById('btn-back').onclick = () => this.showArcadeMenu();
        }
    }

    /**
     * Show auth error message
     */
    _showAuthError(message) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Show edit profile screen
     */
    showEditProfile() {
        this.state = 'EDIT_PROFILE';
        
        const screen = new EditProfileScreen(this.uiLayer, {
            userService: this.users,
            authService: this.auth,
            onBack: () => this.showProfile(),
            onSave: () => this.showProfile()
        });
        
        screen.show();
    }

    /**
     * Show stats dashboard screen
     */
    showStatsScreen() {
        this.state = 'STATS';
        
        const screen = new StatsScreen(this.uiLayer, {
            statsService: this.stats,
            gameRegistry: this.registry,
            onBack: () => this.showProfile()
        });
        
        screen.show();
    }

    /**
     * Show friends screen
     */
    showFriendsScreen() {
        this.state = 'FRIENDS';
        
        const screen = new FriendsScreen(this.uiLayer, {
            friendService: this.friends,
            sessionService: this.sessions,
            onBack: () => this.showProfile(),
            onViewProfile: (userId) => this.showUserProfile(userId, 'FRIENDS')
        });
        
        screen.show();
    }

    /**
     * Show another user's profile
     * @param {string} userId - User ID to view
     * @param {string} returnTo - State to return to on back (default: PROFILE)
     */
    showUserProfile(userId, returnTo = 'PROFILE') {
        this.state = 'VIEW_PROFILE';
        
        const currentUser = this.auth.getCurrentUser();
        const screen = new ProfileViewScreen(this.uiLayer, {
            userService: this.users,
            friendService: this.friends,
            statsService: this.stats,
            activityService: this.activity,
            currentUserId: currentUser?.id,
            onBack: () => {
                switch (returnTo) {
                    case 'FRIENDS':
                        this.showFriendsScreen();
                        break;
                    case 'LEADERBOARDS':
                        this.showLeaderboards();
                        break;
                    case 'ACTIVITY':
                        this.showActivityFeed();
                        break;
                    default:
                        this.showProfile();
                }
            },
            onViewProfile: (otherUserId) => this.showUserProfile(otherUserId, returnTo)
        });
        
        screen.show(userId);
    }

    /**
     * Show activity feed screen
     */
    showActivityFeed() {
        this.state = 'ACTIVITY';
        
        const user = this.auth.getCurrentUser();
        const screen = new ActivityFeedScreen(this.uiLayer, {
            activityService: this.activity,
            gameRegistry: this.registry,
            currentUserId: user?.id,
            onBack: () => this.showArcadeMenu()
        });
        
        screen.show();
    }

    /**
     * Show leaderboards screen
     */
    showLeaderboards(gameId = null) {
        this.state = 'LEADERBOARDS';
        
        const user = this.auth.getCurrentUser();
        const screen = new LeaderboardScreen(this.uiLayer, {
            leaderboardService: this.leaderboards,
            friendService: this.friends,
            gameRegistry: this.registry,
            currentUserId: user?.id,
            initialGame: gameId,
            onBack: () => this.showArcadeMenu(),
            onViewProfile: (userId) => this.showUserProfile(userId, 'LEADERBOARDS')
        });
        
        screen.show();
    }

    showGlobalHighScores() {
        this.state = 'HIGH_SCORES';
        const allScores = this.globalHighScores.getAllScores();
        const games = this.registry.getAllGames();

        let scoresHTML = '';
        if (allScores.length === 0) {
            scoresHTML = '<div class="no-scores">No high scores yet! Play some games!</div>';
        } else {
            scoresHTML = '<div class="highscore-table">';
            allScores.forEach((score, index) => {
                const game = games.find(g => g.id === score.game);
                const gameName = game ? game.name : score.game;
                const diffBadge = score.difficulty ? score.difficulty.charAt(0).toUpperCase() : '-';

                scoresHTML += `
                    <div class="score-row ${index < 3 ? 'top-three' : ''}">
                        <span class="rank">${index + 1}</span>
                        <span class="name" style="flex: 2; text-align: left;">${score.name}</span>
                        <span class="game-name" style="flex: 2; text-align: left; font-size: 0.9rem; color: #aaa;">${gameName}</span>
                        <span class="score">${score.score}</span>
                        <span class="diff-badge">${diffBadge}</span>
                    </div>
                `;
            });
            scoresHTML += '</div>';
        }

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>GLOBAL HIGH SCORES</h1>
                ${scoresHTML}
                <button id="btn-back-arcade">BACK TO ARCADE</button>
            </div>
        `;

        document.getElementById('btn-back-arcade').onclick = () => this.showArcadeMenu();
    }

    showSettings() {
        this.state = 'SETTINGS';
        
        // Use SDK SettingsScreen component
        const settingsScreen = new SettingsScreen(this.uiLayer, this.settings, {
            onBack: () => this.showArcadeMenu(),
            onGunSetup: () => {
                this.showGunSetup(() => this.showSettings());
            },
            showGunSetup: true
        });
        
        settingsScreen.show();
    }

    showGunSetup(returnCallback = null) {
        this.previousState = this.state;
        this.gunSetupReturnCallback = returnCallback;
        this.state = 'GUN_SETUP';
        this.gunSetupMenu.show();
    }

    returnFromGunSetup() {
        // Restore previous state before calling callback
        if (this.previousState) {
            this.state = this.previousState;
            this.previousState = null;
        }
        
        if (this.gunSetupReturnCallback) {
            this.gunSetupReturnCallback();
            this.gunSetupReturnCallback = null;
        } else {
            this.showArcadeMenu();
        }
    }

    update(dt) {
        if (this.currentGame && this.state === 'PLAYING_GAME') {
            this.currentGame.update(dt);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.currentGame && this.state === 'PLAYING_GAME') {
            this.currentGame.draw(this.ctx);
        }
    }
}
