# Phase 1 Implementation Plan: Multi-Gun Foundation
## Lightgun Arcade - Detailed Implementation Guide

**Phase**: 1 of 8  
**Duration**: 4-6 weeks  
**Priority**: 🔴 CRITICAL  
**Status**: Ready to Start  

---

## Executive Summary

This phase establishes the foundation for multi-gun support in the Lightgun Arcade. By the end of Phase 1, the system will support 2+ lightguns simultaneously with complete configuration, calibration, and input routing. All existing games will be updated to work with the new multi-gun system.

### Key Deliverables
1. ✅ Gun detection and player assignment UI
2. ✅ Button mapping system (trigger, start, action)
3. ✅ Reload capability detection and configuration
4. ✅ Gun calibration system
5. ✅ Multi-gun input router
6. ✅ Persistent gun profiles
7. ✅ Updated existing games (Not Duck Hunt, Point Gun)
8. ✅ Testing and validation

---

## 1. Architecture Overview

### Current State
- Single input device (mouse/pointer)
- InputManager handles basic pointer events
- No device differentiation
- No reload detection

### Target State
```
┌─────────────────────────────────────────────┐
│           Arcade System                     │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│         Gun Manager                         │
│  - Device Detection                         │
│  - Player Assignment                        │
│  - Button Mapping                           │
│  - Reload Detection                         │
│  - Calibration                              │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│         Input Router                        │
│  - Multi-gun event routing                  │
│  - Player identification                    │
│  - Coordinate transformation                │
└─────────────┬───────────────────────────────┘
              │
        ┌─────┴─────┐
        │           │
┌───────▼──┐  ┌─────▼──────┐
│  Game 1  │  │  Game 2    │
└──────────┘  └────────────┘
```

---

## 2. Component Breakdown

### 2.1 Gun Manager (`/src/arcade/core/GunManager.js`)

**Purpose**: Central management of all gun devices, configuration, and state.

**Responsibilities**:
- Detect and enumerate gun devices
- Assign guns to players
- Store and retrieve gun configurations
- Handle disconnection/reconnection
- Validate gun capabilities

**API**:
```javascript
export class GunManager {
  constructor() {
    this.guns = new Map(); // deviceId -> GunProfile
    this.players = new Map(); // playerId -> deviceId
    this.detectionMode = null; // null | playerId (when detecting)
  }
  
  // Device Detection
  async startDetection(playerId) { }
  stopDetection() { }
  async enumerateDevices() { }
  
  // Gun Management
  registerGun(deviceId, profile) { }
  unregisterGun(deviceId) { }
  getGun(deviceId) { }
  
  // Player Assignment
  assignGunToPlayer(deviceId, playerId) { }
  getPlayerGun(playerId) { }
  
  // Configuration
  async saveProfiles() { }
  async loadProfiles() { }
  
  // Events
  onDeviceInput(event) { }
  onDeviceConnected(event) { }
  onDeviceDisconnected(event) { }
}
```

**Data Structures**:
```javascript
// Gun Profile
{
  deviceId: string,
  name: string, // "Sinden Lightgun #1"
  assignedPlayer: number | null,
  buttons: {
    trigger: { button: number },
    start: { button: number },
    action: { button: number }
  },
  reloadSupported: boolean,
  reloadSignature: {
    onScreen: string,  // Event signature when shooting on-screen
    offScreen: string  // Event signature when shooting off-screen
  },
  calibration: {
    offsetX: number,
    offsetY: number,
    scaleX: number,
    scaleY: number
  },
  lastUsed: timestamp
}

// Player Assignment
{
  playerId: number,
  deviceId: string,
  color: string, // UI differentiation
  isActive: boolean
}
```

---

### 2.2 Input Router (`/src/arcade/core/InputRouter.js`)

**Purpose**: Route input events from multiple guns to correct players and games.

**Responsibilities**:
- Listen to all pointer/button events
- Identify which gun triggered the event
- Route to appropriate player context
- Transform coordinates if needed
- Detect reload actions

**API**:
```javascript
export class InputRouter {
  constructor(gunManager, canvas) {
    this.gunManager = gunManager;
    this.canvas = canvas;
    this.currentGame = null;
    this.eventHandlers = new Map();
  }
  
  // Lifecycle
  start() { }
  stop() { }
  
  // Game Integration
  attachGame(game) { }
  detachGame() { }
  
  // Event Routing
  handlePointerDown(event) { }
  handlePointerMove(event) { }
  handlePointerUp(event) { }
  handleButtonPress(event) { }
  
  // Coordinate Transformation
  screenToGameCoords(x, y, gun) { }
  
  // Reload Detection
  detectReload(event, gun) { }
}
```

