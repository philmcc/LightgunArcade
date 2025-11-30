import { supabase, isSupabaseConfigured } from '../../platform/supabase.js';
import { generateAvatarSvg, getAvatarById, AVATAR_LIBRARY } from '../data/avatars.js';

/**
 * UserService - Manages user profiles and data
 * 
 * Handles:
 * - Profile CRUD operations
 * - Avatar management (upload and library selection)
 * - Privacy settings
 * - User search
 * - Profile statistics
 */
export class UserService {
    constructor(authService) {
        this.auth = authService;
    }

    /**
     * Get the current user's profile
     * @returns {Object|null}
     */
    getCurrentProfile() {
        return this.auth.getCurrentUser();
    }

    /**
     * Get a user's profile by ID
     * @param {string} userId 
     * @returns {Promise<{profile: Object, error: Error}>}
     */
    async getProfile(userId) {
        if (!isSupabaseConfigured()) {
            return { profile: null, error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            return { profile: null, error };
        }

        return { profile: data, error: null };
    }

    /**
     * Get a user's profile by username
     * @param {string} username 
     * @returns {Promise<{profile: Object, error: Error}>}
     */
    async getProfileByUsername(username) {
        if (!isSupabaseConfigured()) {
            return { profile: null, error: new Error('Supabase not configured') };
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username.toLowerCase())
            .single();

        if (error) {
            return { profile: null, error };
        }

        return { profile: data, error: null };
    }

    /**
     * Update the current user's profile
     * @param {Object} updates - Fields to update
     * @returns {Promise<{profile: Object, error: Error}>}
     */
    async updateProfile(updates) {
        if (!isSupabaseConfigured()) {
            return { profile: null, error: new Error('Supabase not configured') };
        }

        const user = this.auth.currentUser;
        if (!user) {
            return { profile: null, error: new Error('Not authenticated') };
        }

        // Validate username if being updated
        if (updates.username) {
            const usernameError = this._validateUsername(updates.username);
            if (usernameError) {
                return { profile: null, error: new Error(usernameError) };
            }

            // Check if username is taken
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', updates.username.toLowerCase())
                .neq('id', user.id)
                .single();

            if (existing) {
                return { profile: null, error: new Error('Username is already taken') };
            }

            updates.username = updates.username.toLowerCase();
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (error) {
            return { profile: null, error };
        }

        // Update local profile
        this.auth.profile = { ...this.auth.profile, ...data };

        return { profile: data, error: null };
    }

    /**
     * Update privacy settings
     * @param {Object} settings - Privacy settings to update
     * @returns {Promise<{error: Error}>}
     */
    async updatePrivacySettings(settings) {
        const currentProfile = this.getCurrentProfile();
        if (!currentProfile) {
            return { error: new Error('Not authenticated') };
        }

        const newSettings = {
            ...currentProfile.privacy_settings,
            ...settings
        };

        const { error } = await this.updateProfile({
            privacy_settings: newSettings
        });

        return { error };
    }

    /**
     * Upload a custom avatar
     * @param {File} file - Image file to upload
     * @returns {Promise<{url: string, error: Error}>}
     */
    async uploadAvatar(file) {
        if (!isSupabaseConfigured()) {
            return { url: null, error: new Error('Supabase not configured') };
        }

        const user = this.auth.currentUser;
        if (!user) {
            return { url: null, error: new Error('Not authenticated') };
        }

        // Validate file
        if (!file.type.startsWith('image/')) {
            return { url: null, error: new Error('File must be an image') };
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            return { url: null, error: new Error('Image must be less than 2MB') };
        }

        // Generate unique filename
        const ext = file.name.split('.').pop();
        const filename = `${user.id}/avatar_${Date.now()}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filename, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            return { url: null, error: uploadError };
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filename);

        // Update profile with new avatar URL
        await this.updateProfile({ avatar_url: publicUrl });

        return { url: publicUrl, error: null };
    }

    /**
     * Set avatar from the pre-made library
     * @param {string} avatarId - ID from AVATAR_LIBRARY
     * @returns {Promise<{url: string, error: Error}>}
     */
    async setLibraryAvatar(avatarId) {
        const avatar = getAvatarById(avatarId);
        if (!avatar) {
            return { url: null, error: new Error('Avatar not found') };
        }

        const url = generateAvatarSvg(avatar);
        const { error } = await this.updateProfile({ avatar_url: url });

        return { url, error };
    }

    /**
     * Get the avatar library
     * @returns {Array}
     */
    getAvatarLibrary() {
        return AVATAR_LIBRARY;
    }

    /**
     * Search for users by username
     * @param {string} query - Search query
     * @param {number} limit - Max results
     * @returns {Promise<{users: Array, error: Error}>}
     */
    async searchUsers(query, limit = 10) {
        if (!isSupabaseConfigured()) {
            return { users: [], error: new Error('Supabase not configured') };
        }

        if (!query || query.length < 2) {
            return { users: [], error: null };
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .ilike('username', `%${query}%`)
            .limit(limit);

        if (error) {
            return { users: [], error };
        }

        return { users: data, error: null };
    }

    /**
     * Update last active timestamp
     */
    async updateLastActive() {
        if (!isSupabaseConfigured() || !this.auth.currentUser) {
            return;
        }

        await supabase
            .from('profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('id', this.auth.currentUser.id);
    }

    /**
     * Get user statistics
     * @param {string} userId - Optional, defaults to current user
     * @returns {Promise<{stats: Object, error: Error}>}
     */
    async getStats(userId = null) {
        const targetId = userId || this.auth.currentUser?.id;
        if (!targetId) {
            return { stats: null, error: new Error('No user specified') };
        }

        if (!isSupabaseConfigured()) {
            return { stats: null, error: new Error('Supabase not configured') };
        }

        // Get profile stats
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stats')
            .eq('id', targetId)
            .single();

        if (profileError) {
            return { stats: null, error: profileError };
        }

        // Get score count
        const { count: scoreCount } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetId);

        // Get personal bests count
        const { count: pbCount } = await supabase
            .from('personal_bests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetId);

        return {
            stats: {
                ...profile.stats,
                total_scores: scoreCount || 0,
                personal_bests: pbCount || 0
            },
            error: null
        };
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
}
