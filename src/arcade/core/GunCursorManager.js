/**
 * GunCursorManager class
 * Renders virtual cursors for WebHID lightguns and handles cursor-based UI interaction
 */
export class GunCursorManager {
    constructor(gunManager) {
        this.gunManager = gunManager;
        this.cursorsEnabled = true;
        this.cursorElements = new Map(); // Map of gunIndex -> DOM element
        this.container = null;
        
        // Cursor settings
        this.cursorSize = 40;
        this.showCrosshair = true;
        
        // Context tracking - cursors always show in menus, setting only affects gameplay
        this.inGame = false;
        this.showCursorsInGame = true; // User setting for in-game cursor visibility
        
        // Track forced hidden state per gun (for single player mode)
        this.forcedHiddenGuns = new Set();
    }

    /**
     * Initialize cursor container
     */
    init() {
        // Create container for cursors
        this.container = document.createElement('div');
        this.container.id = 'gun-cursors';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10001;
        `;
        document.body.appendChild(this.container);

        // Create cursor for each gun
        this.gunManager.guns.forEach((gun, index) => {
            this.createCursor(index);
        });
        
    }

    /**
     * Create cursor element for a gun
     */
    createCursor(gunIndex) {
        const gun = this.gunManager.guns[gunIndex];
        if (!gun) return;

        const cursor = document.createElement('div');
        cursor.className = 'gun-cursor';
        cursor.dataset.gunIndex = gunIndex;
        cursor.style.cssText = `
            position: absolute;
            width: ${this.cursorSize}px;
            height: ${this.cursorSize}px;
            transform: translate(-50%, -50%);
            pointer-events: none;
            display: none;
            z-index: 9999;
        `;

        // Create crosshair SVG
        cursor.innerHTML = `
            <svg width="${this.cursorSize}" height="${this.cursorSize}" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="15" fill="none" stroke="${gun.color}" stroke-width="2" opacity="0.8"/>
                <circle cx="20" cy="20" r="3" fill="${gun.color}"/>
                <line x1="20" y1="0" x2="20" y2="12" stroke="${gun.color}" stroke-width="2"/>
                <line x1="20" y1="28" x2="20" y2="40" stroke="${gun.color}" stroke-width="2"/>
                <line x1="0" y1="20" x2="12" y2="20" stroke="${gun.color}" stroke-width="2"/>
                <line x1="28" y1="20" x2="40" y2="20" stroke="${gun.color}" stroke-width="2"/>
            </svg>
            <div style="
                position: absolute;
                bottom: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 12px;
                color: ${gun.color};
                text-shadow: 1px 1px 0 #000;
                white-space: nowrap;
            ">P${gunIndex + 1}</div>
        `;

        // Initialize forced hidden state
        cursor.dataset.forcedHidden = 'false';
        
        this.container.appendChild(cursor);
        this.cursorElements.set(gunIndex, cursor);
    }

    /**
     * Update cursor position for a gun
     */
    updateCursor(gunIndex, x, y) {
        let cursor = this.cursorElements.get(gunIndex);
        
        // Create cursor if it doesn't exist yet
        if (!cursor) {
            this.createCursor(gunIndex);
            cursor = this.cursorElements.get(gunIndex);
        }
        
        if (!cursor) return;

        const gun = this.gunManager.guns[gunIndex];
        
        // Determine if cursor should be visible:
        // - Gun must be connected
        // - Not forced hidden (single player mode) - check both Set and DOM attribute
        // - In menus (not in game): always show cursor
        // - In game: check per-gun showCursor setting
        const isConnected = gun && gun.state.isConnected;
        const gunCursorEnabled = gun?.config?.showCursor !== false; // Default to true
        const forcedHidden = this.forcedHiddenGuns.has(gunIndex) || cursor.dataset.forcedHidden === 'true';
        
        let shouldShow = false;
        if (isConnected && !forcedHidden) {
            if (this.inGame) {
                // In game: respect per-gun setting
                shouldShow = gunCursorEnabled;
            } else {
                // In menus: always show
                shouldShow = true;
            }
        }
        
        // Always update position, visibility is separate
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        cursor.style.display = shouldShow ? 'block' : 'none';
    }

    /**
     * Hide cursor for a gun
     */
    hideCursor(gunIndex) {
        const cursor = this.cursorElements.get(gunIndex);
        if (cursor) {
            cursor.style.display = 'none';
        }
    }

    /**
     * Set whether we're currently in a game (affects cursor visibility based on settings)
     */
    setInGame(inGame) {
        this.inGame = inGame;
        this.updateAllCursorVisibility();
    }

    /**
     * Set whether cursors should show during gameplay (user setting)
     */
    setShowCursorsInGame(show) {
        this.showCursorsInGame = show;
        this.updateAllCursorVisibility();
    }

    /**
     * Update visibility of all cursors based on current state
     */
    updateAllCursorVisibility() {
        this.cursorElements.forEach((cursor, gunIndex) => {
            const gun = this.gunManager.guns[gunIndex];
            const isConnected = gun && gun.state.isConnected;
            const gunCursorEnabled = gun?.config?.showCursor !== false;
            const forcedHidden = this.forcedHiddenGuns.has(gunIndex) || cursor.dataset.forcedHidden === 'true';
            
            let shouldShow = false;
            if (isConnected && !forcedHidden) {
                if (this.inGame) {
                    // In game: respect per-gun setting
                    shouldShow = gunCursorEnabled;
                } else {
                    // In menus: always show
                    shouldShow = true;
                }
            }
            
            if (shouldShow) {
                cursor.style.display = 'block';
                // Ensure cursor has a valid position from gun state
                if (gun && gun.state.x !== undefined && gun.state.y !== undefined) {
                    cursor.style.left = `${gun.state.x}px`;
                    cursor.style.top = `${gun.state.y}px`;
                }
            } else {
                cursor.style.display = 'none';
            }
        });
    }

    /**
     * Show/hide all cursors (legacy method - now just controls master enable)
     */
    setCursorsEnabled(enabled) {
        this.cursorsEnabled = enabled;
        if (!enabled) {
            this.cursorElements.forEach(cursor => {
                cursor.style.display = 'none';
            });
        }
    }
    
    /**
     * Set visibility for a specific cursor (for single player mode)
     * @param {number} gunIndex - Gun index
     * @param {boolean} visible - Whether cursor should be visible
     */
    setCursorVisible(gunIndex, visible) {
        // Track in Set (works even if cursor doesn't exist yet)
        if (visible) {
            this.forcedHiddenGuns.delete(gunIndex);
        } else {
            this.forcedHiddenGuns.add(gunIndex);
        }
        
        // Also update DOM element if it exists
        const cursor = this.cursorElements.get(gunIndex);
        if (cursor) {
            cursor.dataset.forcedHidden = visible ? 'false' : 'true';
            if (!visible) {
                cursor.style.display = 'none';
            }
        }
    }
    
    /**
     * Reset all cursor visibility overrides (call when returning to menu or multiplayer)
     */
    resetCursorVisibility() {
        // Clear the forced hidden Set
        this.forcedHiddenGuns.clear();
        
        // Also clear DOM attributes
        this.cursorElements.forEach((cursor) => {
            cursor.dataset.forcedHidden = 'false';
        });
        this.updateAllCursorVisibility();
    }

    /**
     * Check if a point is over a clickable element
     */
    getElementAtPoint(x, y) {
        // Temporarily hide cursors to get element underneath
        const cursorsVisible = [];
        this.cursorElements.forEach((cursor, index) => {
            if (cursor.style.display !== 'none') {
                cursorsVisible.push(index);
                cursor.style.display = 'none';
            }
        });

        const element = document.elementFromPoint(x, y);

        // Restore cursor visibility
        cursorsVisible.forEach(index => {
            const cursor = this.cursorElements.get(index);
            if (cursor) cursor.style.display = 'block';
        });

        return element;
    }

    /**
     * Simulate click at cursor position
     * @returns {boolean} True if a UI element was clicked
     */
    simulateClick(gunIndex) {
        const gun = this.gunManager.guns[gunIndex];
        if (!gun) return false;

        const x = gun.state.x;
        const y = gun.state.y;

        const element = this.getElementAtPoint(x, y);
        
        if (!element) {
            console.log('Gun click: no element at', x, y);
            return false;
        }

        // Find clickable element (button, link, or element with onclick/click handler)
        const clickTarget = element.closest('button') || 
                           element.closest('a') || 
                           element.closest('[onclick]') ||
                           element.closest('.clickable') ||
                           element.closest('.game-card') ||
                           element.closest('.menu-item');
        
        // Also check if the element itself is clickable
        const isClickable = element.tagName === 'BUTTON' || 
                           element.tagName === 'A' || 
                           element.tagName === 'INPUT' ||
                           element.onclick ||
                           clickTarget;

        if (isClickable) {
            const target = clickTarget || element;
            
            console.log('Gun click: clicking', target.tagName, target.className || target.id);
            
            // Visual feedback
            this.showClickEffect(x, y, gun.color);
            
            // For fullscreen button, handle it directly here
            // We can't use synthetic events for fullscreen API, but we CAN toggle it
            // if we're already in fullscreen (exiting doesn't require trusted gesture)
            // For entering fullscreen, we show a prompt to use mouse/keyboard
            if (target.id === 'btn-fullscreen') {
                if (document.fullscreenElement) {
                    // Exiting fullscreen works with any event
                    document.exitFullscreen().then(() => {
                        target.classList.remove('active');
                        target.textContent = 'OFF';
                    }).catch(err => {
                        console.warn('Exit fullscreen failed:', err);
                    });
                } else {
                    // Entering fullscreen requires trusted gesture - try anyway
                    // Some browsers may allow it, others won't
                    document.documentElement.requestFullscreen().then(() => {
                        target.classList.add('active');
                        target.textContent = 'ON';
                    }).catch(err => {
                        console.warn('Fullscreen requires mouse/keyboard click:', err);
                        // Flash the button to indicate it didn't work
                        target.style.background = '#ff4444';
                        setTimeout(() => {
                            target.style.background = '';
                        }, 200);
                    });
                }
                return true;
            }
            
            // Dispatch a proper mouse event for better compatibility
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: y
            });
            target.dispatchEvent(clickEvent);
            
            return true;
        }
        
        console.log('Gun click: element not clickable:', element.tagName, element.className);
        return false;
    }

    /**
     * Show visual feedback for click
     */
    showClickEffect(x, y, color) {
        const effect = document.createElement('div');
        effect.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: 20px;
            height: 20px;
            border: 3px solid ${color};
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 10000;
            animation: clickPulse 0.3s ease-out forwards;
        `;
        document.body.appendChild(effect);
        
        setTimeout(() => effect.remove(), 300);
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.container) {
            this.container.remove();
        }
        this.cursorElements.clear();
    }
}

// Add CSS animation for click effect
const style = document.createElement('style');
style.textContent = `
    @keyframes clickPulse {
        0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
        }
        100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