---

### 2.3 Gun Configuration UI (`/src/arcade/ui/GunSetup.js`)

**Purpose**: User interface for gun setup and configuration.

**Screens**:

1. **Gun Setup Home**
   - List of configured guns
   - Player 1/2/3/4 assignments
   - "Add Gun" button
   - "Calibrate Gun" button per gun
   - "Test Guns" button

2. **Detection Screen**
   ```
   ┌─────────────────────────────────────┐
   │  DETECT PLAYER 1 GUN                │
   │                                     │
   │  Press any button on the gun you    │
   │  want to assign to Player 1         │
   │                                     │
   │         [Waiting for input...]      │
   │                                     │
   │            [Cancel]                 │
   └─────────────────────────────────────┘
   ```

3. **Button Mapping Screen**
   ```
   ┌─────────────────────────────────────┐
   │  MAP BUTTONS - PLAYER 1             │
   │                                     │
   │  ✓ Trigger Button: Button 0         │
   │  → Press START/PAUSE button         │
   │  ⏸ Start/Pause:                     │
   │  🎮 Action Button:                  │
   │                                     │
   │  [Back]              [Skip] [Next]  │
   └─────────────────────────────────────┘
   ```

4. **Reload Test Screen**
   ```
   ┌─────────────────────────────────────┐
   │  RELOAD DETECTION TEST              │
   │                                     │
   │  Step 1: Shoot the target           │
   │         [ 🎯 TARGET ]               │
   │                                     │
   │  Step 2: Point gun OFF-SCREEN       │
   │         and shoot                   │
   │                                     │
   │  [ Testing... ]                     │
   └─────────────────────────────────────┘
   ```

5. **Calibration Screen**
   ```
   ┌─────────────────────────────────────┐
   │  GUN CALIBRATION                    │
   │                                     │
   │  Shoot each corner marker:          │
   │                                     │
   │  🎯                            🎯  │
   │                                     │
   │                                     │
   │                                     │
   │  🎯                            🎯  │
   │                                     │
   │  Progress: 2/4                      │
   └─────────────────────────────────────┘
   ```

---

### 2.4 Gun Profile Storage

**Storage**: LocalStorage (Phase 1), Supabase (Phase 2+)

**LocalStorage Key**: `lightgun-arcade-gun-profiles`

**Schema**:
```javascript
{
  version: "1.0",
  guns: {
    "device-id-1": { ...GunProfile },
    "device-id-2": { ...GunProfile }
  },
  defaultAssignments: {
    1: "device-id-1", // Player 1 → Gun 1
    2: "device-id-2"  // Player 2 → Gun 2
  },
  lastUpdated: timestamp
}
```

**Migration Strategy** (for Phase 2):
- Read from LocalStorage
- Upload to Supabase user profile
- Keep LocalStorage as fallback
- Sync changes bidirectionally

---

## 3. Implementation Tasks

### 3.1 Week 1: Gun Manager Foundation

**Task 1.1: Create GunManager Class** (2 days)
- [ ] Create `/src/arcade/core/GunManager.js`
- [ ] Implement gun profile data structure
- [ ] Implement device detection using Pointer Events API
- [ ] Add event listeners for device connection/disconnection
- [ ] Test with mouse (simulated gun)

**Task 1.2: Persistent Storage** (1 day)
- [ ] Implement `saveProfiles()` to LocalStorage
- [ ] Implement `loadProfiles()` from LocalStorage
- [ ] Add migration/versioning support
- [ ] Test save/load cycle

**Task 1.3: Player Assignment System** (2 days)
- [ ] Implement `assignGunToPlayer()`
- [ ] Implement `getPlayerGun()`
- [ ] Add assignment validation (no duplicate assignments)
- [ ] Test multi-gun assignments

---

### 3.2 Week 2: Gun Configuration UI

**Task 2.1: Gun Setup Screen** (2 days)
- [ ] Create `/src/arcade/ui/GunSetup.js`
- [ ] Design gun setup home screen
- [ ] List configured guns and assignments
- [ ] Add "Detect Player X" buttons
- [ ] Add "Calibrate" buttons
- [ ] Add navigation to/from settings menu

