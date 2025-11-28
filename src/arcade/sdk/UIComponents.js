/**
 * SDK UI Components
 * Provides reusable UI building blocks for games
 * All components are lightgun-friendly with large touch targets
 */

/**
 * MenuBuilder - Creates consistent menu screens
 */
export class MenuBuilder {
    constructor(uiLayer) {
        this.uiLayer = uiLayer;
    }

    /**
     * Create a full-screen menu container
     * @param {Object} options - Menu options
     * @param {string} options.title - Menu title
     * @param {string} options.subtitle - Optional subtitle
     * @param {Array} options.buttons - Array of button configs
     * @param {string} options.className - Additional CSS class
     * @returns {HTMLElement} The menu container
     */
    createScreen(options = {}) {
        const { title, subtitle, buttons = [], className = '' } = options;

        const screen = document.createElement('div');
        screen.className = `screen ${className}`.trim();

        let html = '';
        if (title) {
            html += `<h1>${title}</h1>`;
        }
        if (subtitle) {
            html += `<h2>${subtitle}</h2>`;
        }

        screen.innerHTML = html;

        // Add buttons
        if (buttons.length > 0) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'menu-buttons';
            buttonContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem; align-items: center;';

            buttons.forEach(btn => {
                const button = this.createButton(btn);
                buttonContainer.appendChild(button);
            });

            screen.appendChild(buttonContainer);
        }

        return screen;
    }

    /**
     * Create a button element
     * @param {Object} config - Button configuration
     * @param {string} config.id - Button ID
     * @param {string} config.text - Button text
     * @param {Function} config.onClick - Click handler
     * @param {string} config.className - Additional CSS class
     * @param {string} config.style - Inline styles
     * @returns {HTMLButtonElement}
     */
    createButton(config) {
        const { id, text, onClick, className = '', style = '' } = config;

        const button = document.createElement('button');
        if (id) button.id = id;
        button.textContent = text;
        button.className = className;
        if (style) button.style.cssText = style;
        if (onClick) button.onclick = onClick;

        return button;
    }

    /**
     * Create a button group (horizontal layout)
     * @param {Array} buttons - Array of button configs
     * @param {string} className - Container class
     * @returns {HTMLElement}
     */
    createButtonGroup(buttons, className = 'difficulty-select') {
        const container = document.createElement('div');
        container.className = className;

        buttons.forEach(btn => {
            const button = this.createButton(btn);
            container.appendChild(button);
        });

        return container;
    }

    /**
     * Create a toggle button (ON/OFF)
     * @param {Object} config - Toggle configuration
     * @param {string} config.id - Button ID
     * @param {boolean} config.active - Initial state
     * @param {Function} config.onChange - Change handler (receives new state)
     * @returns {HTMLButtonElement}
     */
    createToggle(config) {
        const { id, active = false, onChange } = config;

        const button = document.createElement('button');
        button.id = id;
        button.className = `toggle-btn ${active ? 'active' : ''}`;
        button.textContent = active ? 'ON' : 'OFF';

        button.onclick = () => {
            const newState = !button.classList.contains('active');
            button.classList.toggle('active', newState);
            button.textContent = newState ? 'ON' : 'OFF';
            if (onChange) onChange(newState);
        };

        return button;
    }

    /**
     * Show a screen in the UI layer
     * @param {HTMLElement} screen - The screen element
     */
    show(screen) {
        this.uiLayer.innerHTML = '';
        this.uiLayer.appendChild(screen);
    }

    /**
     * Clear the UI layer
     */
    clear() {
        this.uiLayer.innerHTML = '';
    }
}

/**
 * HUDBuilder - Creates in-game HUD elements
 */
export class HUDBuilder {
    constructor(uiLayer) {
        this.uiLayer = uiLayer;
        this.elements = {};
    }

