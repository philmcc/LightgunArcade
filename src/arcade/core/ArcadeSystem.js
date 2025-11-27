import { Settings } from '../../shared/Settings.js';
import { GlobalHighScores } from '../GlobalHighScores.js';
import { GameRegistry } from './GameRegistry.js';
import { AuthService } from '../services/AuthService.js';
import { GunManager } from './GunManager.js';
import { GunSetupMenu } from '../ui/GunSetupMenu.js';

export class ArcadeSystem {
    constructor(canvas, uiLayer) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;
        this.ctx = canvas.getContext('2d');

        this.settings = new Settings();
        this.globalHighScores = new GlobalHighScores();
        this.registry = new GameRegistry();
        this.auth = new AuthService();
        this.gunManager = new GunManager();
        this.gunSetupMenu = new GunSetupMenu(this);

        this.init();

        this.currentGame = null;
        this.state = 'ARCADE_MENU'; // ARCADE_MENU, PLAYING_GAME, HIGH_SCORES, SETTINGS, PROFILE

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    async init() {
        await this.gunManager.init();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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
        const games = this.registry.getAllGames();
        const user = this.auth.getCurrentUser();

        this.uiLayer.innerHTML = `
            <div class="arcade-menu">
                <div class="arcade-header">
                    <h1 class="arcade-title">LIGHTGUN ARCADE</h1>
                    <div class="user-profile-widget" id="btn-profile">
                        <span class="user-name">${user.name}</span>
                        <span class="user-icon">👤</span>
                    </div>
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
                    <button id="btn-arcade-highscores">HIGH SCORES</button>
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

        document.getElementById('btn-arcade-highscores').onclick = () => this.showGlobalHighScores();
        document.getElementById('btn-arcade-settings').onclick = () => this.showSettings();
        document.getElementById('btn-profile').onclick = () => this.showProfile();
        document.getElementById('btn-gun-setup').onclick = () => this.showGunSetup();
    }

    async launchGame(gameId) {
        const gameRegistration = this.registry.getGame(gameId);
        if (!gameRegistration || !gameRegistration.isAvailable) return;

        try {
            this.state = 'PLAYING_GAME';
            // Instantiate the game class
            this.currentGame = new gameRegistration.GameClass(this.canvas, this.uiLayer, this);

            // Initialize the game
            await this.currentGame.init();

        } catch (error) {
            console.error("Failed to launch game:", error);
            this.showArcadeMenu(); // Fallback to menu on error
            // TODO: Show error notification to user
        }
    }

    returnToArcade() {
        if (this.currentGame) {
            this.currentGame.destroy(); // Clean up
            this.currentGame = null;
        }
        this.showArcadeMenu();
    }

    showProfile() {
        this.state = 'PROFILE';
        const user = this.auth.getCurrentUser();

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h1>USER PROFILE</h1>
                <div class="profile-card">
                    <div class="profile-icon">👤</div>
                    <h2>${user.name}</h2>
                    <p class="profile-id">ID: ${user.id}</p>
                </div>
                
                <div class="profile-actions">
                    <div class="input-group">
                        <label>Change Name:</label>
                        <input type="text" id="input-username" value="${user.name}" maxlength="15">
                        <button id="btn-save-name">SAVE</button>
                    </div>
                    
                    ${!user.isGuest ? '<button id="btn-logout" class="danger-btn">LOGOUT (Reset to Guest)</button>' : ''}
                </div>

                <button id="btn-back-arcade" style="margin-top: 30px;">BACK TO ARCADE</button>
            </div>
        `;

        document.getElementById('btn-save-name').onclick = () => {
            const newName = document.getElementById('input-username').value.trim();
            if (newName) {
                this.auth.login(newName); // Simple login/update
                this.showProfile(); // Refresh
            }
        };

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = () => {
                this.auth.logout();
                this.showProfile();
            };
        }

        document.getElementById('btn-back-arcade').onclick = () => this.showArcadeMenu();
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

        this.uiLayer.innerHTML = `
            <div class="screen">
                <h2>SETTINGS</h2>
                
                <div class="setting-row">
                    <label>Input Method:</label>
                    <select id="input-select">
                        <option value="mouse">Mouse / Touch</option>
                        <option value="gun4ir">Gun4IR</option>
                        <option value="sinden">Sinden Lightgun</option>
                    </select>
                </div>

                <div id="sinden-options" class="${this.settings.inputMethod === 'sinden' ? '' : 'hidden'}">
                    <div class="setting-row">
                        <label>Border Enabled:</label>
                        <input type="checkbox" id="sinden-check" ${this.settings.sindenEnabled ? 'checked' : ''}>
                    </div>
                    <div class="setting-row">
                        <label>Border Thickness:</label>
                        <input type="range" id="sinden-thick" min="1" max="50" value="${this.settings.sindenThickness}">
                    </div>
                    <div class="setting-row">
                        <label>Border Color:</label>
                        <input type="color" id="sinden-color" value="${this.settings.sindenColor}">
                    </div>
                </div>
                
                <div class="setting-row">
                    <label>Fullscreen:</label>
                    <input type="checkbox" id="fullscreen-check" ${this.settings.isFullscreen ? 'checked' : ''}>
                </div>
                
                <button id="btn-back-arcade">BACK</button>
            </div>
        `;

        const inputSelect = document.getElementById("input-select");
        const sindenOptions = document.getElementById("sinden-options");
        const sindenCheck = document.getElementById("sinden-check");
        const sindenThick = document.getElementById("sinden-thick");
        const sindenColor = document.getElementById("sinden-color");
        const fullscreenCheck = document.getElementById("fullscreen-check");

        inputSelect.value = this.settings.inputMethod;

        inputSelect.onchange = (e) => {
            this.settings.setInputMethod(e.target.value);
            if (e.target.value === 'sinden') {
                sindenOptions.classList.remove('hidden');
            } else {
                sindenOptions.classList.add('hidden');
            }
        };

        sindenCheck.onchange = (e) => this.settings.setSindenEnabled(e.target.checked);
        sindenThick.oninput = (e) => this.settings.setSindenThickness(e.target.value);
        sindenColor.oninput = (e) => this.settings.setSindenColor(e.target.value);
        fullscreenCheck.onchange = () => this.settings.toggleFullscreen();

        document.getElementById("btn-back-arcade").onclick = () => this.showArcadeMenu();
    }

    showGunSetup() {
        this.state = 'GUN_SETUP';
        this.gunSetupMenu.show();
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