**Task 2.2: Detection Flow** (2 days)
- [ ] Implement detection mode UI
- [ ] Implement `startDetection(playerId)`
- [ ] Capture first device input during detection
- [ ] Auto-assign device to player
- [ ] Show success confirmation
- [ ] Test with 2+ devices

**Task 2.3: Button Mapping Flow** (3 days)
- [ ] Create button mapping UI
- [ ] Implement step-by-step button capture
- [ ] Capture trigger, start, action buttons
- [ ] Store button codes to gun profile
- [ ] Add skip/back navigation
- [ ] Test with various gun models

---

### 3.3 Week 3: Reload Detection & Calibration

**Task 3.1: Reload Detection System** (3 days)
- [ ] Design reload test UI
- [ ] Capture on-screen shot signature
- [ ] Capture off-screen shot signature
- [ ] Compare signatures (detect difference)
- [ ] Store reload capability in profile
- [ ] Show warning if reload not supported
- [ ] Test with Sinden lightgun (known to support)
- [ ] Test with Gun4IR (may not support)

**Task 3.2: Gun Calibration** (2 days)
- [ ] Create calibration UI (4-corner test)
- [ ] Capture expected vs actual coordinates
- [ ] Calculate offset and scale factors
- [ ] Store calibration in gun profile
- [ ] Apply calibration to input events
- [ ] Add recalibration option
- [ ] Test accuracy with target practice

---

### 3.4 Week 4: Input Router

**Task 4.1: Create Input Router** (3 days)
- [ ] Create `/src/arcade/core/InputRouter.js`
- [ ] Implement event listeners (pointer, button)
- [ ] Identify device from event
- [ ] Route to correct player context
- [ ] Transform coordinates using calibration
- [ ] Test with 1 gun
- [ ] Test with 2+ guns simultaneously

**Task 4.2: Reload Action Routing** (2 days)
- [ ] Detect off-screen shooting
- [ ] Emit `onReload(playerId)` event
- [ ] Handle guns without reload support (fallback)
- [ ] Test reload in isolation
- [ ] Test reload during gameplay

---

### 3.5 Week 5: Game Integration

**Task 5.1: Update BaseGame/InputManager** (2 days)
- [ ] Refactor existing InputManager to use InputRouter
- [ ] Update BaseGame to receive multi-player input
- [ ] Add `onShoot(playerId, x, y, button)` signature
- [ ] Add `onReload(playerId)` signature
- [ ] Add `onButtonPress(playerId, button)` signature
- [ ] Ensure backward compatibility

**Task 5.2: Update "Not Duck Hunt"** (3 days)
- [ ] Integrate with new input system
- [ ] Test single-player mode
- [ ] Test with multiple guns (prep for Phase 4)
- [ ] Verify reload works (if gun supports)
- [ ] Fix any regressions
- [ ] Performance testing (60 FPS)

**Task 5.3: Update "Point Gun"** (4 days)
- [ ] Integrate with new input system
- [ ] Update all mini-games (QuickDraw, BombPanic, etc.)
- [ ] Test each mini-game individually
- [ ] Verify stage transitions work
- [ ] Fix any regressions
- [ ] Performance testing

---

### 3.6 Week 6: Testing & Polish

**Task 6.1: Cross-Gun Testing** (2 days)
- [ ] Test with mouse (simulated)
- [ ] Test with Sinden lightgun
- [ ] Test with Gun4IR
- [ ] Test with generic USB lightgun
- [ ] Document quirks per gun type
- [ ] Add gun-specific workarounds if needed

**Task 6.2: Multi-Gun Scenarios** (2 days)
- [ ] Test 2 guns simultaneously
- [ ] Test 3 guns (if available)
- [ ] Test disconnection during game
- [ ] Test reconnection
- [ ] Test gun swap (reassignment)
- [ ] Verify no input conflicts

**Task 6.3: Performance & Latency** (1 day)
- [ ] Measure input latency (target: <16ms)
- [ ] Profile input router performance
- [ ] Optimize hot paths if needed
- [ ] Test at 60 FPS with multiple guns
- [ ] Document performance metrics

**Task 6.4: Polish & UX** (2 days)
- [ ] Improve gun setup UI/UX
- [ ] Add helpful tooltips and instructions
- [ ] Add error handling and user feedback
- [ ] Visual indicators for active guns
- [ ] Sound effects for gun setup steps
- [ ] Final UI review