    /**
     * Create a standard game HUD
     * @param {Object} config - HUD configuration
     * @param {number} config.score - Initial score
     * @param {number} config.lives - Initial lives
     * @param {string} config.round - Round/stage text
     * @param {number} config.ammo - Initial ammo (optional)
     * @param {Object} config.custom - Custom elements { id: { position, text } }
     */
    create(config = {}) {
        const { score = 0, lives = 3, round = '', ammo = null, custom = {} } = config;

        this.clear();

        const hud = document.createElement('div');
        hud.id = 'game-hud';
        hud.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';

        // Score (top-left)
        const scoreEl = this._createHUDElement('score-display', score, 'top: 20px; left: 20px;', 'SCORE: ');
        hud.appendChild(scoreEl);
        this.elements.score = scoreEl.querySelector('span');

        // Lives (top-right)
        const livesEl = this._createHUDElement('lives-display', lives, 'top: 20px; right: 20px;', 'LIVES: ');
        hud.appendChild(livesEl);
        this.elements.lives = livesEl.querySelector('span');

        // Round (top-center)
        if (round) {
            const roundEl = this._createHUDElement('round-display', round, 'top: 20px; left: 50%; transform: translateX(-50%);');
            hud.appendChild(roundEl);
            this.elements.round = roundEl.querySelector('span');
        }

        // Ammo (bottom-right)
        if (ammo !== null) {
            const ammoEl = this._createHUDElement('ammo-display', 'I'.repeat(ammo), 'bottom: 20px; right: 20px;', 'AMMO: ');
            hud.appendChild(ammoEl);
            this.elements.ammo = ammoEl.querySelector('span');
        }

        // Custom elements
        Object.entries(custom).forEach(([id, cfg]) => {
            const el = this._createHUDElement(id, cfg.text || '', cfg.position || '', cfg.prefix || '');
            hud.appendChild(el);
            this.elements[id] = el.querySelector('span');
        });

        this.uiLayer.appendChild(hud);
        return hud;
    }

    _createHUDElement(id, value, position, prefix = '') {
        const el = document.createElement('div');
        el.style.cssText = `position: absolute; ${position} font-size: 24px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;`;
        el.innerHTML = `${prefix}<span id="${id}">${value}</span>`;
        return el;
    }

    /**
     * Update a HUD element value
     * @param {string} key - Element key (score, lives, round, ammo, or custom id)
     * @param {string|number} value - New value
     */
    update(key, value) {
        if (this.elements[key]) {
            this.elements[key].textContent = value;
        }
    }

    /**
     * Update ammo display with visual representation
     * @param {number} ammo - Current ammo count
     */
    updateAmmo(ammo) {
        this.update('ammo', 'I'.repeat(Math.max(0, ammo)));
    }

    /**
     * Clear the HUD
     */
    clear() {
        const existing = document.getElementById('game-hud');
        if (existing) existing.remove();
        const existingMP = document.getElementById('multiplayer-hud');
        if (existingMP) existingMP.remove();
        this.elements = {};
    }

    /**
     * Create a multiplayer HUD with per-player sections
     * @param {Array} players - Array of player objects from PlayerManager
     * @param {Object} config - Additional HUD configuration
     * @param {string} config.round - Round/stage text (center)
     * @param {number} config.ammo - Shared ammo display
     */
    createMultiplayer(players, config = {}) {
        this.clear();

        const hud = document.createElement('div');
        hud.id = 'multiplayer-hud';
        hud.className = 'multiplayer-hud';

        // Create section for each player
        players.forEach((player, index) => {
            const section = document.createElement('div');
            section.className = `player-hud-section p${index + 1}`;
            section.id = `player-hud-${index}`;
            section.style.setProperty('--player-color', player.colors.primary);

            // Include per-player ammo if specified
            const ammoHtml = config.ammo !== undefined 
                ? `<div class="player-ammo" id="player-${index}-ammo-container">AMMO: <span id="player-${index}-ammo">${config.ammo}</span></div>`
                : '';

            section.innerHTML = `
                <div class="player-label">P${index + 1}</div>
                <div class="player-score" id="p${index}-score">${player.score}</div>
                <div class="player-lives" id="p${index}-lives">♥ ${player.lives}</div>
                ${ammoHtml}
            `;

            hud.appendChild(section);
            
            // Store element references
            this.elements[`p${index}-score`] = section.querySelector(`#p${index}-score`);
            this.elements[`p${index}-lives`] = section.querySelector(`#p${index}-lives`);
            if (config.ammo !== undefined) {
                this.elements[`p${index}-ammo`] = section.querySelector(`#player-${index}-ammo`);
            }
        });

        // Add center elements (round, shared info)
        if (config.round) {
            const centerEl = document.createElement('div');
            centerEl.style.cssText = 'position: absolute; top: 20px; left: 50%; transform: translateX(-50%); font-size: 20px; color: #fff; font-weight: bold; text-shadow: 2px 2px 0 #000;';
            centerEl.innerHTML = `<span id="round-display">${config.round}</span>`;
            hud.appendChild(centerEl);
            this.elements.round = centerEl.querySelector('#round-display');
        }

        this.uiLayer.appendChild(hud);
        return hud;
    }

