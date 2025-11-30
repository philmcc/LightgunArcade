import { AVATAR_LIBRARY, generateAvatarSvg, getDefaultAvatar } from '../data/avatars.js';

/**
 * EditProfileScreen - Profile editing with avatar selection
 * 
 * Features:
 * - Edit display name
 * - Select from pre-made avatars
 * - Upload custom avatar
 * - Privacy settings
 */
export class EditProfileScreen {
    constructor(container, options = {}) {
        this.container = container;
        this.userService = options.userService;
        this.authService = options.authService;
        this.onBack = options.onBack || (() => {});
        this.onSave = options.onSave || (() => {});
        
        this.profile = null;
        this.selectedAvatar = null;
        this.customAvatarFile = null;
        this.isLoading = false;
        this.isSaving = false;
    }

    async show() {
        this.renderLoading();
        await this.loadProfile();
        this.render();
    }

    async loadProfile() {
        this.isLoading = true;

        try {
            // Get current user's profile from auth service
            this.profile = this.authService.getCurrentUser();
            this.selectedAvatar = this.profile?.avatar_url || null;
        } catch (error) {
            console.error('Failed to load profile:', error);
        }

        this.isLoading = false;
    }

    render() {
        if (!this.profile) {
            this.container.innerHTML = `
                <div class="screen edit-profile-screen">
                    <h1>EDIT PROFILE</h1>
                    <div class="error-state">Failed to load profile</div>
                    <button id="btn-back" class="back-btn">BACK</button>
                </div>
            `;
            this.container.querySelector('#btn-back').onclick = () => this.onBack();
            return;
        }

        this.container.innerHTML = `
            <div class="screen edit-profile-screen">
                <h1>EDIT PROFILE</h1>
                
                <div class="profile-form">
                    <div class="avatar-section">
                        <div class="current-avatar">
                            ${this._renderCurrentAvatar()}
                        </div>
                        
                        <div class="avatar-tabs">
                            <button class="avatar-tab active" data-tab="library">Library</button>
                            <button class="avatar-tab" data-tab="upload">Upload</button>
                        </div>
                        
                        <div class="avatar-content" id="avatar-content">
                            ${this._renderAvatarLibrary()}
                        </div>
                    </div>
                    
                    <div class="form-section">
                        <div class="form-group">
                            <label for="display-name">Display Name</label>
                            <input type="text" id="display-name" 
                                   value="${this.profile.display_name || ''}" 
                                   placeholder="Enter display name"
                                   maxlength="30">
                        </div>
                        
                        <div class="form-group">
                            <label for="bio">Bio</label>
                            <textarea id="bio" 
                                      placeholder="Tell us about yourself..."
                                      maxlength="200">${this.profile.bio || ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" value="@${this.profile.username}" disabled class="disabled-input">
                            <span class="hint">Username cannot be changed</span>
                        </div>
                    </div>
                    
                    <div class="privacy-section">
                        <h3>Privacy Settings</h3>
                        
                        <div class="privacy-option">
                            <label>
                                <input type="checkbox" id="privacy-scores" 
                                       ${this.profile.privacy_settings?.show_scores !== false ? 'checked' : ''}>
                                Show my scores on leaderboards
                            </label>
                        </div>
                        
                        <div class="privacy-option">
                            <label>
                                <input type="checkbox" id="privacy-activity" 
                                       ${this.profile.privacy_settings?.show_activity !== false ? 'checked' : ''}>
                                Show my activity in feed
                            </label>
                        </div>
                        
                        <div class="privacy-option">
                            <label>
                                <input type="checkbox" id="privacy-online" 
                                       ${this.profile.privacy_settings?.show_online_status !== false ? 'checked' : ''}>
                                Show when I'm online
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button id="btn-save" class="btn-primary" ${this.isSaving ? 'disabled' : ''}>
                        ${this.isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                    <button id="btn-cancel" class="btn-secondary">CANCEL</button>
                </div>
                
                <div id="save-message" class="save-message" style="display: none;"></div>
            </div>
        `;

        this._attachEventListeners();
    }

    _renderCurrentAvatar() {
        if (this.selectedAvatar) {
            return `<img src="${this.selectedAvatar}" alt="Current avatar" class="avatar-preview">`;
        }
        return '<div class="avatar-placeholder-large">👤</div>';
    }

