/**
 * LocalPlayersManager - Manages multiple logged-in users on a single device
 * 
 * This allows multiple users to log in to their accounts and associate
 * each account with a specific gun/controller for local multiplayer.
 * 
 * Key concepts:
 * - Player Slot: A position (P1, P2, P3, P4) that can have a user and gun assigned
 * - Each slot can have: a logged-in user OR guest, and an assigned gun
 * - Scores are submitted to the correct user's account based on gun input
 */

import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';
import { generateAvatarSvg, getDefaultAvatar } from '../data/avatars.js';

export class LocalPlayersManager {
    constructor(authService) {
        this.auth = authService;
        this.maxSlots = 4;
        
        // Player slots - each can have a user profile and gun assignment
        this.slots = [];
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots.push(this._createEmptySlot(i));
        }
        
        // Storage key for persisting slot assignments
        this.storageKey = 'lightgun_arcade_local_players';
        
        // Listeners for slot changes
        this.listeners = [];
        
        // Load saved state
        this._loadFromStorage();
    }

    /**
     * Create an empty player slot
     * @private
     */
    _createEmptySlot(index) {
        return {
            index,
            user: null,           // User profile (from Supabase or guest)
            gunIndex: index,      // Default gun assignment matches slot index
            isLoggedIn: false,    // Whether a real user is logged in (not guest)
            isActive: false,      // Whether this slot is participating in current game
            session: null         // Supabase session for this slot (if logged in)
        };
    }

    /**
     * Get all player slots
     * @returns {Array}
     */
    getSlots() {
        return this.slots;
    }

    /**
     * Get a specific slot
     * @param {number} index - Slot index (0-3)
     * @returns {Object|null}
     */
    getSlot(index) {
        return this.slots[index] || null;
    }

    /**
     * Get slot by gun index
     * @param {number} gunIndex 
     * @returns {Object|null}
     */
    getSlotByGun(gunIndex) {
        return this.slots.find(s => s.gunIndex === gunIndex) || null;
    }

    /**
     * Get user for a specific slot
     * @param {number} index - Slot index
     * @returns {Object|null} User profile or null
     */
    getUser(index) {
        return this.slots[index]?.user || null;
    }

    /**
     * Get user by gun index (for routing scores)
     * @param {number} gunIndex 
     * @returns {Object|null}
     */
    getUserByGun(gunIndex) {
        const slot = this.getSlotByGun(gunIndex);
        return slot?.user || null;
    }

    /**
     * Check if a slot has a logged-in user (not guest)
     * @param {number} index 
     * @returns {boolean}
     */
    isSlotLoggedIn(index) {
        return this.slots[index]?.isLoggedIn || false;
    }

    /**
     * Get all active slots (participating in current game)
     * @returns {Array}
     */
    getActiveSlots() {
        return this.slots.filter(s => s.isActive);
    }

    /**
     * Get all slots with logged-in users
     * @returns {Array}
     */
    getLoggedInSlots() {
        return this.slots.filter(s => s.isLoggedIn);
    }

    /**
     * Set slot as active/inactive for current game
     * @param {number} index 
     * @param {boolean} active 
     */
    setSlotActive(index, active) {
        if (this.slots[index]) {
            this.slots[index].isActive = active;
            this._notifyListeners();
        }
    }

    /**
     * Assign a gun to a slot
     * @param {number} slotIndex - Player slot index
     * @param {number|null} gunIndex - Gun index to assign, or null to unassign
     */
    assignGun(slotIndex, gunIndex) {
        if (!this.slots[slotIndex]) return;
        
        if (gunIndex !== null) {
            // Remove gun from any other slot that has it
            this.slots.forEach(slot => {
                if (slot.gunIndex === gunIndex && slot.index !== slotIndex) {
                    slot.gunIndex = null;
                }
            });
        }
        
        this.slots[slotIndex].gunIndex = gunIndex;
        this._saveToStorage();
        this._notifyListeners();
    }
    
    /**
     * Get the gun assigned to a slot
     * @param {number} slotIndex
     * @returns {number|null}
     */
    getGunForSlot(slotIndex) {
        return this.slots[slotIndex]?.gunIndex ?? null;
    }
    
    /**
     * Get the slot that has a specific gun assigned
     * @param {number} gunIndex
     * @returns {number|null} Slot index or null
     */
    getSlotForGun(gunIndex) {
        const slot = this.slots.find(s => s.gunIndex === gunIndex);
        return slot ? slot.index : null;
    }
    
    /**
     * Unassign a gun from all slots
     * @param {number} gunIndex
     */
    unassignGun(gunIndex) {
        this.slots.forEach(slot => {
            if (slot.gunIndex === gunIndex) {
                slot.gunIndex = null;
            }
        });
        this._saveToStorage();
        this._notifyListeners();
    }

    /**
     * Check if a user is already logged into another slot
     * @param {string} email - Email to check
     * @param {number} excludeSlot - Slot to exclude from check
     * @returns {number|null} Slot index if found, null otherwise
     */
    isUserAlreadyLoggedIn(email, excludeSlot = -1) {
        for (const slot of this.slots) {
            if (slot.index !== excludeSlot && 
                slot.isLoggedIn && 
                slot.user?.email?.toLowerCase() === email.toLowerCase()) {
                return slot.index;
            }
        }
        return null;
    }

    /**
     * Login a user to a specific slot
     * For slot 0, we use the main Supabase auth.
     * For other slots, we verify credentials but don't change the main session.
     * 
     * @param {number} slotIndex - Player slot index
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{user: Object, error: Error}>}
     */
    async loginToSlot(slotIndex, email, password) {
        if (!this.slots[slotIndex]) {
            return { user: null, error: new Error('Invalid slot index') };
        }

        if (!isSupabaseConfigured()) {
            return { user: null, error: new Error('Online features not available') };
        }

        // Check if this user is already logged into another slot
        const existingSlot = this.isUserAlreadyLoggedIn(email, slotIndex);
        if (existingSlot !== null) {
            return { 
                user: null, 
                error: new Error(`This account is already logged in as Player ${existingSlot + 1}`) 
            };
        }

        try {
            // For slot 0, use the main auth session
            if (slotIndex === 0) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    return { user: null, error };
                }

                // Load profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                const user = {
                    id: data.user.id,
                    username: profile?.username || data.user.user_metadata?.username || email.split('@')[0],
                    display_name: profile?.display_name || data.user.user_metadata?.display_name || email.split('@')[0],
                    avatar_url: profile?.avatar_url || data.user.user_metadata?.avatar_url,
                    email: data.user.email,
                    isGuest: false
                };

                this.slots[0].user = user;
                this.slots[0].isLoggedIn = true;
                this.slots[0].session = data.session;

                this._saveToStorage();
                this._notifyListeners();

                console.log(`Slot 1: Logged in as ${user.display_name} (primary auth)`);
                return { user, error: null };
            }
            
            // For other slots, verify credentials without changing main session
            // We use a temporary sign-in, get the user info, then restore the original session
            const currentSession = await supabase.auth.getSession();
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                return { user: null, error };
            }

            // Double-check by user ID in case email differs
            const existingSlotById = this.slots.find(
                s => s.index !== slotIndex && s.isLoggedIn && s.user?.id === data.user.id
            );
            if (existingSlotById) {
                // Restore original session before returning error
                if (currentSession.data.session) {
                    await supabase.auth.setSession(currentSession.data.session);
                }
                return { 
                    user: null, 
                    error: new Error(`This account is already logged in as Player ${existingSlotById.index + 1}`) 
                };
            }

            // Load profile for the secondary user
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            const user = {
                id: data.user.id,
                username: profile?.username || data.user.user_metadata?.username || email.split('@')[0],
                display_name: profile?.display_name || data.user.user_metadata?.display_name || email.split('@')[0],
                avatar_url: profile?.avatar_url || data.user.user_metadata?.avatar_url,
                email: data.user.email,
                isGuest: false
            };

            // Store the secondary user's session for score submission
            const secondarySession = data.session;

            // Restore the original (slot 0) session as the main auth
            if (currentSession.data.session) {
                await supabase.auth.setSession(currentSession.data.session);
            }

            // Update the secondary slot
            this.slots[slotIndex].user = user;
            this.slots[slotIndex].isLoggedIn = true;
            this.slots[slotIndex].session = secondarySession; // Store for later use

            this._saveToStorage();
            this._notifyListeners();

            console.log(`Slot ${slotIndex + 1}: Logged in as ${user.display_name} (secondary)`);
            return { user, error: null };

        } catch (e) {
            console.error('Login error:', e);
            return { user: null, error: e };
        }
    }

    /**
     * Register a new user and log them into a specific slot
     * @param {number} slotIndex - Player slot index
     * @param {string} email 
     * @param {string} password 
     * @param {string} username
     * @returns {Promise<{user: Object, error: Error}>}
     */
    async registerToSlot(slotIndex, email, password, username) {
        if (!this.slots[slotIndex]) {
            return { user: null, error: new Error('Invalid slot index') };
        }

        if (!isSupabaseConfigured()) {
            return { user: null, error: new Error('Online features not available') };
        }

        try {
            // Sign up with Supabase
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username,
                        display_name: username
                    }
                }
            });

            if (error) {
                return { user: null, error };
            }

            if (!data.user) {
                return { user: null, error: new Error('Registration failed') };
            }

            // Check if email confirmation is required
            if (data.user.identities?.length === 0) {
                return { user: null, error: new Error('This email is already registered') };
            }

            const user = {
                id: data.user.id,
                username: username,
                display_name: username,
                avatar_url: generateAvatarSvg(getDefaultAvatar()),
                email: data.user.email,
                isGuest: false
            };

            // Update slot
            this.slots[slotIndex].user = user;
            this.slots[slotIndex].isLoggedIn = true;
            this.slots[slotIndex].session = data.session;

            this._saveToStorage();
            this._notifyListeners();

            console.log(`Slot ${slotIndex + 1}: Registered and logged in as ${user.display_name}`);
            return { user, error: null };

        } catch (e) {
            console.error('Registration error:', e);
            return { user: null, error: e };
        }
    }

    /**
     * Set a slot to guest mode
     * @param {number} slotIndex 
     * @param {string} guestName - Optional custom guest name
     */
    setSlotAsGuest(slotIndex, guestName = null) {
        if (!this.slots[slotIndex]) return;

        const slot = this.slots[slotIndex];
        slot.user = {
            id: `guest_${slotIndex}_${Date.now()}`,
            username: guestName || `Guest ${slotIndex + 1}`,
            display_name: guestName || `Guest ${slotIndex + 1}`,
            avatar_url: generateAvatarSvg(getDefaultAvatar()),
            isGuest: true
        };
        slot.isLoggedIn = false;
        slot.session = null;

        this._saveToStorage();
        this._notifyListeners();
    }

    /**
     * Logout a user from a slot
     * @param {number} slotIndex 
     */
    async logoutFromSlot(slotIndex) {
        if (!this.slots[slotIndex]) return;

        const slot = this.slots[slotIndex];
        
        // If this was the primary auth user, sign out from Supabase
        if (slot.session && slot.isLoggedIn) {
            // Note: We don't call supabase.auth.signOut() here because
            // that would sign out the "main" session. Instead, we just
            // clear the local slot data.
        }

        // Reset to guest
        this.setSlotAsGuest(slotIndex);
        
        console.log(`Slot ${slotIndex + 1}: Logged out`);
    }

    /**
     * Initialize slot 0 with the primary auth user
     * Call this after the main auth service initializes
     * Only updates slot 0 if it doesn't already have a different user
     */
    syncWithPrimaryAuth() {
        const primaryUser = this.auth.getCurrentUser();
        
        // Only sync if slot 0 is empty or has the same user
        const currentSlot0User = this.slots[0].user;
        
        if (primaryUser && !primaryUser.isGuest) {
            // Only update if slot 0 is empty or has the same user ID
            if (!currentSlot0User || currentSlot0User.id === primaryUser.id || currentSlot0User.isGuest) {
                this.slots[0].user = primaryUser;
                this.slots[0].isLoggedIn = true;
                console.log('Slot 1 synced with primary auth:', primaryUser.display_name);
                this._notifyListeners();
            }
            // If slot 0 has a different user, don't overwrite - the auth change
            // was likely from a secondary slot login that restored the session
        } else if (!currentSlot0User || currentSlot0User.isGuest) {
            // Only set as guest if slot 0 doesn't have a logged-in user
            this.setSlotAsGuest(0);
            this._notifyListeners();
        }
    }

    /**
     * Get the user ID for submitting a score from a specific gun
     * @param {number} gunIndex - Gun that made the score
     * @returns {string|null} User ID or null for guest
     */
    getUserIdForGun(gunIndex) {
        const slot = this.getSlotByGun(gunIndex);
        if (slot?.isLoggedIn && slot.user?.id) {
            return slot.user.id;
        }
        return null; // Guest - score saved locally only
    }

    /**
     * Get session token for a slot (for authenticated API calls)
     * @param {number} slotIndex 
     * @returns {string|null}
     */
    getSessionToken(slotIndex) {
        return this.slots[slotIndex]?.session?.access_token || null;
    }

    /**
     * Add a listener for slot changes
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all listeners of changes
     * @private
     */
    _notifyListeners() {
        this.listeners.forEach(cb => cb(this.slots));
    }

    /**
     * Save state to localStorage
     * @private
     */
    _saveToStorage() {
        try {
            const data = this.slots.map(slot => ({
                index: slot.index,
                gunIndex: slot.gunIndex,
                // Don't save session tokens or full user data for security
                // Only save guest names and gun assignments
                guestName: slot.user?.isGuest ? slot.user.display_name : null,
                isGuest: slot.user?.isGuest || false
            }));
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save local players:', e);
        }
    }

    /**
     * Load state from localStorage
     * @private
     */
    _loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                data.forEach((savedSlot, i) => {
                    if (this.slots[i]) {
                        this.slots[i].gunIndex = savedSlot.gunIndex ?? i;
                        if (savedSlot.isGuest && savedSlot.guestName) {
                            this.setSlotAsGuest(i, savedSlot.guestName);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to load local players:', e);
        }
    }

    /**
     * Reset all slots to default state
     */
    reset() {
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots[i] = this._createEmptySlot(i);
        }
        this._saveToStorage();
        this._notifyListeners();
    }
}
