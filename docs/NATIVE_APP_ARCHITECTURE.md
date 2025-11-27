# Native Desktop App Architecture
## Electron vs Tauri Comparison & Architecture Recommendations

**Version**: 1.0  
**Date**: 2025-11-27  
**Status**: Technical Analysis  

---

## TL;DR - Recommendation

**For Lightgun Arcade: Use Tauri**

**Why:**
- ✅ 10x smaller bundle size (10-20MB vs 100-150MB)
- ✅ Lower memory usage (critical for games)
- ✅ Better security (no Node.js exposure)
- ✅ Faster startup time
- ✅ Native performance (Rust backend)
- ✅ Modern architecture (better for future)

**Trade-offs:**
- ⚠️ Smaller ecosystem (but growing rapidly)
- ⚠️ More complex setup (Rust required)
- ⚠️ Less mature (v1.0 released 2022 vs Electron's 2013)

**Verdict**: Tauri's benefits far outweigh the downsides for a game platform.

---

## 1. Detailed Comparison

### Electron

**What It Is:**
- Chromium (browser) + Node.js bundled together
- Created by GitHub (now Microsoft)
- Powers: VS Code, Slack, Discord, Figma, etc.

**Pros:**
- ✅ Mature and battle-tested (2013)
- ✅ Huge ecosystem and community
- ✅ Extensive documentation
- ✅ Easy to get started
- ✅ Full Node.js API access
- ✅ Many tools and libraries available

**Cons:**
- ❌ Large bundle size (100-150MB minimum)
- ❌ High memory usage (100-300MB baseline)
- ❌ Slower startup time
- ❌ Security concerns (Node.js in renderer)
- ❌ Bundles entire Chromium engine

**Bundle Size Example:**
```
Simple "Hello World" app:
- macOS: ~120MB
- Windows: ~150MB
- Linux: ~140MB
```

---

### Tauri

**What It Is:**
- Uses system's native WebView (not bundled Chromium)
- Rust backend for native APIs
- Modern, security-focused architecture
- Created in 2020, v1.0 in 2022

**Pros:**
- ✅ Tiny bundle size (10-20MB)
- ✅ Low memory footprint (20-50MB baseline)
- ✅ Fast startup time
- ✅ Better security (sandboxed by design)
- ✅ Uses native OS WebView (no Chromium bundling)
- ✅ Native performance (Rust)
- ✅ Modern architecture
- ✅ Cross-platform updater built-in

**Cons:**
- ❌ Younger ecosystem (less mature)
- ❌ Smaller community
- ❌ Requires Rust toolchain (for development)
- ❌ WebView differences across platforms (minor)
- ❌ Some Node packages won't work (need Rust alternatives)

**Bundle Size Example:**
```
Simple "Hello World" app:
- macOS: ~5MB
- Windows: ~3MB
- Linux: ~10MB
```

---

## 2. Why Tauri is Better for Lightgun Arcade

### Performance Critical (Games Need Resources)

**Electron:**
- Base memory: 100-300MB
- Your game runs on top of that
- Total: 200-500MB for a simple game

**Tauri:**
- Base memory: 20-50MB
- Your game runs on top of that
- Total: 80-150MB for a simple game

**Benefit**: 150-300MB more memory for your games!

---

### Download Size Matters

**Electron:**
- First download: 150MB
- Updates: Usually 100-150MB (full app)
- User friction: High (slow downloads)

**Tauri:**
- First download: 10-20MB
- Updates: 5-15MB (delta updates)
- User friction: Low (fast downloads)

**Benefit**: Users more likely to download and try!

---

### Security

**Electron:**
- Node.js API exposed to renderer by default
- Easy to make security mistakes
- Requires careful configuration

**Tauri:**
- Sandboxed by design
- Explicit permission model (like mobile apps)
- Secure by default

**Benefit**: Game creators can't accidentally (or maliciously) access user files.

---

### Future-Proof

**Electron:**
- Based on Chromium (Google controls)
- Heavy architecture
- Difficult to optimize further

**Tauri:**
- Modern Rust ecosystem
- Native WebView (OS-optimized)
- Active development with performance focus
- Mobile support coming (iOS/Android)

**Benefit**: Platform can grow to mobile later!

---

## 3. Architecture Recommendations for Web → Native

> **Critical**: Design the web version to be "native-ready" from the start.

### 3.1 Abstraction Layers (Essential)

**DO NOT use browser APIs directly. Use abstractions.**

#### Storage Abstraction

**❌ Bad (Browser-specific):**
```javascript
// Directly using localStorage
const gunProfiles = JSON.parse(localStorage.getItem('gun-profiles'));
```

**✅ Good (Platform-agnostic):**
```javascript
// src/platform/storage.js
export const Storage = {
  async get(key) {
    if (window.__TAURI__) {
      // Native: Use Tauri's store plugin
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = new Store('.settings.dat');
      return await store.get(key);
    } else {
      // Web: Use localStorage
      return Promise.resolve(JSON.parse(localStorage.getItem(key)));
    }
  },
  
  async set(key, value) {
    if (window.__TAURI__) {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = new Store('.settings.dat');
      await store.set(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
};

// Usage (same code for web and native!)
await Storage.set('gun-profiles', profiles);
const profiles = await Storage.get('gun-profiles');
```

---

#### File System Abstraction

**✅ Platform-agnostic file access:**
```javascript
// src/platform/files.js
export const Files = {
  async readGameAsset(gamePath, assetName) {
    if (window.__TAURI__) {
      // Native: Read from local disk
      const { readBinaryFile } = await import('@tauri-apps/api/fs');
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const appDir = await appDataDir();
      const path = await join(appDir, 'games', gamePath, assetName);
      return await readBinaryFile(path);
    } else {
      // Web: Fetch from server
      const response = await fetch(`/games/${gamePath}/${assetName}`);
      return await response.arrayBuffer();
    }
  },
  
  async downloadGame(gameId) {
    if (window.__TAURI__) {
      // Native: Download to local disk
      const { download } = await import('@tauri-apps/api/http');
      const { appDataDir, join } = await import('@tauri-apps/api/path');
      const appDir = await appDataDir();
      const dest = await join(appDir, 'games', gameId);
      await download(`https://api.lightgunarcade.com/games/${gameId}`, dest);
    } else {
      // Web: Not applicable (games loaded via HTTP)
      throw new Error('Game download only available in desktop app');
    }
  }
};
```

---

#### Network Abstraction

**✅ Platform-agnostic HTTP:**
```javascript
// src/platform/http.js
export const HTTP = {
  async request(url, options = {}) {
    if (window.__TAURI__) {
      // Native: Use Tauri's HTTP client (better security)
      const { fetch: tauriFetch } = await import('@tauri-apps/api/http');
      return await tauriFetch(url, options);
    } else {
      // Web: Use fetch
      return await fetch(url, options);
    }
  }
};
```

---

### 3.2 Platform Detection

**Create a platform utility:**
```javascript
// src/platform/detect.js
export const Platform = {
  isNative: () => typeof window.__TAURI__ !== 'undefined',
  isWeb: () => typeof window.__TAURI__ === 'undefined',
  
  isMac: () => navigator.platform.toUpperCase().indexOf('MAC') >= 0,
  isWindows: () => navigator.platform.toUpperCase().indexOf('WIN') >= 0,
  isLinux: () => navigator.platform.toUpperCase().indexOf('LINUX') >= 0,
  
  async getOS() {
    if (this.isNative()) {
      const { type } = await import('@tauri-apps/api/os');
      return await type();
    }
    return navigator.platform;
  }
};

