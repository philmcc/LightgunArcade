/**
 * GameStateMachine - Manages game state transitions
 * Provides a consistent state management pattern for all games
 */
export class GameStateMachine {
    /**
     * Common game states
     */
    static States = {
        MENU: 'MENU',
        MODE_SELECT: 'MODE_SELECT',
        DIFFICULTY_SELECT: 'DIFFICULTY_SELECT',
        INTRO: 'INTRO',
        PLAYING: 'PLAYING',
        PAUSED: 'PAUSED',
        PAUSED_SETTINGS: 'PAUSED_SETTINGS',
        ROUND_RESULT: 'ROUND_RESULT',
        GAME_OVER: 'GAME_OVER',
        HIGH_SCORES: 'HIGH_SCORES',
        SETTINGS: 'SETTINGS',
        NAME_ENTRY: 'NAME_ENTRY'
    };

    /**
     * @param {Object} game - Reference to the game instance
     * @param {string} initialState - Initial state
     */
    constructor(game, initialState = GameStateMachine.States.MENU) {
        this.game = game;
        this._state = initialState;
        this._previousState = null;
        this._stateHandlers = {};
        this._transitionHandlers = {};
        this._stateData = {};
    }

    /**
     * Get current state
     */
    get state() {
        return this._state;
    }

    /**
     * Get previous state
     */
    get previousState() {
        return this._previousState;
    }

    /**
     * Get data associated with current state
     */
    get data() {
        return this._stateData;
    }

    /**
     * Register a handler for entering a state
     * @param {string} state - State name
     * @param {Function} handler - Called when entering state, receives (data, previousState)
     */
    onEnter(state, handler) {
        if (!this._stateHandlers[state]) {
            this._stateHandlers[state] = { enter: null, exit: null };
        }
        this._stateHandlers[state].enter = handler;
        return this;
    }

    /**
     * Register a handler for exiting a state
     * @param {string} state - State name
     * @param {Function} handler - Called when exiting state, receives (nextState)
     */
    onExit(state, handler) {
        if (!this._stateHandlers[state]) {
            this._stateHandlers[state] = { enter: null, exit: null };
        }
        this._stateHandlers[state].exit = handler;
        return this;
    }

    /**
     * Register a handler for a specific transition
     * @param {string} from - Source state
     * @param {string} to - Target state
     * @param {Function} handler - Called during transition
     */
    onTransition(from, to, handler) {
        const key = `${from}->${to}`;
        this._transitionHandlers[key] = handler;
        return this;
    }

    /**
     * Transition to a new state
     * @param {string} newState - Target state
     * @param {Object} data - Optional data to pass to the new state
     * @returns {boolean} Whether transition was successful
     */
    transition(newState, data = {}) {
        if (newState === this._state) {
            return false;
        }

        const oldState = this._state;

        // Call exit handler for current state
        if (this._stateHandlers[oldState]?.exit) {
            this._stateHandlers[oldState].exit(newState);
        }

        // Call transition handler if exists
        const transitionKey = `${oldState}->${newState}`;
        if (this._transitionHandlers[transitionKey]) {
            this._transitionHandlers[transitionKey](data);
        }

        // Update state
        this._previousState = oldState;
        this._state = newState;
        this._stateData = data;

        // Call enter handler for new state
        if (this._stateHandlers[newState]?.enter) {
            this._stateHandlers[newState].enter(data, oldState);
        }

        return true;
    }

    /**
     * Go back to previous state
     * @param {Object} data - Optional data
     */
    goBack(data = {}) {
        if (this._previousState) {
            this.transition(this._previousState, data);
        }
    }

    /**
     * Check if current state matches
     * @param {string|Array} states - State or array of states to check
     */
    is(states) {
        if (Array.isArray(states)) {
            return states.includes(this._state);
        }
        return this._state === states;
    }

    /**
     * Check if game is in a "playing" state (not menu/paused)
     */
    isPlaying() {
        return this._state === GameStateMachine.States.PLAYING;
    }

    /**
     * Check if game is paused
     */
    isPaused() {
        return this._state === GameStateMachine.States.PAUSED || 
               this._state === GameStateMachine.States.PAUSED_SETTINGS;
    }

    /**
     * Check if game is in a menu state
     */
    isInMenu() {
        return [
            GameStateMachine.States.MENU,
            GameStateMachine.States.MODE_SELECT,
            GameStateMachine.States.DIFFICULTY_SELECT,
            GameStateMachine.States.HIGH_SCORES,
            GameStateMachine.States.SETTINGS
        ].includes(this._state);
    }

    /**
     * Toggle pause state
     * @returns {boolean} New paused state
     */
    togglePause() {
        if (this.isPlaying()) {
            this.transition(GameStateMachine.States.PAUSED);
            return true;
        } else if (this.isPaused()) {
            this.transition(GameStateMachine.States.PLAYING);
            return false;
        }
        return this.isPaused();
    }
}
