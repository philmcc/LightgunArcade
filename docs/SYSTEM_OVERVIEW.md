# Lightgun Arcade - System Overview
## Complete Feature & Capability Specification

**Version**: 1.0  
**Date**: 2025-11-27  
**Status**: Specification Document  

---

## 1. What is Lightgun Arcade?

**Lightgun Arcade** is a web-based platform for creating, playing, and sharing lightgun games. It provides a unified arcade system where multiple games integrate seamlessly with shared infrastructure for user accounts, social features, tournaments, and multiplayer support.

### Core Vision
- 🎮 **Plug-and-Play Games**: Developers create games using a standard SDK; games automatically integrate with all platform features
- 🔫 **Multi-Gun Support**: Full support for multiple lightgun devices with configuration, calibration, and simultaneous use
- 👥 **Social Platform**: Users connect with friends, compete on leaderboards, and participate in tournaments
- 🌍 **Community Driven**: Users can create and share games, assets, and compete in community events
- 🤖 **AI-Assisted Creation**: Non-technical users can create games through conversational AI
- 🌐 **Multiplayer Ready**: Local and online multiplayer support built into the platform

---

## 2. Core Platform Features

### 2.1 Multi-Gun Hardware Support

**Hardware Compatibility**:
- ✅ Sinden Lightguns
- ✅ Gun4IR devices
- ✅ Generic USB lightguns
- ✅ Mouse/touch (fallback)
- ✅ Support for 2-4 guns simultaneously

**Gun Configuration**:
- **Device Detection**: "Press a button" workflow to assign guns to players
- **Button Mapping**: Configure trigger, start/pause, and action buttons
- **Reload Detection**: Automatic detection of off-screen reload capability with fallback for unsupported guns
- **Calibration**: 4-point calibration system for accuracy
- **Persistent Profiles**: Gun configurations saved and auto-restored
- **Per-Gun Settings**: Each gun maintains independent configuration

**Input Features**:
- <16ms input latency (critical for responsive gameplay)
- Simultaneous multi-gun input routing
- Per-player coordinate transformation
- Automatic reload action detection
- Button press event routing

---

### 2.2 User System & Authentication

**Account Types**:
- **Guest Accounts**: Play locally without registration, scores saved locally
- **Registered Accounts**: Full access to social features and online services
- **Account Linking**: Convert guest account to registered account, preserving data

**Authentication Methods**:
- Email/password
- OAuth (Google, Discord, GitHub)
- Session persistence
- Auto-login (optional)

**User Profiles**:
- Unique username
- Avatar (upload or select from library)
- Bio/description
- Privacy settings (profile, activity, friend requests)
- Account creation date
- Last active tracking

---

### 2.3 Social Features

**Friends System**:
- Send/accept/decline friend requests
- Remove friends
- Block users
- Friend list with online status
- Search by username
- Suggested friends (mutual friends, recently played with)
- QR code friend adding (for local arcade setups)
- Privacy controls (who can send requests, visibility settings)

**Activity Feed**:
- Real-time updates of friends' activities
- Feed items:
  - High scores posted
  - Games played (including who they played with)
  - Achievements unlocked
  - Tournament participation/wins
  - Friend added
  - New games published
- Reactions (like, trophy, fire emojis)
- Comments on activities
- Filter by friend or game
- Infinite scroll pagination

**Leaderboards**:
- **Per-Game Leaderboards**: Each game has its own leaderboard
- Global top scores per game/mode/difficulty
- Time-based filters (all-time, monthly, weekly, daily)
- Friends-only leaderboards
- Personal bests tracking
- Percentile ranking
- Pagination and search

**User Statistics Dashboard**:
- Games played with frequency
- Total playtime per game
- Last played timestamps
- Score progression graphs over time
- Accuracy trends
- Most played games
- Friends played with (frequency)
- Play time heatmaps (by day/hour)
- Achievement completion percentage
- Leaderboard position history