    /**
     * Update a player's score in multiplayer HUD
     * @param {number} playerIndex - Player index
     * @param {number} score - New score
     */
    updatePlayerScore(playerIndex, score) {
        const el = this.elements[`p${playerIndex}-score`];
        if (el) el.textContent = score;
    }

    /**
     * Update a player's lives in multiplayer HUD
     * @param {number} playerIndex - Player index
     * @param {number} lives - New lives count
     */
    updatePlayerLives(playerIndex, lives) {
        const el = this.elements[`p${playerIndex}-lives`];
        if (el) el.textContent = `♥ ${lives}`;
    }
}

/**
 * OverlayBuilder - Creates overlay screens (pause, results, etc.)
 */
export class OverlayBuilder {
    constructor(uiLayer) {
        this.uiLayer = uiLayer;
    }

    /**
     * Show a pause menu overlay
     * @param {Object} handlers - Event handlers
     * @param {Function} handlers.onResume
     * @param {Function} handlers.onSettings
     * @param {Function} handlers.onQuitMenu
     * @param {Function} handlers.onQuitArcade
     */
    showPauseMenu(handlers = {}) {
        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.innerHTML = `
            <div class="screen pause-menu">
                <h1>PAUSED</h1>
                <button id="btn-resume">RESUME</button>
                <button id="btn-pause-settings">SETTINGS</button>
                <button id="btn-quit">QUIT TO MENU</button>
                <button id="btn-arcade-quit">QUIT TO ARCADE</button>
            </div>
        `;

        this.uiLayer.appendChild(overlay);

        if (handlers.onResume) {
            document.getElementById('btn-resume').onclick = handlers.onResume;
        }
        if (handlers.onSettings) {
            document.getElementById('btn-pause-settings').onclick = handlers.onSettings;
        }
        if (handlers.onQuitMenu) {
            document.getElementById('btn-quit').onclick = handlers.onQuitMenu;
        }
        if (handlers.onQuitArcade) {
            document.getElementById('btn-arcade-quit').onclick = handlers.onQuitArcade;
        }

        return overlay;
    }

