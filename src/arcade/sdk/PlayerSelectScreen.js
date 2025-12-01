/**
 * PlayerSelectScreen - UI for selecting number of players and game mode
 * 
 * Shows:
 * - Player count selection (1-4 players based on game manifest)
 * - Game mode selection (coop, versus, etc. based on manifest)
 * - Gun assignment status for each player slot
 * - User login/logout per player slot
 */

import { PlayerManager } from '../core/PlayerManager.js';

export class PlayerSelectScreen {
    /**
     * @param {HTMLElement} uiLayer - The UI layer to render into
     * @param {Object} options - Configuration options
     * @param {Object} options.manifest - Game manifest with multiplayer config
     * @param {Object} options.gunManager - Reference to GunManager
     * @param {Object} options.localPlayers - Reference to LocalPlayersManager
     * @param {Function} options.onStart - Called when game should start: (playerCount, mode, gunAssignments) => {}
     * @param {Function} options.onBack - Called when back button is pressed
     */
    constructor(uiLayer, options = {}) {
        this.uiLayer = uiLayer;
        this.gunManager = options.gunManager;
        this.localPlayers = options.localPlayers;
        this.manifest = options.manifest || {};
        this.onStart = options.onStart;
        this.onBack = options.onBack;

        // Extract multiplayer config from manifest
        const mp = this.manifest.multiplayer || {};
        this.minPlayers = mp.minPlayers || 1;
        this.maxPlayers = Math.min(mp.maxPlayers || 1, 4);
        this.supportedModes = mp.supportedModes || [];
        this.defaultMode = mp.defaultMode || (this.supportedModes[0]?.id || 'single');

        // Current selection state
        this.selectedPlayerCount = mp.defaultPlayers || this.minPlayers;
        this.selectedMode = this.defaultMode;
        this.gunAssignments = []; // Gun index for each player slot
        
        // Login UI state
        this.loginSlot = null; // Which slot is showing login form
    }

    /**
     * Show the player selection screen
     */
    show() {
        // Initialize gun assignments based on connected guns
        this._initGunAssignments();

        this.uiLayer.innerHTML = `
            <div class="screen player-select-screen">
                <h1>PLAYER SELECT</h1>
                
                <div class="player-count-section">
                    <h3>NUMBER OF PLAYERS</h3>
                    <div class="player-count-buttons" id="player-count-buttons">
                        ${this._renderPlayerCountButtons()}
                    </div>
                </div>

                ${this.supportedModes.length > 0 ? `
                <div class="game-mode-section" id="game-mode-section">
                    <h3>GAME MODE</h3>
                    <div class="mode-buttons" id="mode-buttons">
                        ${this._renderModeButtons()}
                    </div>
                </div>
                ` : ''}

                <div class="player-slots-section">
                    <h3>PLAYERS</h3>
                    <div class="player-slots" id="player-slots">
                        ${this._renderPlayerSlots()}
                    </div>
                </div>

                <div class="action-buttons">
                    <button id="btn-start-game" class="btn-primary btn-large">START GAME</button>
                    <button id="btn-back">BACK</button>
                </div>
            </div>
        `;

        this._bindEvents();
        this._updateUI();
    }

    /**
     * Initialize gun assignments from connected guns
     * @private
     */
    _initGunAssignments() {
        this.gunAssignments = [];
        
        if (!this.gunManager) {
            // No gun manager, use default assignments
            for (let i = 0; i < this.maxPlayers; i++) {
                this.gunAssignments.push(i);
            }
            return;
        }

        // Assign connected guns to player slots
        const guns = this.gunManager.guns;
        for (let i = 0; i < this.maxPlayers; i++) {
            const gun = guns[i];
            if (gun && (gun.config.hidDeviceId || gun.config.pointerId)) {
                this.gunAssignments.push(i);
            } else {
                this.gunAssignments.push(null); // No gun assigned
            }
        }
    }