**Play History Tracking**:
- Session data (date, time, duration)
- Game, mode, difficulty
- Players involved (if multiplayer)
- Scores achieved
- Optional replay data (for tournaments)

---

### 2.4 Tournament System

**Tournament Types**:

**Asynchronous Tournaments**:
- Time-limited competitions (hours, days, weeks)
- Flexible attempt limits:
  - Unlimited attempts (best score wins)
  - Limited attempts (e.g., 3 tries, best score counts)
  - Single attempt only (one shot)
- Score submission rules:
  - Best score
  - Average of all attempts
  - Cumulative score
- Entry requirements (level, achievements, etc.)
- Tournament-specific leaderboards

**Synchronous Tournaments**:
- Scheduled live events
- All players compete simultaneously
- Real-time leaderboard updates
- Bracket systems (single/double elimination)
- Live spectator mode (Phase 8)

**Tournament Management**:
- **User Roles**: Player, Organizer, Moderator, Admin
- **Organizer Features**:
  - Create tournaments
  - Configure rules (attempts, time window, scoring)
  - Set entry requirements
  - Optional prizes/rewards
  - Visibility settings (public/private/invite-only)
- **Tournament Lobby**: Chat, participant list
- **Results Page**: Rankings, replays, statistics

**Tournament UI**:
- "TOURNAMENTS" button on main arcade menu
- Badge showing active tournament count
- Tournament hub with tabs:
  - Upcoming (future scheduled)
  - Live/Active (currently running)
  - Past (historical with results)
  - My Tournaments (user's participation)
- Filters by game, type, status

---

### 2.5 Local Multiplayer

**Player Support**:
- 1-4 players simultaneously
- Each player assigned to their own gun
- Guest players (no account required)
- Registered players (stats tracked)
- Player selection screen before game starts

**Multiplayer Modes** (All Games Required to Support):
- **Simultaneous Play**: All players shoot at the same time
  - Co-op: Team objectives, shared/combined scoring
  - Versus: Competitive, individual scoring
- **Turn-Based**: Players take turns
  - Hot-seat style
  - Round-robin turns

**Multiplayer UX**:
- Color coding per player (P1=blue, P2=red, etc.)
- Screen zones/sections per player
- Individual HUD elements (score, ammo, etc.)
- Name tags or icons for identification
- Turn indicators (for turn-based)
- Team status (for co-op)
- Post-game results:
  - Individual player scores
  - Winner announcement
  - Statistics breakdown per player
  - Rematch option

---

### 2.6 Online Multiplayer (Phase 8)

**Real-Time Features**:
- WebSocket infrastructure
- Server-authoritative game state (anti-cheat)
- Client-side prediction for responsiveness
- State reconciliation
- Snapshot interpolation

**Matchmaking**:
- Quick match (automatic pairing)
- Private lobbies (invite friends)
- Skill-based matchmaking (optional)
- Region-based matching (reduce latency)

**Game Modes**:
- Online co-op (team objectives)
- Online versus (head-to-head)
- Online tournaments with spectators

**Spectator Mode**:
- Watch friends or tournament players live
- Multiple camera angles (if game supports)
- Spectator UI (scores, stats, player info)
- Replay browser (watch past games)
- Share replay links
- Downloadable replay files

**Technical**:
- Input validation (server validates shots)
- Latency compensation (handle network delays)
- Disconnection handling (graceful degradation)
- Cross-input support (any gun type works online)
- Target: <100ms latency

---

## 3. Game Development Features

### 3.1 Game SDK

**Purpose**: Standardized SDK that handles all platform integration, allowing developers to focus on gameplay.

**Core SDK Features**:
- **BaseGame Class**: Standard interface all games implement
- **Input Handling**: Multi-gun input automatically routed to games
- **Persistence Layer**: Automatic score/progress saving
- **User Integration**: Access to user profiles, stats
- **Social Integration**: Automatic leaderboard/activity feed integration
- **Asset Loading**: Utilities for loading images, sounds, fonts
- **HUD Helpers**: UI component builders

**SDK Packages** (Modular - import only what you need):
- **Core** (required): BaseGame, input, persistence, social
- **Managers** (optional): LevelManager, AssetLoader, SoundManager
- **Systems** (optional): GameOrchestrator, CampaignManager, ProgressionSystem
- **Multiplayer** (optional): PlayerManager, TurnManager
- **UI** (optional): HUDBuilder, MenuSystem, TransitionEffects
- **Utils** (optional): Physics, Collision, Pathfinding, Particles

**Game Complexity Support**:
- **Level 1**: Simple single-screen shooters
- **Level 2**: Multi-level games (Duck Hunt style)
- **Level 3**: Mini-game collections (Point Gun style)
- **Level 4**: Campaign modes with progression
- **Level 5**: Boss battles, procedural generation
- **Level 6**: 3D rail shooters (Three.js/Babylon.js support)

**Rendering Support**:
- Canvas 2D
- WebGL (custom)
- Three.js (3D games)
- Babylon.js (3D games)
- PixiJS (high-performance 2D)
- Any custom engine

**Developer Tools**:
- CLI: `npx create-lightgun-game my-game`
- Scaffolding templates (basic, advanced, multiplayer)
- Local dev server with hot reload
- Validation and testing tools
- Packaging tool for distribution

**Documentation**:
- Complete API reference
- Step-by-step tutorials
- Migration guides
- Best practices
- Code examples

---

### 3.2 Game Standards

**Required Interface**:
All games must implement:
- `static getManifest()` - Returns game metadata
- `constructor(canvas, uiLayer, arcadeSystem, players)` - Setup
- `async init()` - Load assets, initialize
- `destroy()` - Cleanup resources
- `update(deltaTime)` - Game logic (60 FPS)
- `draw(ctx)` - Render to canvas
- `onShoot(playerId, x, y, button)` - Handle shooting
- `onReload(playerId)` - Handle reload (optional)
- `onButtonPress(playerId, button)` - Handle button presses
- `pause()` / `resume()` - Handle pausing
- `onGameStart()` / `onGameEnd()` - Lifecycle hooks

**Multiplayer Support**:
- All games MUST support at least 2 players
- Declare supported modes in manifest
- Implement co-op OR versus OR both

**Score Format** (Standardized):
```javascript
{
  playerId: string,
  score: number,
  metadata: {
    accuracy: number,      // Hit % (0-100)
    targetsShotdown: number,
    totalShots: number,
    comboMax: number,
    timeElapsed: number,
    difficulty: string,
    mode: string
    // Game-specific extras allowed
  }
}
```

**Performance Requirements**:
- 60 FPS minimum
- Input latency <16ms
- Load time <3 seconds
- Proper resource cleanup

**Accessibility Requirements**:
- Colorblind modes supported
- Audio cues for visual events
- Readable text (minimum 16px)
- High contrast mode option

---

### 3.3 Community Content Platform

**Asset Library**:

**Stock Assets** (Seeded by Platform):
- 20+ backgrounds (countryside, city, space, etc.)
- 50+ target sprites (animals, objects, enemies)
- 100+ sound effects (gunshots, hits, explosions)
- 10+ music tracks
- UI elements (buttons, icons, fonts)

**Community Uploads**:
- Asset submission form
- File type validation (PNG, JPG, SVG, WAV, MP3, OGG)
- File size limits (images: 5MB, audio: 10MB)
- Metadata (name, description, tags, license)
- Preview thumbnails

**Moderation System**:
- All uploads go to moderation queue
- Admin/moderator approval required
- Automated scanning:
  - Inappropriate content detection
  - Malware scanning
  - Copyright detection
- Manual review
- Rejection with reason

**Asset Discovery**:
- Browse by category
- Tag-based filtering
- Search functionality
- Sort by popularity, newest, highest rated
- Usage statistics
- Ratings and reviews

**Asset Management**:
- License tracking (CC0, CC-BY, etc.)
- Version control
- Deprecation warnings
- Asset packs (bundled assets)

**Game Submission**:
- Package game as ZIP/tarball
- Manifest validation
- Asset validation
- Automated testing:
  - Game loads successfully
  - Implements required interfaces
  - Performance benchmarks pass
  - No errors during test run
- Manual review (for public listing)

**Game Discovery**:
- Featured games carousel
- Browse all games
- Filter by tags, author, rating
- Search functionality
- Trending games

---

### 3.4 AI Game Creation (Phase 7)

**Web-Based AI Builder**:

**Asset Selection**:
- Browse stock and community assets
- Select backgrounds, targets, sounds, music
- Preview selected assets
- Add to game project

**Conversational Design**:
- Chat interface with AI agent
- User describes game concept
- AI asks clarifying questions:
  - Game mechanics
  - Difficulty progression
  - Scoring system
  - Round structure
  - Special features
- Iterative back-and-forth
- Summary for approval

**Generation**:
- AI generates game code using SDK
- Creates manifest file
- Links selected assets
- Automated testing

**Preview & Iteration**:
- User plays generated game
- Provides feedback
- AI regenerates with changes
- Repeat until satisfied

**Publishing**:
- Submit to arcade
- Automated validation
- Manual review (optional)
- Game goes live

**Local Development Alternative**:
- Download SDK via CLI
- Build locally with coding assistant
- Package and upload
- Works alongside AI builder

---

## 4. Data & Persistence

### 4.1 Database (Supabase PostgreSQL)

**Tables**:
- `profiles` - User accounts, roles, settings
- `friendships` - Friend relationships
- `games` - Registered games, metadata
- `scores` - All game scores
- `play_sessions` - Activity tracking
- `activity_feed` - Social activity posts
- `activity_reactions` - Reactions to posts
- `activity_comments` - Comments on posts
- `tournaments` - Tournament configurations
- `tournament_participants` - Users in tournaments
- `tournament_scores` - Scores within tournaments
- `assets` - Community uploaded assets

**Features**:
- Row-level security (RLS)
- Real-time subscriptions (WebSockets)
- Edge functions (serverless logic)
- Automatic backups
- Scalable (handles growth)

---

### 4.2 Storage (Supabase Storage)

**Stored Content**:
- User avatars
- Game thumbnails and banners
- Community assets (images, audio)
- Game packages (ZIPs)
- Replay files (optional)

**Features**:
- CDN delivery
- File size limits
- Access control
- Automatic optimization

---

### 4.3 Client Storage

**LocalStorage**:
- Gun configurations (Phase 1)
- Settings and preferences
- Quick-access data

**IndexedDB**:
- Large assets (cached)
- Offline game data
- Replay files

**Service Worker**:
- Offline support
- Asset caching
- Progressive web app (PWA) support

---

## 5. User Roles & Permissions

### 5.1 Role Hierarchy

**Player** (default):
- Play games
- Post scores
- Join tournaments
- Add friends
- Comment/react to activity

**Organizer**:
- All Player permissions
- Create tournaments
- Manage own tournaments
- View participant data

**Moderator**:
- All Organizer permissions
- Moderate community content
- Approve/reject asset uploads
- Approve/reject game submissions
- Ban/warn users
- Moderate comments

**Admin**:
- All Moderator permissions
- Manage user roles
- Platform configuration
- Access to all data
- System administration

---

## 6. System Architecture

### 6.1 High-Level Components

```
┌─────────────────────────────────────────┐
│         Frontend (Browser)              │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Arcade System                │ │
│  │  - Game Registry                  │ │
│  │  - Gun Manager                    │ │
│  │  - Input Router                   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Services                     │ │
│  │  - Auth Service                   │ │
│  │  - User Service                   │ │
│  │  - Social Service                 │ │
│  │  - Tournament Service             │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Games (SDK-based)            │ │
│  │  - Not Duck Hunt                  │ │
│  │  - Point Gun                      │ │
│  │  - Community Games                │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      Backend (Supabase)                 │
│                                         │
│  - PostgreSQL Database                  │
│  - Authentication                       │
│  - Storage Buckets                      │
│  - Realtime Server (WebSockets)         │
│  - Edge Functions                       │
└─────────────────────────────────────────┘
```

---

### 6.2 Technology Stack

**Frontend**:
- Vanilla JavaScript (modular ES6+)
- Vite (build tooling)
- Canvas 2D / WebGL (rendering)
- Pointer Events API (input)
- LocalStorage (client persistence)

**Backend**:
- Supabase (PostgreSQL, Auth, Storage, Realtime)
- Edge Functions (Deno-based serverless)

**Game Rendering** (developer choice):
- Canvas 2D (simple games)
- WebGL (advanced 2D/3D)
- Three.js (3D games)
- Babylon.js (3D games)
- PixiJS (high-performance 2D)
- Custom engines

---

## 7. Platform Capabilities Summary

### What Users Can Do:
✅ Play lightgun games with real lightguns or mouse  
✅ Configure multiple guns for local multiplayer  
✅ Create accounts and profiles  
✅ Add friends and see their activity  
✅ Compete on per-game leaderboards  
✅ Join or create tournaments  
✅ Track personal statistics and progress  
✅ Participate in local multiplayer (2-4 players)  
✅ Participate in online multiplayer (Phase 8)  
✅ Upload and share assets  
✅ Create games with AI assistance  
✅ Browse and play community games  

### What Developers Can Do:
✅ Create games using standardized SDK  
✅ Support any complexity level (simple to 3D)  
✅ Use any rendering technology  
✅ Automatically integrate with all platform features  
✅ Access user data, scores, achievements  
✅ Support tournaments automatically  
✅ Package and distribute games  
✅ Iterate with local development tools  

### What Organizers Can Do:
✅ Create tournaments (async or sync)  
✅ Configure tournament rules  
✅ Set entry requirements  
✅ Manage participants  
✅ View results and analytics  

### What Moderators Can Do:
✅ Approve/reject community content  
✅ Manage inappropriate content  
✅ Monitor user behavior  
✅ Ensure platform quality  

---

## 8. Unique Features & Differentiators

### 🎯 Multi-Gun Support
- Unlike most web games, full support for multiple real lightgun devices
- Advanced configuration (detection, mapping, calibration, reload)
- <16ms latency for arcade-quality responsiveness

### 🔌 Plug-and-Play SDK
- Games automatically get all platform features
- No need to implement user systems, leaderboards, multiplayer infrastructure
- Focus on gameplay, SDK handles the rest

### 📈 Flexible Complexity
- Same platform supports simple galleries and complex 3D rail shooters
- Modular SDK - use only what you need
- Any rendering technology supported

### 🏆 Rich Tournament System
- Both async and sync tournaments
- Highly configurable (attempts, scoring, time windows)
- Built into platform, works with all games

### 🤖 AI Game Creation
- Non-technical users can create games
- Conversational design process
- Generates production-ready games

### 🌍 Community Platform
- Not just playing games, but creating and sharing
- Asset library for game creators
- Social features integrated throughout

---

## 9. Supported Game Types

The platform supports (but is not limited to):

✅ Shooting galleries (basic target practice)  
✅ Duck Hunt style games (multi-level progression)  
✅ Mini-game collections (Point Gun, WarioWare style)  
✅ Time attack challenges  
✅ Survival modes (endless waves)  
✅ Precision challenges (accuracy-focused)  
✅ Boss battle games  
✅ Campaign modes (story, progression, unlocks)  
✅ 3D rail shooters (Time Crisis, House of the Dead style)  
✅ Procedurally generated games  
✅ Competitive multiplayer games  
✅ Co-op multiplayer games  

**If it involves shooting with a lightgun, the platform supports it.**

---

## 10. Future Expandability

The system is designed for future growth:

🔮 **VR/AR Support** - Extend to VR lightgun games  
🔮 **Mobile Support** - Touch-based "lightgun" games on tablets  
🔮 **Voice Commands** - Accessibility feature for games  
🔮 **Advanced AI** - AI opponents, dynamic difficulty  
🔮 **Esports Features** - Leaderboards, seasons, leagues  
🔮 **Streaming Integration** - Twitch/YouTube integration  
🔮 **Physical Arcade Cabinets** - Kiosk mode for real arcades  
🔮 **Cross-Platform** - Electron desktop app, mobile apps  

---

## 11. Success Metrics

### Platform Health:
- Active users per month
- Games played per user
- Session duration
- Retention rate

### Social Engagement:
- Friend connections per user
- Activity feed interactions
- Tournament participation
- Leaderboard competition

### Content Creation:
- Community games published
- Asset library growth
- AI-generated games created
- Game play counts

### Technical Performance:
- 60 FPS gameplay maintained
- <16ms input latency achieved
- <3 second load times
- <80ms online co-op latency (regional servers)

---

## 11. Future Features (Post-Phase 8)

> **Note**: These features are planned for future development and are being considered in the current architecture to avoid future refactoring.



### 11.1 Paid Games & Revenue Sharing

**Feature**:
- Support for paid games alongside free games
- Revenue split between platform and creators (e.g., 70/30)
- Stripe payment processing
- Creator dashboards with earnings tracking
- Automated payouts

**User Experience**:
- Browse free and paid games
- One-click purchase flow
- Library of purchased games
- Refund policy support

**Creator Benefits**:
- Monetize their games
- Transparent revenue tracking
- Monthly automated payouts
- No upfront costs


### 11.2 Game Reviews & Ratings

**Feature**:
- 5-star rating system
- Written reviews
- Helpful/not helpful voting
- Filter/sort games by rating
- Review moderation

**User Experience**:
- Rate and review games after playing
- See average ratings on game listings
- Read reviews before purchasing/playing
- Vote on helpful reviews

**Quality Control**:
- Prevents fake reviews (must own/play game)
- Moderators can remove inappropriate content
- Creators can respond to reviews
- Verified purchase badges


### 11.3 Native/Downloadable Version

**Feature**:
- Desktop application (Electron or Tauri)
- Windows, macOS, Linux support
- Better performance than web version
- Offline play support
- Direct hardware access

**Benefits**:
- **Faster Loading**: Local disk access (<1ms vs 50-500ms HTTP)
- **Better Performance**: Native GPU access, no browser overhead
- **Larger Games**: No storage limits (vs 5-10MB web)
- **Offline Play**: Full gameplay without internet
- **Better Hardware Support**: Direct USB lightgun access
- **Reduced Latency**: No network round-trips for assets

**Distribution**:
- Steam platform
- Itch.io
- Direct download from website
- Auto-updates

**Sync Features**:
- Cloud saves sync between web and native
- Scores upload when online
- Automatic game updates
- Play anywhere (web or native)


---

## 12. What Makes This Platform Special

**For Players**:
- Play arcade-quality lightgun games in your browser
- Use real lightguns or mouse
- Compete with friends and the world
- Participate in tournaments
- Track your improvement over time

**For Developers**:
- Focus on gameplay, not infrastructure
- SDK handles users, scores, multiplayer automatically
- Support any game complexity or rendering tech
- Instant distribution to all platform users

**For the Community**:
- Create and share games (even without coding)
- Upload assets for others to use
- Organize tournaments and events
- Growing library of games and content

**Technical Excellence**:
- Arcade-quality input latency
- Support for real lightgun hardware
- Scalable architecture (local → online)
- Modern web technologies
- Offline-first design

---

**This is the Lightgun Arcade platform we're building together.**

Let me know if any features need clarification or adjustment!

---

**Document Version**: 1.0  
**Created**: 2025-11-27  
**Author**: Phil McClarence & AI Assistant  
**Status**: Specification for Confirmation