---

## 4. Technical Specifications

### 4.1 Device Detection

**Approach**: Pointer Events API

**Rationale**:
- Cross-browser support (Chrome, Firefox, Edge)
- Works with mouse, lightguns, touch
- Provides `pointerId` for device identification
- Better than `MouseEvent` for multi-device scenarios

**Device Fingerprinting**:
```javascript
function getDeviceFingerprint(event) {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType, // "mouse", "pen", "touch"
    isPrimary: event.isPrimary,
    // Use pointerId as deviceId
    deviceId: `pointer-${event.pointerId}`
  };
}
```

**Alternative Explored**: WebHID API
- Pros: Direct hardware access, more detailed button info
- Cons: Requires user permission, not all guns support HID
- Decision: Use Pointer Events for Phase 1, explore HID in future phases

---

### 4.2 Reload Detection

**Challenge**: How to differentiate on-screen vs off-screen shots?

**Approach 1: Pointer Lock API** (Primary)
```javascript
// When player shoots off-screen, pointer may lock or behave differently
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === null) {
    // Pointer left screen (potential reload)
  }
});
```

**Approach 2: Coordinate Bounds** (Fallback)
```javascript
function isOffScreen(x, y) {
  return x < 0 || y < 0 || 
         x > canvas.width || y > canvas.height;
}
```

**Approach 3: Event Signature Comparison** (Sinden lightguns)
```javascript
// Sinden guns emit different event properties when off-screen
function getEventSignature(event) {
  return JSON.stringify({
    buttons: event.buttons,
    pressure: event.pressure,
    tiltX: event.tiltX,
    tiltY: event.tiltY
  });
}

// Compare on-screen vs off-screen signatures
if (offScreenSig !== onScreenSig) {
  reloadSupported = true;
}
```

**Testing Strategy**:
- Capture 10 on-screen shots
- Capture 10 off-screen shots
- Calculate reliability score
- Warn user if <90% reliable

---

### 4.3 Calibration System

**4-Point Calibration Method**:

```javascript
// Calibration points (corners of screen)
const calibrationPoints = [
  { x: 50, y: 50 },         // Top-left
  { x: width - 50, y: 50 }, // Top-right
  { x: 50, y: height - 50 }, // Bottom-left
  { x: width - 50, y: height - 50 } // Bottom-right
];

// User shoots each point, we record actual hit
const actualHits = [
  { x: 45, y: 52 },
  { x: width - 48, y: 51 },
  { x: 52, y: height - 49 },
  { x: width - 47, y: height - 51 }
];

// Calculate offset and scale
function calculateCalibration(expected, actual) {
  const offsetX = actual.map((p, i) => p.x - expected[i].x).reduce((a, b) => a + b) / 4;
  const offsetY = actual.map((p, i) => p.y - expected[i].y).reduce((a, b) => a + b) / 4;
  
  const scaleX = 1.0; // Can calculate from point spread
  const scaleY = 1.0;
  
  return { offsetX, offsetY, scaleX, scaleY };
}

// Apply calibration to input
function applyCalibratio(x, y, calibration) {
  return {
    x: (x - calibration.offsetX) * calibration.scaleX,
    y: (y - calibration.offsetY) * calibration.scaleY
  };
}
```

---

### 4.4 Input Routing

**Event Flow**:
```
Gun Hardware
    ↓ (USB/Bluetooth)
Browser (Pointer Events)
    ↓
InputRouter.handlePointerDown(event)
    ↓
Identify device → Get playerId
    ↓
Apply calibration
    ↓
Check if reload action
    ↓
Route to game: game.onShoot(playerId, x, y)
```

**Multi-Gun Handling**:
```javascript
handlePointerDown(event) {
  const deviceId = `pointer-${event.pointerId}`;
  const gun = this.gunManager.getGun(deviceId);
  
  if (!gun) return; // Unknown device
  
  const playerId = gun.assignedPlayer;
  if (playerId === null) return; // Not assigned
  
  // Apply calibration
  const { x, y } = this.applyCalibration(
    event.clientX,
    event.clientY,
    gun.calibration
  );
  
  // Check for reload
  if (this.detectReload(event, gun)) {
    this.currentGame?.onReload(playerId);
    return;
  }
  
  // Route to game
  const button = event.button === 0 ? 'trigger' : 'action';
  this.currentGame?.onShoot(playerId, x, y, button);
}
```