    /**
     * Render player count selection buttons
     * @private
     */
    _renderPlayerCountButtons() {
        let html = '';
        for (let i = this.minPlayers; i <= this.maxPlayers; i++) {
            const isSelected = i === this.selectedPlayerCount;
            html += `
                <button class="player-count-btn ${isSelected ? 'selected' : ''}" 
                        data-count="${i}">
                    ${i}P
                </button>
            `;
        }
        return html;
    }

    /**
     * Render game mode selection buttons
     * @private
     */
    _renderModeButtons() {
        if (this.supportedModes.length === 0) return '';

        return this.supportedModes.map(mode => {
            const isSelected = mode.id === this.selectedMode;
            const icon = mode.type === 'cooperative' ? '🤝' : '⚔️';
            return `
                <button class="mode-btn ${isSelected ? 'selected' : ''}" 
                        data-mode="${mode.id}">
                    <span class="mode-icon">${icon}</span>
                    <span class="mode-name">${mode.name}</span>
                </button>
            `;
        }).join('');
    }

    /**
     * Render player slot cards
     * @private
     */
    _renderPlayerSlots() {
        let html = '';
        for (let i = 0; i < this.maxPlayers; i++) {
            const colors = PlayerManager.PLAYER_COLORS[i];
            const isActive = i < this.selectedPlayerCount;
            const gunIndex = this.gunAssignments[i];
            const hasGun = gunIndex !== null && this._isGunConnected(gunIndex);
            
            // Get user info from LocalPlayersManager
            const slot = this.localPlayers?.getSlot(i);
            const user = slot?.user;
            const isLoggedIn = slot?.isLoggedIn || false;
            
            html += `
                <div class="player-slot ${isActive ? 'active' : 'inactive'}" 
                     data-slot="${i}"
                     style="--player-color: ${colors.primary}; --player-color-light: ${colors.secondary};">
                    <div class="slot-header">
                        <span class="player-number">P${i + 1}</span>
                        <span class="player-color-indicator" style="background: ${colors.primary};"></span>
                    </div>
                    
                    <div class="slot-user">
                        ${user ? `
                            <div class="user-info">
                                ${user.avatar_url ? 
                                    `<img src="${user.avatar_url}" class="slot-avatar" alt="">` : 
                                    `<div class="slot-avatar-placeholder">👤</div>`
                                }
                                <span class="user-name">${user.display_name || user.username}</span>
                                ${isLoggedIn ? '<span class="logged-in-badge">✓</span>' : '<span class="guest-badge">GUEST</span>'}
                            </div>
                            ${isActive ? `
                                <button class="slot-login-btn" data-slot="${i}" data-action="${isLoggedIn ? 'logout' : 'login'}">
                                    ${isLoggedIn ? 'LOGOUT' : 'LOGIN'}
                                </button>
                            ` : ''}
                        ` : `
                            ${isActive ? `
                                <button class="slot-login-btn" data-slot="${i}" data-action="login">LOGIN</button>
                            ` : '<span class="slot-empty-user">—</span>'}
                        `}
                    </div>
                    
                    <div class="slot-status">
                        ${isActive ? (hasGun ? 
                            `<span class="gun-ready">🎯 GUN ${gunIndex + 1}</span>` : 
                            `<span class="gun-missing">🖱️ MOUSE</span>`
                        ) : '<span class="slot-empty">—</span>'}
                    </div>
                </div>
            `;
        }
        return html;
    }

    /**
     * Check if a gun is connected
     * @private
     */
    _isGunConnected(gunIndex) {
        if (!this.gunManager) return false;
        const gun = this.gunManager.guns[gunIndex];
        return gun && (gun.config.hidDeviceId || gun.config.pointerId);
    }

