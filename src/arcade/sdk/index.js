/**
 * Lightgun Arcade SDK
 * 
 * This module exports all SDK components for game development.
 * Games should import from this file to access SDK functionality.
 * 
 * Usage:
 * import { BaseGame, MenuBuilder, GameStateMachine } from '../../arcade/sdk/index.js';
 */

// Core game interface
export { BaseGame } from '../interfaces/BaseGame.js';

// UI Components
export { 
    MenuBuilder, 
    HUDBuilder, 
    OverlayBuilder, 
    HighScoreDisplay 
} from './UIComponents.js';

// State Management
export { GameStateMachine } from './GameStateMachine.js';

// Settings
export { SettingsScreen } from './SettingsScreen.js';

// Asset Loading
export { AssetLoader, assetLoader } from './AssetLoader.js';

// Multiplayer
export { PlayerSelectScreen } from './PlayerSelectScreen.js';
export { PlayerManager } from '../core/PlayerManager.js';

// Services (re-export from services folder)
export { GameHighScores } from '../services/GameHighScores.js';

// Shared utilities (re-export from shared folder)
export { InputManager } from '../../shared/InputManager.js';
export { SoundManager } from '../../shared/SoundManager.js';
export { Settings } from '../../shared/Settings.js';

// Game Systems
export { ComboSystem } from './ComboSystem.js';
export { FloatingScoreManager, ComboDisplay } from './FloatingScoreManager.js';
