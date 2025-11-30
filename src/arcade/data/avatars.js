/**
 * Pre-made Avatar Library
 * 
 * These are the default avatars users can choose from.
 * Users can also upload their own custom avatars.
 */

export const AVATAR_LIBRARY = [
    // Arcade/Gaming themed
    { id: 'gun-red', emoji: '🔫', color: '#ff4444', name: 'Red Gun' },
    { id: 'gun-blue', emoji: '🔫', color: '#4444ff', name: 'Blue Gun' },
    { id: 'target', emoji: '🎯', color: '#ff6600', name: 'Target' },
    { id: 'joystick', emoji: '🕹️', color: '#9933ff', name: 'Joystick' },
    { id: 'gamepad', emoji: '🎮', color: '#33cc33', name: 'Gamepad' },
    { id: 'trophy', emoji: '🏆', color: '#ffcc00', name: 'Trophy' },
    { id: 'medal', emoji: '🥇', color: '#ffd700', name: 'Gold Medal' },
    { id: 'star', emoji: '⭐', color: '#ffdd00', name: 'Star' },
    
    // Animals (hunting themed)
    { id: 'duck', emoji: '🦆', color: '#44aa44', name: 'Duck' },
    { id: 'eagle', emoji: '🦅', color: '#8b4513', name: 'Eagle' },
    { id: 'owl', emoji: '🦉', color: '#a0522d', name: 'Owl' },
    { id: 'wolf', emoji: '🐺', color: '#708090', name: 'Wolf' },
    { id: 'fox', emoji: '🦊', color: '#ff6633', name: 'Fox' },
    { id: 'bear', emoji: '🐻', color: '#8b4513', name: 'Bear' },
    { id: 'dog', emoji: '🐕', color: '#d2691e', name: 'Dog' },
    
    // Action/Combat
    { id: 'robot', emoji: '🤖', color: '#888888', name: 'Robot' },
    { id: 'alien', emoji: '👽', color: '#00ff00', name: 'Alien' },
    { id: 'skull', emoji: '💀', color: '#ffffff', name: 'Skull' },
    { id: 'ninja', emoji: '🥷', color: '#333333', name: 'Ninja' },
    { id: 'cowboy', emoji: '🤠', color: '#c19a6b', name: 'Cowboy' },
    { id: 'detective', emoji: '🕵️', color: '#2f4f4f', name: 'Detective' },
    
    // Fun/Misc
    { id: 'fire', emoji: '🔥', color: '#ff4500', name: 'Fire' },
    { id: 'lightning', emoji: '⚡', color: '#ffd700', name: 'Lightning' },
    { id: 'rocket', emoji: '🚀', color: '#ff4444', name: 'Rocket' },
    { id: 'ghost', emoji: '👻', color: '#f8f8ff', name: 'Ghost' },
    { id: 'dragon', emoji: '🐉', color: '#228b22', name: 'Dragon' },
    { id: 'unicorn', emoji: '🦄', color: '#ff69b4', name: 'Unicorn' },
    { id: 'crown', emoji: '👑', color: '#ffd700', name: 'Crown' },
    { id: 'diamond', emoji: '💎', color: '#00bfff', name: 'Diamond' }
];

/**
 * Get avatar by ID
 * @param {string} id - Avatar ID
 * @returns {Object|null}
 */
export function getAvatarById(id) {
    return AVATAR_LIBRARY.find(a => a.id === id) || null;
}

/**
 * Generate SVG data URL for an emoji avatar
 * @param {Object} avatar - Avatar object with emoji and color
 * @param {number} size - Size in pixels
 * @returns {string} Data URL
 */
export function generateAvatarSvg(avatar, size = 128) {
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${avatar.color}"/>
            <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${size * 0.5}">${avatar.emoji}</text>
        </svg>
    `;
    return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

/**
 * Get default avatar for new users
 * @returns {Object}
 */
export function getDefaultAvatar() {
    return AVATAR_LIBRARY[0]; // Red Gun
}