    /**
     * Bind event handlers
     * @private
     */
    _bindEvents() {
        // Player count buttons
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.onclick = () => {
                this.selectedPlayerCount = parseInt(btn.dataset.count);
                this._updateUI();
                this._bindSlotLoginButtons();
            };
        });

        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.onclick = () => {
                this.selectedMode = btn.dataset.mode;
                this._updateUI();
            };
        });

        // Start button
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn && this.onStart) {
            startBtn.onclick = () => {
                // Mark active slots
                for (let i = 0; i < this.maxPlayers; i++) {
                    this.localPlayers?.setSlotActive(i, i < this.selectedPlayerCount);
                }
                
                const assignments = this.gunAssignments.slice(0, this.selectedPlayerCount);
                this.onStart(this.selectedPlayerCount, this.selectedMode, assignments);
            };
        }

        // Back button
        const backBtn = document.getElementById('btn-back');
        if (backBtn && this.onBack) {
            backBtn.onclick = this.onBack;
        }
        
        // Slot login/logout buttons
        this._bindSlotLoginButtons();
    }
    
    /**
     * Bind login/logout button handlers for player slots
     * @private
     */
    _bindSlotLoginButtons() {
        document.querySelectorAll('.slot-login-btn').forEach(btn => {
            btn.onclick = async () => {
                const slotIndex = parseInt(btn.dataset.slot);
                const action = btn.dataset.action;
                
                if (action === 'logout') {
                    await this.localPlayers?.logoutFromSlot(slotIndex);
                    this._updateUI();
                    this._bindSlotLoginButtons();
                } else {
                    this._showSlotLogin(slotIndex);
                }
            };
        });
    }
    
    /**
     * Show login form for a specific slot
     * @private
     */
    _showSlotLogin(slotIndex) {
        this.loginSlot = slotIndex;
        const colors = PlayerManager.PLAYER_COLORS[slotIndex];
        
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
            this.localPlayers?.setSlotAsGuest(slotIndex);
            this.loginSlot = null;
            this.show();
        };
        document.getElementById('btn-slot-back').onclick = () => {
            this.loginSlot = null;
            this.show();
        };
    }
    
    /**
     * Show registration form for a specific slot
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
        document.getElementById('btn-slot-login-link').onclick = () => this._showSlotLogin(slotIndex);
        document.getElementById('btn-slot-back').onclick = () => {
            this.loginSlot = null;
            this.show();
        };
    }
    
    /**
     * Handle login form submission for a slot
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
        
        const { user, error } = await this.localPlayers?.loginToSlot(slotIndex, email, password);
        
        if (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
        } else {
            this.loginSlot = null;
            this.show();
        }
    }
    
    /**
     * Handle registration form submission for a slot
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
        
        const { user, error } = await this.localPlayers?.registerToSlot(slotIndex, email, password, username);
        
        if (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
        } else {
            this.loginSlot = null;
            this.show();
        }
    }

    /**
     * Update UI to reflect current selection
     * @private
     */
    _updateUI() {
        // Update player count buttons
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            const count = parseInt(btn.dataset.count);
            btn.classList.toggle('selected', count === this.selectedPlayerCount);
        });

        // Update mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.mode === this.selectedMode);
        });

        // Show/hide mode section based on player count
        const modeSection = document.getElementById('game-mode-section');
        if (modeSection) {
            modeSection.style.display = this.selectedPlayerCount > 1 ? 'block' : 'none';
        }

        // Update player slots
        const slotsContainer = document.getElementById('player-slots');
        if (slotsContainer) {
            slotsContainer.innerHTML = this._renderPlayerSlots();
            // Re-bind login buttons after re-rendering slots
            this._bindSlotLoginButtons();
        }

        // Update start button state
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            // Check if all active players have guns
            const allPlayersReady = this._checkAllPlayersReady();
            startBtn.disabled = !allPlayersReady;
            startBtn.textContent = allPlayersReady ? 'START GAME' : 'ASSIGN GUNS FIRST';
        }
    }

    /**
     * Check if all active player slots have guns assigned
     * @private
     */
    _checkAllPlayersReady() {
        for (let i = 0; i < this.selectedPlayerCount; i++) {
            const gunIndex = this.gunAssignments[i];
            if (gunIndex === null || !this._isGunConnected(gunIndex)) {
                // For single player, allow starting without gun (mouse fallback)
                if (this.selectedPlayerCount === 1) {
                    return true;
                }
                return false;
            }
        }
        return true;
    }
}