// Usage
if (Platform.isNative()) {
  // Show "Quit" menu item
} else {
  // Show "Close Tab" message
}
```

---

### 3.3 Directory Structure (Prepare for Native)

**Organize code to separate platform logic:**

```
src/
├── platform/           # Platform abstractions (NEW)
│   ├── storage.js     # Storage abstraction
│   ├── files.js       # File system abstraction
│   ├── http.js        # Network abstraction
│   ├── detect.js      # Platform detection
│   └── native/        # Native-only code
│       ├── updater.js
│       └── menu.js
│
├── arcade/            # Core arcade system (unchanged)
│   ├── ArcadeManager.js
│   ├── core/
│   │   ├── GunManager.js
│   │   └── InputRouter.js
│   └── ui/
│
├── games/             # Games (unchanged)
│   ├── not-duck-hunt/
│   └── point-gun/
│
└── services/          # Backend services (mostly unchanged)
    ├── AuthService.js
    ├── UserService.js
    └── SocialService.js
```

---

### 3.4 Asset Loading Strategy

**Support both HTTP (web) and local files (native):**

```javascript
// src/arcade/core/AssetLoader.js
import { Platform } from '../../platform/detect.js';
import { Files } from '../../platform/files.js';

export class AssetLoader {
  constructor(basePath) {
    this.basePath = basePath;
    this.cache = new Map();
  }
  