---

## 5. Testing Plan

### 5.1 Unit Tests

**GunManager Tests**:
```javascript
describe('GunManager', () => {
  test('registerGun adds gun to registry', () => { });
  test('assignGunToPlayer creates mapping', () => { });
  test('getPlayerGun returns correct gun', () => { });
  test('saveProfiles persists to localStorage', () => { });
  test('loadProfiles restores from localStorage', () => { });
  test('cannot assign same gun to multiple players', () => { });
  test('unregisterGun removes gun and player mapping', () => { });
});
```

**InputRouter Tests**:
```javascript
describe('InputRouter', () => {
  test('routes event to correct player', () => { });
  test('applies calibration correctly', () => { });
  test('detects reload action', () => { });
  test('handles unknown device gracefully', () => { });
  test('handles unassigned device gracefully', () => { });
  test('simultaneous input from 2 guns', () => { });
});
```

---

### 5.2 Integration Tests

**Gun Setup Flow**:
- [ ] User can detect and assign gun to Player 1
- [ ] User can map buttons (trigger, start, action)
- [ ] User can test reload detection
- [ ] User can calibrate gun
- [ ] Configuration persists after page reload
- [ ] User can reassign gun to different player

**Gameplay Tests**:
- [ ] Single player can play "Not Duck Hunt" with Gun 1
- [ ] Shooting hits targets correctly
- [ ] Reload works (if supported)
- [ ] Calibration improves accuracy
- [ ] No input lag (<16ms)

**Multi-Gun Tests**:
- [ ] 2 players can use guns simultaneously (prep for Phase 4)
- [ ] Each gun routes to correct player context
- [ ] No cross-contamination of input
- [ ] Both guns can reload independently

---

### 5.3 Hardware Testing

**Test Matrix**:

| Gun Type | Detection | Button Map | Reload | Calibration | Notes |
|----------|-----------|------------|--------|-------------|-------|
| Mouse | ✅ | ✅ | ⚠️ No | ✅ | Baseline test |
| Sinden | ✅ | ✅ | ✅ Yes | ✅ | Gold standard |
| Gun4IR | ✅ | ✅ | ⚠️ Maybe | ✅ | Verify reload |
| Generic USB | ✅ | ✅ | ❌ No | ✅ | Fallback mode |

**Testing Protocol**:
1. Connect gun
2. Complete full setup flow
3. Play 5 rounds of "Not Duck Hunt"
4. Test reload 10 times (if supported)
5. Measure accuracy (% hits on targets)
6. Document any issues

---

## 6. Success Criteria

### Must Have (Required for Phase 1 Completion)
- ✅ **Gun Detection**: 2+ guns can be detected and assigned
- ✅ **Button Mapping**: All 3 buttons mapped correctly
- ✅ **Reload Detection**: Detects and warns if not supported
- ✅ **Calibration**: 4-point calibration improves accuracy
- ✅ **Persistence**: Configuration survives page reload
- ✅ **Input Routing**: Events route to correct player
- ✅ **Game Integration**: Both existing games work with new system
- ✅ **Performance**: 60 FPS maintained, <16ms input latency
- ✅ **No Regressions**: Existing games work as before

### Should Have (Highly Desirable)
- ✅ Sinden lightgun fully supported with reload
- ✅ Gun4IR fully supported
- ✅ Visual feedback during setup (animations, confirmations)
- ✅ Error handling for edge cases
- ✅ Helpful user instructions

### Could Have (Nice to Have, Defer if Needed)
- ⏸ WebHID API exploration (for advanced features)
- ⏸ Advanced calibration (9-point, dead zone adjustment)
- ⏸ Gun profiles shareable between users
- ⏸ Gun testing mode (target practice mini-game)

---

## 7. Risks & Mitigations

### Risk 1: Gun Hardware Compatibility
**Risk**: Some lightguns may not work with Pointer Events API  
**Likelihood**: Medium  
**Impact**: High  
**Mitigation**:
- Test with multiple gun types early (Week 1)
- Document workarounds per gun type
- Provide mouse fallback
- Consider WebHID API as alternative (future)

### Risk 2: Reload Detection Unreliable
**Risk**: Some guns can't differentiate on/off screen  
**Likelihood**: High (generic USB guns)  
**Impact**: Medium  
**Mitigation**:
- Make reload optional, not required
- Provide manual reload button fallback
- Clearly communicate reload support in UI
- Games can disable reload requirement