    /**
     * Hide the pause menu
     */
    hidePauseMenu() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.remove();
    }

    /**
     * Show a round/stage intro screen
     * @param {Object} config
     * @param {string} config.title - e.g., "ROUND 1" or "STAGE 3"
     * @param {string} config.subtitle - e.g., "GET READY" or objective
     * @param {string} config.info - Additional info (e.g., "LIVES: 3")
     * @param {number} config.duration - How long to show (ms)
     * @param {Function} config.onComplete - Called when intro ends
     * @param {string} config.borderColor - Optional border color
     */
    showIntro(config = {}) {
        const { title, subtitle, info, duration = 2000, onComplete, borderColor } = config;

        const style = borderColor ? `border-color: ${borderColor};` : '';

        this.uiLayer.innerHTML = `
            <div class="screen intro" style="${style}">
                <h2>${title}</h2>
                <h1>${subtitle}</h1>
                ${info ? `<div class="lives">${info}</div>` : ''}
            </div>
        `;

        if (onComplete) {
            setTimeout(() => {
                this.uiLayer.innerHTML = '';
                onComplete();
            }, duration);
        }
    }

    /**
     * Show a result screen
     * @param {Object} config
     * @param {boolean} config.success - Whether the round was successful
     * @param {string} config.title - Override title
     * @param {Array} config.stats - Array of { label, value } for stats
     * @param {Function} config.onNext - Called when NEXT is clicked
     * @param {number} config.autoAdvance - Auto-advance after ms (optional)
     */
    showResult(config = {}) {
        const { success = true, title, stats = [], onNext, autoAdvance } = config;

        const defaultTitle = success ? 'ROUND CLEAR' : 'FAILED';
        const displayTitle = title || defaultTitle;
        const color = success ? '#00ccff' : '#ff0055';

        let statsHTML = '';
        if (stats.length > 0) {
            statsHTML = '<div class="stats-breakdown">';
            stats.forEach(stat => {
                const rowClass = stat.isTotal ? 'stat-row total' : 'stat-row';
                const style = stat.color ? `color: ${stat.color};` : '';
                statsHTML += `
                    <div class="${rowClass}" style="${style}">
                        <span>${stat.label}</span>
                        <span>${stat.value}</span>
                    </div>
                `;
            });
            statsHTML += '</div>';
        }

        this.uiLayer.innerHTML = `
            <div class="screen result" style="border-color: ${color}">
                <h1 style="color: ${color}">${displayTitle}</h1>
                ${statsHTML}
                ${onNext ? '<button id="btn-next" style="margin-top: 20px;">NEXT</button>' : ''}
            </div>
        `;

        if (onNext) {
            const btn = document.getElementById('btn-next');
            btn.onclick = onNext;
            btn.focus();
        }

        if (autoAdvance && onNext) {
            setTimeout(onNext, autoAdvance);
        }
    }

    /**
     * Show a game over screen
     * @param {Object} config
     * @param {boolean} config.cleared - Whether game was cleared
     * @param {number} config.score - Final score
     * @param {Function} config.onRetry
     * @param {Function} config.onMenu
     */
    showGameOver(config = {}) {
        const { cleared = false, score = 0, onRetry, onMenu } = config;

        const title = cleared ? 'ALL ROUNDS CLEARED!' : 'GAME OVER';

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>${title}</h1>
                <h2>SCORE: ${score}</h2>
                <button id="btn-retry">RETRY</button>
                <button id="btn-menu">MENU</button>
            </div>
        `;

        if (onRetry) document.getElementById('btn-retry').onclick = onRetry;
        if (onMenu) document.getElementById('btn-menu').onclick = onMenu;
    }

    /**
     * Show name entry for high score
     * @param {Object} config
     * @param {number} config.score - The score achieved
     * @param {string} config.defaultName - Default player name
     * @param {Function} config.onSubmit - Called with (name, score)
     */
    showNameEntry(config = {}) {
        const { score = 0, defaultName = 'PLAYER', onSubmit } = config;

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>NEW HIGH SCORE!</h1>
                <h2>SCORE: ${score}</h2>
                <div class="name-entry">
                    <label>ENTER YOUR NAME:</label>
                    <input type="text" id="player-name" maxlength="10" value="${defaultName}" autocomplete="off">
                </div>
                <button id="btn-submit">SUBMIT</button>
            </div>
        `;

        const nameInput = document.getElementById('player-name');
        nameInput.focus();
        nameInput.select();

        const submit = () => {
            const name = nameInput.value.trim() || 'PLAYER';
            if (onSubmit) onSubmit(name, score);
        };

        document.getElementById('btn-submit').onclick = submit;
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
    }

    /**
     * Show multiplayer results screen
     * @param {Object} config
     * @param {Array} config.players - Sorted array of player results (from PlayerManager.getFinalResults())
     * @param {string} config.mode - Game mode ('coop', 'versus')
     * @param {boolean} config.cleared - Whether the game was cleared (coop)
     * @param {Object} config.teamStats - Team stats for coop mode
     * @param {Function} config.onRetry - Retry button handler
     * @param {Function} config.onMenu - Menu button handler
     */
    showMultiplayerResults(config = {}) {
        const { players = [], mode = 'versus', cleared = false, teamStats = null, onRetry, onMenu } = config;

        let title = mode === 'coop' 
            ? (cleared ? 'MISSION COMPLETE!' : 'GAME OVER')
            : 'FINAL RESULTS';

        let playersHTML = '<div class="results-players">';
        
        players.forEach((player, index) => {
            const isWinner = mode === 'versus' && index === 0;
            const rankLabel = mode === 'versus' ? `#${index + 1}` : `P${player.index + 1}`;
            
            playersHTML += `
                <div class="result-row ${isWinner ? 'winner' : ''}" 
                     style="--player-color: ${player.colors.primary};">
                    <div class="result-rank ${index === 0 ? 'first' : ''}">${rankLabel}</div>
                    <div class="result-info">
                        <div class="result-name">${player.name}</div>
                        <div class="result-stats">
                            ${player.hits} hits · ${player.accuracy}% accuracy
                        </div>
                    </div>
                    <div class="result-score">${player.score}</div>
                </div>
            `;
        });
        
        playersHTML += '</div>';

        // Add team stats for coop mode
        let teamHTML = '';
        if (mode === 'coop' && teamStats) {
            teamHTML = `
                <div class="team-stats" style="margin: 1rem 0; padding: 1rem; background: rgba(255,255,255,0.1); border-radius: 0.5rem;">
                    <h3 style="margin: 0 0 0.5rem; color: var(--secondary-color);">TEAM TOTAL</h3>
                    <div style="font-size: 2rem; font-weight: bold;">${teamStats.totalScore}</div>
                    <div style="font-size: 0.9rem; color: #aaa;">
                        ${teamStats.totalHits} hits · ${teamStats.accuracy}% accuracy
                    </div>
                </div>
            `;
        }

        this.uiLayer.innerHTML = `
            <div class="screen results-screen">
                <h1>${title}</h1>
                ${teamHTML}
                ${playersHTML}
                <div class="action-buttons">
                    <button id="btn-retry">PLAY AGAIN</button>
                    <button id="btn-menu">MENU</button>
                </div>
            </div>
        `;

        if (onRetry) document.getElementById('btn-retry').onclick = onRetry;
        if (onMenu) document.getElementById('btn-menu').onclick = onMenu;
    }
}