  async loadImage(path) {
    if (this.cache.has(path)) {
      return this.cache.get(path);
    }
    
    const img = new Image();
    
    if (Platform.isNative()) {
      // Native: Load from local file
      const buffer = await Files.readGameAsset(this.basePath, path);
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      img.src = url;
    } else {
      // Web: Load via HTTP
      img.src = `${this.basePath}/${path}`;
    }
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    
    this.cache.set(path, img);
    return img;
  }
  
  async loadAudio(path) {
    // Similar pattern for audio files
  }
}
```

---

### 3.5 Game Manifest Updates

**Add native-specific metadata:**

```javascript
// game.manifest.json
{
  "id": "my-game",
  "name": "My Game",
  "version": "1.0.0",
  
  // Existing fields...
  
  // NEW: Native app support
  "native": {
    "supported": true,
    "minVersion": "1.0.0",
    "permissions": [
      "storage",      // Local storage access
      "network"       // Internet for scores
    ],
    "downloadSize": 15728640,  // 15MB
    "installSize": 52428800    // 50MB installed
  },
  
  // Asset manifest (for pre-downloading)
  "assets": {
    "images": ["bg.png", "target.png"],
    "sounds": ["shoot.wav", "hit.wav"],
    "totalSize": 5242880  // 5MB
  }
}
```

---

## 4. Recommended Architecture Changes

### 4.1 Now (Phase 1-3): Prepare for Native

**Create Platform Abstraction Layer:**
```
Week 1 of Phase 1:
1. Create src/platform/ directory
2. Implement Storage abstraction
3. Implement Files abstraction  
4. Implement Platform detection
5. Use abstractions in new code
```

**Refactor Existing Code Gradually:**
```
During Phase 2-3:
- Replace localStorage calls with Storage abstraction
- Replace fetch calls with HTTP abstraction
- Test that web version still works
```

---

### 4.2 Phase 9 (Future): Native App Development

**Step 1: Setup Tauri**
```bash
# Install Tauri CLI
cargo install tauri-cli

# Initialize Tauri in project
cd point-blank-game
cargo tauri init

# Answer prompts:
# - App name: Lightgun Arcade
# - Window title: Lightgun Arcade
# - Web assets: dist/
# - Dev server: http://localhost:5173
# - Before dev command: npm run dev
# - Before build command: npm run build
```

**Step 2: Configure Tauri**
```json
// src-tauri/tauri.conf.json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Lightgun Arcade",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "scope": ["$APPDATA/games/*"],
        "readFile": true,
        "writeFile": true
      },
      "http": {
        "scope": ["https://api.lightgunarcade.com/*"]
      }
    },
    "bundle": {
      "active": true,
      "targets": ["dmg", "msi", "deb"],
      "identifier": "com.lightgunarcade.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    },
    "updater": {
      "active": true,
      "endpoints": [
        "https://api.lightgunarcade.com/updates/{{target}}/{{current_version}}"
      ]
    }
  }
}
```

**Step 3: Test**
```bash
# Run in development
cargo tauri dev

# Build for production
cargo tauri build

