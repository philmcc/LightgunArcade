export class AuthService {
    constructor() {
        this.currentUser = null;
        this.storageKey = 'lightgun_arcade_user';
        this.loadUser();
    }

    loadUser() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            this.currentUser = JSON.parse(saved);
        } else {
            // Default guest user
            this.currentUser = {
                id: 'guest_' + Date.now(),
                name: 'Guest',
                isGuest: true
            };
            this.saveUser();
        }
    }

    saveUser() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
    }

    login(name) {
        this.currentUser = {
            id: 'user_' + Date.now(), // Simple ID generation
            name: name,
            isGuest: false
        };
        this.saveUser();
        return this.currentUser;
    }

    logout() {
        this.currentUser = {
            id: 'guest_' + Date.now(),
            name: 'Guest',
            isGuest: true
        };
        this.saveUser();
    }

    getCurrentUser() {
        return this.currentUser;
    }

    updateProfile(updates) {
        this.currentUser = { ...this.currentUser, ...updates };
        this.saveUser();
    }
}
