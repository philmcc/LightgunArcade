import { supabase, isSupabaseConfigured, onAuthStateChange } from '../../platform/supabase.js';
import { AVATAR_LIBRARY, generateAvatarSvg, getDefaultAvatar } from '../data/avatars.js';

/**
 * AuthService - Handles user authentication with Supabase
 * 
 * Supports:
 * - Email/password authentication
 * - OAuth providers (Google, Discord, GitHub)
 * - Guest mode (play without account)
 * - Guest to registered account linking
 */
export class AuthService {
    constructor() {
        this.currentUser = null;
        this.profile = null;
        this.isInitialized = false;
        this.authListeners = [];
        this.guestStorageKey = 'lightgun_arcade_guest';
        
        // Initialize auth state
        this._init();
    }

    /**
     * Initialize auth service and listen for auth changes
     */
    async _init() {
        if (!isSupabaseConfigured()) {
            console.warn('Supabase not configured, running in guest-only mode');
            this._loadGuestUser();
            this.isInitialized = true;
            return;
        }

        // Listen for auth state changes
        onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (session?.user) {
                this.currentUser = session.user;
                // Create profile from session data immediately (don't wait for DB)
                this.profile = {
                    id: session.user.id,
                    username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
                    display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0],
                    avatar_url: session.user.user_metadata?.avatar_url,
                    isGuest: false
                };
                this._notifyListeners();
                
                // Try to load full profile from DB in background (non-blocking)
                this._loadProfileInBackground();
            } else {
                this.currentUser = null;
                this.profile = null;
                this._loadGuestUser();
                this._notifyListeners();
            }
        });

        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Auth init - session:', session ? 'exists' : 'none');
        if (session?.user) {
            console.log('Auth init - user:', session.user.email);
            this.currentUser = session.user;
            // Create profile from session data immediately
            this.profile = {
                id: session.user.id,
                username: session.user.user_metadata?.username || session.user.email?.split('@')[0],
                display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0],
                avatar_url: session.user.user_metadata?.avatar_url,
                isGuest: false
            };
            console.log('Auth init - profile set:', this.profile);
            // Try to load full profile from DB in background
            this._loadProfileInBackground();
        } else {
            console.log('Auth init - loading guest user');
            this._loadGuestUser();
        }
        
        this.isInitialized = true;
        this._notifyListeners();
    }

    /**
     * Wait for auth service to initialize
     */
    async waitForInit() {
        if (this.isInitialized) return;
        
        return new Promise(resolve => {
            const check = () => {
                if (this.isInitialized) {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    /**
     * Load guest user from localStorage
     */
    _loadGuestUser() {
        const saved = localStorage.getItem(this.guestStorageKey);
        if (saved) {
            const guest = JSON.parse(saved);
            this.profile = {
                id: guest.id,
                username: guest.username || 'Guest',
                display_name: guest.display_name || 'Guest',
                avatar_url: guest.avatar_url || generateAvatarSvg(getDefaultAvatar()),
                isGuest: true
            };
        } else {
            const guestId = 'guest_' + Date.now();
            this.profile = {
                id: guestId,
                username: 'Guest',
                display_name: 'Guest',
                avatar_url: generateAvatarSvg(getDefaultAvatar()),
                isGuest: true
            };
            this._saveGuestUser();
        }
    }

    /**
     * Save guest user to localStorage
     */
    _saveGuestUser() {
        if (this.profile?.isGuest) {
            localStorage.setItem(this.guestStorageKey, JSON.stringify(this.profile));
        }
    }

    /**
     * Load user profile from Supabase (non-blocking background load)
     */
    async _loadProfileInBackground() {
        if (!this.currentUser) return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && data) {
                // Update profile with DB data
                this.profile = {
                    ...data,
                    isGuest: false
                };
                this._notifyListeners();
                console.log('Profile loaded from DB:', this.profile);
            } else {
                console.warn('Could not load profile from DB:', error?.message);
            }
        } catch (e) {
            console.warn('Profile load exception:', e.message);
        }
    }

    /**
     * Load user profile from Supabase (legacy - kept for compatibility)
     */
    async _loadProfile() {
        if (!this.currentUser) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', this.currentUser.id)
            .single();

        if (error) {
            console.error('Error loading profile:', error);
            // Profile might not exist yet - create a basic one from auth data
            this.profile = {
                id: this.currentUser.id,
                username: this.currentUser.user_metadata?.username || 
                          this.currentUser.email?.split('@')[0] || 
                          'user_' + this.currentUser.id.substring(0, 8),
                display_name: this.currentUser.user_metadata?.display_name || 
                              this.currentUser.user_metadata?.full_name ||
                              this.currentUser.email?.split('@')[0],
                avatar_url: this.currentUser.user_metadata?.avatar_url,
                isGuest: false
            };
            return;
        }

        this.profile = {
            ...data,
            isGuest: false
        };
    }

    /**
     * Register a new user with email/password
     * @param {string} email 
     * @param {string} password 
     * @param {string} username 
     * @param {Object} options - Additional options (avatar, display_name)
     * @returns {Promise<{user: Object, error: Error}>}
     */
    async signUp(email, password, username, options = {}) {
        // Validate username
        const usernameError = this._validateUsername(username);
        if (usernameError) {
            return { user: null, error: new Error(usernameError) };
        }

        // Check if username is taken
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username.toLowerCase())
            .single();

        if (existing) {
            return { user: null, error: new Error('Username is already taken') };
        }

        const avatarUrl = options.avatar_url || generateAvatarSvg(getDefaultAvatar());
        const displayName = options.display_name || username;

        // Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username.toLowerCase(),
                    display_name: displayName,
                    avatar_url: avatarUrl
                }
            }
        });

        if (error) {
            return { user: null, error };
        }

        // Explicitly create profile (in case the database trigger doesn't exist or fails)
        if (data.user) {
            await this._ensureProfileExists(data.user.id, {
                username: username.toLowerCase(),
                display_name: displayName,
                avatar_url: avatarUrl
            });
        }

        return { user: data.user, error: null };
    }

    /**
     * Ensure a profile exists for the given user ID
     * Creates one if it doesn't exist
     * @private
     */
    async _ensureProfileExists(userId, profileData) {
        try {
            // Check if profile already exists
            const { data: existing } = await supabase
                .from('profiles')
                .select('id, privacy_settings')
                .eq('id', userId)
                .single();

            if (existing) {
                console.log('Profile already exists for user:', userId);
                
                // If privacy_settings is null, update it to default
                if (!existing.privacy_settings) {
                    console.log('Updating missing privacy_settings for user:', userId);
                    await supabase
                        .from('profiles')
                        .update({
                            privacy_settings: {
                                profile: 'public',
                                activity: 'friends',
                                friend_requests: 'everyone'
                            }
                        })
                        .eq('id', userId);
                }
                return;
            }

            // Create profile with default privacy settings
            console.log('Creating profile for user:', userId);
            const { error } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: profileData.username,
                    display_name: profileData.display_name,
                    avatar_url: profileData.avatar_url,
                    privacy_settings: {
                        profile: 'public',
                        activity: 'friends',
                        friend_requests: 'everyone'
                    }
                });

            if (error) {
                console.error('Failed to create profile:', error);
            } else {
                console.log('Profile created successfully');
            }
        } catch (e) {
            console.error('Error ensuring profile exists:', e);
        }
    }

    /**
     * Sign in with email/password
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<{user: Object, error: Error}>}
     */
    async signIn(email, password) {
        console.log('Signing in with email:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Sign in error:', error);
            return { user: null, error };
        }

        console.log('Sign in successful, loading profile...');
        
        // Update current user and load profile
        this.currentUser = data.user;
        
        // Ensure profile exists in database (for users who registered before profile creation was fixed)
        const username = data.user.user_metadata?.username || data.user.email?.split('@')[0];
        const displayName = data.user.user_metadata?.display_name || data.user.email?.split('@')[0];
        const avatarUrl = data.user.user_metadata?.avatar_url || generateAvatarSvg(getDefaultAvatar());
        
        await this._ensureProfileExists(data.user.id, {
            username: username,
            display_name: displayName,
            avatar_url: avatarUrl
        });
        
        // Load profile with timeout
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile load timeout')), 5000)
            );
            await Promise.race([this._loadProfile(), timeoutPromise]);
        } catch (e) {
            console.warn('Profile load issue:', e.message);
            // Create fallback profile from auth data
            this.profile = {
                id: data.user.id,
                username: username,
                display_name: displayName,
                avatar_url: avatarUrl,
                isGuest: false
            };
        }
        
        this._notifyListeners();
        console.log('Sign in complete, profile:', this.profile);

        return { user: data.user, error: null };
    }

    /**
     * Sign in with OAuth provider
     * @param {'google' | 'discord' | 'github'} provider 
     * @returns {Promise<{error: Error}>}
     */
    async signInWithProvider(provider) {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin
            }
        });

        return { error };
    }

    /**
     * Sign out the current user
     * @returns {Promise<{error: Error}>}
     */
    async signOut() {
        console.log('Signing out...');
        
        // Clear local state first so UI updates immediately
        this.currentUser = null;
        this.profile = null;
        this._loadGuestUser();
        this._notifyListeners();
        console.log('Local state cleared, now guest');
        
        // Then try to sign out from Supabase (with timeout)
        try {
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Sign out timeout')), 3000)
            );
            await Promise.race([
                supabase.auth.signOut(),
                timeoutPromise
            ]);
            console.log('Supabase sign out complete');
        } catch (e) {
            console.warn('Supabase sign out issue:', e.message);
        }

        return { error: null };
    }

    /**
     * Send password reset email
     * @param {string} email 
     * @returns {Promise<{error: Error}>}
     */
    async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`
        });

        return { error };
    }

    /**
     * Update user password
     * @param {string} newPassword 
     * @returns {Promise<{error: Error}>}
     */
    async updatePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        return { error };
    }

    /**
     * Get the current user (Supabase user or guest)
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.profile;
    }

    /**
     * Check if user is authenticated (not a guest)
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.currentUser !== null && !this.profile?.isGuest;
    }

    /**
     * Check if current user is a guest
     * @returns {boolean}
     */
    isGuest() {
        // Guest if explicitly marked as guest OR if no profile loaded
        const result = this.profile?.isGuest === true;
        return result;
    }

    /**
     * Update guest profile (for guest users)
     * @param {Object} updates 
     */
    updateGuestProfile(updates) {
        if (this.profile?.isGuest) {
            this.profile = { ...this.profile, ...updates };
            this._saveGuestUser();
            this._notifyListeners();
        }
    }

    /**
     * Validate username format
     * @param {string} username 
     * @returns {string|null} Error message or null if valid
     */
    _validateUsername(username) {
        if (!username || username.length < 3) {
            return 'Username must be at least 3 characters';
        }
        if (username.length > 20) {
            return 'Username must be 20 characters or less';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return 'Username can only contain letters, numbers, and underscores';
        }
        if (/^guest/i.test(username)) {
            return 'Username cannot start with "guest"';
        }
        return null;
    }

    /**
     * Check if a username is available
     * @param {string} username 
     * @returns {Promise<boolean>}
     */
    async isUsernameAvailable(username) {
        const { data } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username.toLowerCase())
            .single();

        return !data;
    }

    /**
     * Subscribe to auth state changes
     * @param {function} callback - Called with (profile) on auth changes
     * @returns {function} Unsubscribe function
     */
    onAuthChange(callback) {
        this.authListeners.push(callback);
        
        // Call immediately with current state
        if (this.isInitialized) {
            callback(this.profile);
        }

        return () => {
            this.authListeners = this.authListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notify all auth listeners
     */
    _notifyListeners() {
        this.authListeners.forEach(cb => cb(this.profile));
    }

    /**
     * Alias for onAuthChange
     */
    addListener(callback) {
        return this.onAuthChange(callback);
    }

    // =========================================================================
    // LEGACY COMPATIBILITY METHODS
    // These maintain compatibility with existing code that uses the old API
    // =========================================================================

    /**
     * @deprecated Use signIn() instead
     */
    login(name) {
        console.warn('AuthService.login() is deprecated. Use signIn() for email/password or signInWithProvider() for OAuth.');
        // For backwards compatibility, update guest name
        this.updateGuestProfile({ username: name, display_name: name });
        return this.profile;
    }

    /**
     * @deprecated Use signOut() instead
     */
    logout() {
        console.warn('AuthService.logout() is deprecated. Use signOut() instead.');
        this.signOut();
    }

    /**
     * @deprecated Use updateGuestProfile() or UserService.updateProfile()
     */
    updateProfile(updates) {
        console.warn('AuthService.updateProfile() is deprecated.');
        if (this.profile?.isGuest) {
            this.updateGuestProfile(updates);
        }
    }

    /**
     * @deprecated Use loadUser() is now automatic
     */
    loadUser() {
        // No-op for compatibility
    }

    /**
     * @deprecated Use saveUser() is now automatic
     */
    saveUser() {
        // No-op for compatibility
    }
}