# Output:
# macOS: .dmg installer (~10-15MB)
# Windows: .msi installer (~8-12MB)
# Linux: .deb installer (~12-18MB)
```

---

## 5. Native-Specific Features to Add

### 5.1 Auto-Updater

**Tauri Built-in Updater:**
```javascript
// src/platform/native/updater.js
export async function checkForUpdates() {
  if (!Platform.isNative()) return null;
  
  const { checkUpdate } = await import('@tauri-apps/api/updater');
  const { relaunch } = await import('@tauri-apps/api/process');
  
  const update = await checkUpdate();
  
  if (update.shouldUpdate) {
    return {
      version: update.manifest.version,
      notes: update.manifest.body,
      async install() {
        await update.downloadAndInstall();
        await relaunch();
      }
    };
  }
  
  return null;
}
```

---

### 5.2 Native Menus

**macOS/Windows/Linux Menu Bar:**
```javascript
// src/platform/native/menu.js
export async function createMenu() {
  if (!Platform.isNative()) return;
  
  const { Menu } = await import('@tauri-apps/api/menu');
  
  const menu = await Menu.new({
    items: [
      {
        id: 'file',
        text: 'File',
        items: [
          { id: 'new-game', text: 'New Game', accelerator: 'Cmd+N' },
          { id: 'settings', text: 'Settings', accelerator: 'Cmd+,' },
          { type: 'separator' },
          { id: 'quit', text: 'Quit', accelerator: 'Cmd+Q' }
        ]
      },
      {
        id: 'games',
        text: 'Games',
        items: [
          { id: 'browse', text: 'Browse Games' },
          { id: 'library', text: 'My Library' },
          { type: 'separator' },
          { id: 'download', text: 'Download New Games' }
        ]
      }
    ]
  });
  
  await menu.setAsAppMenu();
}
```

---

### 5.3 System Tray

**Background App Support:**
```javascript
// src/platform/native/tray.js
export async function createTray() {
  if (!Platform.isNative()) return;
  
  const { TrayIcon } = await import('@tauri-apps/api/tray');
  
  const tray = await TrayIcon.new({
    icon: 'icons/tray-icon.png',
    tooltip: 'Lightgun Arcade',
    menu: {
      items: [
        { id: 'show', text: 'Show Arcade' },
        { id: 'library', text: 'My Games' },
        { type: 'separator' },
        { id: 'quit', text: 'Quit' }
      ]
    }
  });
  
  tray.onClick(() => {
    // Show main window
  });
}
```

---

### 5.4 Offline Game Downloads

**Download Manager:**
```javascript
// src/platform/native/downloads.js
export class GameDownloader {
  async downloadGame(gameId) {
    if (!Platform.isNative()) {
      throw new Error('Downloads only available in desktop app');
    }
    
    const { download } = await import('@tauri-apps/api/http');
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    
    const appDir = await appDataDir();
    const gameDir = await join(appDir, 'games', gameId);
    
    // Download game package
    const url = `https://api.lightgunarcade.com/games/${gameId}/download`;
    
    // Progress callback
    const progress = (event) => {
      const percent = (event.loaded / event.total) * 100;
      this.emit('progress', { gameId, percent });
    };
    
    await download(url, gameDir, { onProgress: progress });
    
    // Extract and install
    await this.extractGame(gameId, gameDir);
    
    this.emit('complete', { gameId });
  }
}
```

---

## 6. Deployment & Distribution

### 6.1 Tauri Release Process

**Build for all platforms:**
```bash
# macOS (on Mac)
cargo tauri build --target universal-apple-darwin

# Windows (on Windows or via CI)
cargo tauri build --target x86_64-pc-windows-msvc

# Linux (on Linux or via CI)
cargo tauri build --target x86_64-unknown-linux-gnu
```

**Output:**
```
macOS:
- Lightgun Arcade.dmg (10-15MB)
- Lightgun Arcade.app (for direct distribution)

Windows:
- Lightgun Arcade_1.0.0_x64_en-US.msi (8-12MB)
- Lightgun Arcade.exe (portable)

Linux:
- lightgun-arcade_1.0.0_amd64.deb (12-18MB)
- lightgun-arcade_1.0.0_amd64.AppImage (portable)
```

---

### 6.2 Distribution Channels

**Option 1: Direct Download** (easiest)
```
Website downloads page:
- macOS: Download .dmg
- Windows: Download .msi
- Linux: Download .deb or .AppImage
```

**Option 2: Package Managers**
```
macOS: Homebrew
brew install lightgun-arcade