    _renderAvatarLibrary() {
        return `
            <div class="avatar-library">
                ${AVATAR_LIBRARY.map(avatar => {
                    const avatarUrl = generateAvatarSvg(avatar);
                    const isSelected = this.selectedAvatar === avatarUrl;
                    return `
                        <div class="avatar-option ${isSelected ? 'selected' : ''}" 
                             data-avatar-id="${avatar.id}"
                             title="${avatar.name}">
                            <img src="${avatarUrl}" alt="${avatar.name}">
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    _renderUploadSection() {
        return `
            <div class="avatar-upload">
                <p>Upload a custom avatar image</p>
                <input type="file" id="avatar-file" accept="image/*" style="display: none;">
                <button id="btn-choose-file" class="btn-secondary">Choose File</button>
                ${this.customAvatarFile ? `
                    <div class="upload-preview">
                        <img src="${URL.createObjectURL(this.customAvatarFile)}" alt="Preview">
                        <button id="btn-upload" class="btn-primary">Upload</button>
                    </div>
                ` : ''}
                <p class="hint">Max size: 2MB. Recommended: 200x200px</p>
            </div>
        `;
    }

    renderLoading() {
        this.container.innerHTML = `
            <div class="screen edit-profile-screen">
                <h1>EDIT PROFILE</h1>
                <div class="loading">Loading profile...</div>
            </div>
        `;
    }

    _attachEventListeners() {
        // Back/Cancel
        const cancelBtn = this.container.querySelector('#btn-cancel');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.onBack();
        }

        // Save
        const saveBtn = this.container.querySelector('#btn-save');
        if (saveBtn) {
            saveBtn.onclick = () => this._saveProfile();
        }

        // Avatar tabs
        this.container.querySelectorAll('.avatar-tab').forEach(tab => {
            tab.onclick = () => {
                this.container.querySelectorAll('.avatar-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const content = this.container.querySelector('#avatar-content');
                if (tab.dataset.tab === 'library') {
                    content.innerHTML = this._renderAvatarLibrary();
                    this._attachAvatarListeners();
                } else {
                    content.innerHTML = this._renderUploadSection();
                    this._attachUploadListeners();
                }
            };
        });

        // Avatar selection
        this._attachAvatarListeners();
    }

    _attachAvatarListeners() {
        this.container.querySelectorAll('.avatar-option').forEach(option => {
            option.onclick = () => {
                // Find the avatar in library
                const avatarId = option.dataset.avatarId;
                const avatar = AVATAR_LIBRARY.find(a => a.id === avatarId);
                if (avatar) {
                    this.selectedAvatar = generateAvatarSvg(avatar);
                    this.customAvatarFile = null;
                    
                    // Update UI
                    this.container.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');
                    
                    const preview = this.container.querySelector('.current-avatar');
                    if (preview) {
                        preview.innerHTML = this._renderCurrentAvatar();
                    }
                }
            };
        });
    }

    _attachUploadListeners() {
        const fileInput = this.container.querySelector('#avatar-file');
        const chooseBtn = this.container.querySelector('#btn-choose-file');
        
        if (chooseBtn && fileInput) {
            chooseBtn.onclick = () => fileInput.click();
            
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        this._showMessage('File too large. Max size is 2MB.', 'error');
                        return;
                    }
                    this.customAvatarFile = file;
                    
                    const content = this.container.querySelector('#avatar-content');
                    content.innerHTML = this._renderUploadSection();
                    this._attachUploadListeners();
                }
            };
        }

        const uploadBtn = this.container.querySelector('#btn-upload');
        if (uploadBtn) {
            uploadBtn.onclick = () => this._uploadAvatar();
        }
    }

    async _uploadAvatar() {
        if (!this.customAvatarFile) return;

        this._showMessage('Uploading...', 'info');

        try {
            const { url, error } = await this.userService.uploadAvatar(this.customAvatarFile);
            
            if (error) {
                this._showMessage(error.message || 'Upload failed', 'error');
                return;
            }

            this.selectedAvatar = url;
            this.customAvatarFile = null;
            
            const preview = this.container.querySelector('.current-avatar');
            if (preview) {
                preview.innerHTML = this._renderCurrentAvatar();
            }
            
            this._showMessage('Avatar uploaded!', 'success');
        } catch (error) {
            this._showMessage('Upload failed', 'error');
        }
    }

    async _saveProfile() {
        this.isSaving = true;
        this.render();

        try {
            const displayName = this.container.querySelector('#display-name')?.value.trim();
            const bio = this.container.querySelector('#bio')?.value.trim();
            
            const privacySettings = {
                show_scores: this.container.querySelector('#privacy-scores')?.checked ?? true,
                show_activity: this.container.querySelector('#privacy-activity')?.checked ?? true,
                show_online_status: this.container.querySelector('#privacy-online')?.checked ?? true
            };

            const updates = {
                display_name: displayName || null,
                bio: bio || null,
                privacy_settings: privacySettings
            };

            // Update avatar if changed
            if (this.selectedAvatar && this.selectedAvatar !== this.profile.avatar_url) {
                updates.avatar_url = this.selectedAvatar;
            }

            const { error } = await this.userService.updateProfile(updates);

            if (error) {
                this._showMessage(error.message || 'Save failed', 'error');
                this.isSaving = false;
                this.render();
                return;
            }

            this._showMessage('Profile saved!', 'success');
            
            // Refresh auth profile
            await this.authService.loadProfile();
            
            this.isSaving = false;
            
            // Callback
            setTimeout(() => {
                this.onSave();
            }, 1000);

        } catch (error) {
            this._showMessage('Save failed', 'error');
            this.isSaving = false;
            this.render();
        }
    }

    _showMessage(message, type = 'info') {
        const msgEl = this.container.querySelector('#save-message');
        if (msgEl) {
            msgEl.textContent = message;
            msgEl.className = `save-message ${type}`;
            msgEl.style.display = 'block';
            
            if (type === 'success') {
                setTimeout(() => {
                    msgEl.style.display = 'none';
                }, 3000);
            }
        }
    }
}