/**
 * HighScoreDisplay - Renders high score tables
 */
export class HighScoreDisplay {
    constructor(uiLayer) {
        this.uiLayer = uiLayer;
    }

    /**
     * Show high scores screen
     * @param {Object} config
     * @param {Array} config.scores - Array of score objects
     * @param {Function} config.onBack - Back button handler
     * @param {string} config.title - Screen title
     * @param {Array} config.badges - Badge configs for extra columns
     */
    show(config = {}) {
        const { scores = [], onBack, title = 'HIGH SCORES', badges = [] } = config;

        let scoresHTML = '';
        if (scores.length === 0) {
            scoresHTML = '<div class="no-scores">No high scores yet! Start playing!</div>';
        } else {
            scoresHTML = '<div class="highscore-table">';
            scores.forEach((score, index) => {
                let badgesHTML = '';
                badges.forEach(badge => {
                    const value = score[badge.field];
                    if (value) {
                        const display = badge.format ? badge.format(value) : value.charAt(0).toUpperCase();
                        const style = badge.color ? `background: ${badge.color};` : '';
                        badgesHTML += `<span class="diff-badge" style="${style}">${display}</span>`;
                    }
                });

                scoresHTML += `
                    <div class="score-row ${index < 3 ? 'top-three' : ''}">
                        <span class="rank">${index + 1}</span>
                        <span class="name">${score.name}</span>
                        <span class="score">${score.score}</span>
                        ${badgesHTML}
                    </div>
                `;
            });
            scoresHTML += '</div>';
        }

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>${title}</h1>
                ${scoresHTML}
                <button id="btn-back">BACK</button>
            </div>
        `;

        if (onBack) {
            document.getElementById('btn-back').onclick = onBack;
        }
    }
}