Windows: Winget
winget install LightgunArcade.LightgunArcade

Linux: apt/snap
sudo apt install lightgun-arcade
```

**Option 3: Steam** (largest reach)
- Submit via Steamworks
- ~$100 one-time fee
- Huge user base
- Built-in updates
- Payment processing included

**Option 4: Itch.io** (indie-friendly)
- Free to publish
- Good indie game community
- Custom pricing/bundles
- Butler CLI for uploads

---

## 7. Cost Comparison

### Development Costs

**Electron:**
- Bundle size: Large (users pay in bandwidth/storage)
- Memory: High (users need more RAM)
- Development: Easier (faster initial setup)

**Tauri:**
- Bundle size: Small (users save bandwidth/storage)
- Memory: Low (works on lower-end machines)
- Development: Slightly harder (Rust learning curve)

### Distribution Costs

**Electron:**
- Bandwidth: 150MB × downloads = expensive
- Example: 10,000 downloads = 1.5TB bandwidth

**Tauri:**
- Bandwidth: 15MB × downloads = cheap
- Example: 10,000 downloads = 150GB bandwidth
- **Savings: 90% less bandwidth costs!**

---

## 8. Recommended Action Plan

### Phase 1-3 (Now): Prepare Architecture

**Week 1 of Phase 1:**
- [x] Create `src/platform/` directory structure
- [x] Implement Storage abstraction
- [x] Implement Files abstraction
- [x] Implement Platform detection
- [x] Document abstraction patterns

**During Phase 2-3:**
- [x] Gradually replace direct browser API calls
- [x] Test with both abstraction and direct calls
- [x] Ensure web version works identically

**By End of Phase 3:**
- [x] All storage uses Storage abstraction
- [x] All file access uses Files abstraction
- [x] All HTTP uses HTTP abstraction
- [x] 100% web functionality maintained

---

### Phase 9 (Future): Native App Development

**Week 1:**
- [ ] Install Rust and Tauri CLI
- [ ] Initialize Tauri in project
- [ ] Configure tauri.conf.json
- [ ] Test basic Tauri dev environment

**Week 2:**
- [ ] Implement native-specific features (menus, tray)
- [ ] Setup auto-updater
- [ ] Configure download manager
- [ ] Test on all platforms

**Week 3:**
- [ ] Build release versions
- [ ] Code sign applications (Mac/Windows)
- [ ] Create installers
- [ ] Upload to distribution channels

**Week 4:**
- [ ] Beta testing
- [ ] Fix platform-specific bugs
- [ ] Performance optimization
- [ ] Launch!

---

## 9. Migration Path for Users

### Scenario: User has been using web version

**Native app installation:**
1. User downloads native app
2. Native app detects existing web data (cookies/localStorage)
3. Offers to import:
   - Gun profiles
   - Settings
   - Offline scores (not uploaded yet)
4. Syncs from server:
   - User account
   - Friends
   - Leaderboards
   - Purchased games (future)

**Data sync:**
- User can use both web and native
- Scores sync via Supabase
- Settings sync via Supabase (Phase 2+)
- Games download in native, stream in web

---

## 10. Final Recommendation

### Use Tauri + Prepare Architecture Now

**Immediate (Phase 1-3):**
1. Create platform abstraction layer
2. Use abstractions in all new code
3. Gradually refactor existing code
4. Keep web version as primary target

**Future (Phase 9):**
1. Add Tauri configuration
2. Test native version
3. Build and distribute
4. Maintain both web and native

**Benefits:**
- ✅ No architectural debt
- ✅ Smooth transition to native
- ✅ Best performance for users
- ✅ Lower distribution costs
- ✅ Modern, future-proof architecture

---

**The architecture is designed to support both platforms from day one, so adding the native app later will be seamless!**

---

**Document Version**: 1.0  
**Created**: 2025-11-27  
**Status**: Technical Recommendation