### Risk 3: Performance Regression
**Risk**: Multi-gun input routing adds latency  
**Likelihood**: Low  
**Impact**: High (game-breaking)  
**Mitigation**:
- Profile early and often (Week 4)
- Optimize hot paths (event handlers)
- Use requestAnimationFrame for rendering, not events
- Target <0.5ms for input routing

### Risk 4: Breaking Existing Games
**Risk**: Refactoring InputManager breaks games  
**Likelihood**: Medium  
**Impact**: High  
**Mitigation**:
- Maintain backward compatibility layer
- Test existing games after each change
- Keep old InputManager until migration complete
- Phased rollout (game by game)

### Risk 5: LocalStorage Limits
**Risk**: Multiple gun profiles exceed 5-10MB limit  
**Likelihood**: Low  
**Impact**: Low  
**Mitigation**:
- Gun profiles are tiny (~1KB each)
- 10MB supports 10,000 guns (more than enough)
- IndexedDB fallback if needed
- Phase 2 moves to Supabase anyway

---

## 8. Dependencies

### External Libraries
- **None** (Phase 1 uses native browser APIs)

### Browser APIs Required
- **Pointer Events API** (supported in all modern browsers)
- **LocalStorage API** (universal support)
- **Canvas API** (already in use)

### Internal Dependencies
- Existing `ArcadeSystem`
- Existing `InputManager` (to be refactored)
- Existing games (Not Duck Hunt, Point Gun)

---

## 9. Rollout Plan

### Week 1-4: Development
- Feature-flag new gun system (`USE_MULTI_GUN = false`)
- Develop in parallel with existing system
- No impact on current users

### Week 5: Migration
- Migrate "Not Duck Hunt" to new system
- Extensive testing
- Fix any issues

### Week 5-6: Full Migration
- Migrate "Point Gun" to new system
- Enable `USE_MULTI_GUN = true` globally
- Remove old InputManager
- Final testing and polish

### Post-Launch
- Monitor for issues
- Collect user feedback
- Document gun compatibility
- Prepare for Phase 2 (backend integration)

---

## 10. Documentation Deliverables

### User-Facing Documentation
1. **Gun Setup Guide** (`/docs/GUN_SETUP.md`)
   - How to connect a lightgun
   - How to configure guns for players
   - Troubleshooting common issues
   
2. **Supported Guns List** (`/docs/SUPPORTED_GUNS.md`)
   - List of tested guns
   - Compatibility notes
   - Reload support per model

### Developer Documentation
1. **Multi-Gun API Reference** (`/docs/API_MULTI_GUN.md`)
   - GunManager API
   - InputRouter API
   - How games integrate with multi-gun system
   
2. **Migration Guide** (`/docs/MIGRATION_MULTI_GUN.md`)
   - How to update existing games
   - Breaking changes
   - Code examples

---

## 11. Post-Phase 1 Checklis

Before moving to Phase 2, verify:

- [ ] All Week 1-6 tasks completed
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Hardware testing completed for 3+ gun types
- [ ] "Not Duck Hunt" fully functional with multi-gun
- [ ] "Point Gun" fully functional with multi-gun
- [ ] Performance benchmarks met (60 FPS, <16ms latency)
- [ ] No regressions in existing gameplay
- [ ] Gun profiles persist correctly
- [ ] Reload detection works for supported guns
- [ ] Calibration improves accuracy measurably
- [ ] User documentation written
- [ ] Developer documentation written
- [ ] Code reviewed and merged
- [ ] User feedback collected (if beta testers available)

**Only proceed to Phase 2 if ALL items checked.**

---

## 12. Team & Resources

### Team (Estimated)
- **Lead Developer**: 1 person (full-time, 6 weeks)
- **Tester**: 1 person (part-time, weeks 5-6)
- **Designer** (UI/UX): 1 person (part-time, week 2)

### Hardware Requirements
- 2-3 different lightgun models for testing
- Development machine with modern browser
- Large monitor for testing calibration

### Time Commitment
- **Development**: 4-5 weeks
- **Testing & Polish**: 1-2 weeks
- **Total**: 4-6 weeks

---

**Document Version**: 1.0  
**Created**: 2025-11-27  
**Status**: Ready for Implementation  
**Next Phase**: Phase 2 - Backend Infrastructure
