# Not Duck Hunt - Game Design Document

**Version**: 1.0  
**Last Updated**: 2025-11-28  
**Status**: Implemented

---

## 1. Overview

Not Duck Hunt is a classic shooting gallery game inspired by the NES classic. This document outlines the enhancements and design decisions made to modernize the gameplay while maintaining the nostalgic feel.

---

## 2. Implemented Features

### 2.1 Enhanced Scoring System

**Combo System**:
- Consecutive hits build a combo counter
- Combo multipliers increase points:
  - 3+ hits: 1.5x multiplier
  - 5+ hits: 2x multiplier  
  - 8+ hits: 3x multiplier
- Combo breaks on miss
- Visual combo display with timer
- Sound effect on combo milestones

**Bonus Points**:
- **Speed Bonus**: Extra points for quick kills (< 1 second)
- **Accuracy Bonus**: Perfect accuracy in a round
- **Chain Kills**: Multiple hits in same target set

**Floating Score Display**:
- Animated score popups on hits
- Color-coded by value (white → orange → red)
- Shows bonus text (SPEED! PERFECT! etc.)
- Combo multiplier indicator

### 2.2 New Target Types

#### Standard Targets (Original)
| Target | Points | Behavior |
|--------|--------|----------|
| Duck | 100 | Standard flight pattern |
| Pheasant | 150 | Faster, erratic movement |
| Pigeon | 75 | Slower, easier target |
| Clay Pigeon | 200 | Bonus round only, arcing trajectory |

#### New Special Targets

**ArmoredDuck** (Round 5+):
- Requires 2 hits to destroy
- First hit breaks armor (visual feedback)
- Second hit kills
- Worth 300 points
- Metallic appearance with armor plates
- Sparks on armor hit

**Decoy** (Round 4+):
- Looks similar to regular duck but with red tint
- **Penalty on hit**: -200 points
- Breaks combo
- Teaches target discrimination
- Escape animation when time runs out

**GoldenPheasant** (Round 3+):
- Rare spawn (3% chance)
- Very fast movement
- Worth 500 points
- Golden glow effect
- Sparkle particle trail
- High-value risk/reward target

### 2.3 Adaptive Difficulty

**Progressive Scaling**:
- Target speed increases each round (+5% per round)
- Target size decreases each round (-3% per round, min 70%)
- More special targets spawn in later rounds

**Spawn Chances by Round**:
| Round | GoldenPheasant | ArmoredDuck | Decoy |
|-------|----------------|-------------|-------|
| 1-2 | 0% | 0% | 0% |
| 3-4 | 3% | 0% | 0% |
| 4 | 3% | 0% | 5% |
| 5+ | 3% | 7% | 5% |

### 2.4 Multiplayer Modes

#### Co-op Mode
- **Shared Team Score**: Combined points displayed prominently
- **Shared Lives**: Team pool of lives
- **Objective**: Work together to clear rounds
- **Visual Theme**: Green accents
- **Round Start Message**: "Work together! Shared lives, team score."

#### Versus Mode
- **Individual Scores**: Each player tracks their own points
- **Race Mechanic**: First to hit target gets the points
- **"FIRST!" Indicator**: Visual feedback on who hit first
- **Player-Colored Scores**: Floating scores show player color
- **Visual Theme**: Red accents
- **Round Start Message**: "Race to hit targets! First hit gets the points!"

#### Duel Mode
- **Assigned Targets**: Targets alternate between players
- **Player Colors**: Targets glow with assigned player's color
- **Penalty**: Shooting wrong target (opponent's) = miss
- **Visual Theme**: Blue accents
- **Round Start Message**: "Shoot YOUR colored targets only!"

### 2.5 Per-Player Systems

**Individual Ammo**:
- Each player has their own ammo pool (3 shots)
- Separate ammo display in HUD
- Reloads independently per round

**Player Identification**:
- P1 = Red color scheme
- P2 = Blue color scheme
- Colored crosshairs
- Colored score popups in Versus mode

### 2.6 Quality of Life Improvements

**Dog Laugh Fix**:
- Only plays when ALL shots missed AND targets escaped
- No longer triggers on last-shot hits
- Proper timing with target escape animation

**Round Instructions**:
- Mode-specific instructions on Round 1
- Longer display time for instruction rounds (3s vs 2s)
- Color-coded borders by mode

**Active Gun Indicator**:
- Shows which gun is active in single-player
- Displayed in HUD: "🎯 GUN 1" or "🎯 MOUSE"
- Shown in round intro: "Active: GUN 1"

---

## 3. Future Enhancement Ideas

### 3.1 New Target Types (Planned)

**BombDuck**:
- Explodes after timer if not shot
- Damages nearby targets (chain reaction)
- Risk/reward: shoot early for safety or wait for chain

**SplitDuck**:
- Splits into 2 smaller ducks when hit
- Each smaller duck worth half points
- Tests rapid target acquisition

**InvisibleDuck**:
- Phases in and out of visibility
- Only hittable when visible
- Audio cue when appearing

**BossDuck**:
- Large target requiring multiple hits
- Appears at end of every 5 rounds
- Special attack patterns
- High point value

### 3.2 Power-Ups (Planned)

| Power-Up | Effect | Duration |
|----------|--------|----------|
| Rapid Fire | Unlimited ammo | 10 seconds |
| Slow Motion | Targets move at 50% speed | 8 seconds |
| Double Points | 2x score multiplier | 15 seconds |
| Magnet | Shots auto-aim to nearest target | 5 seconds |
| Shield | Prevents life loss on miss | 1 round |

### 3.3 Game Modes (Planned)

**Time Attack**:
- Fixed time limit (60/90/120 seconds)
- Unlimited targets
- Score as many points as possible
- No lives system

**Survival**:
- Endless waves
- Increasing difficulty
- One life only
- Leaderboard focus

**Practice**:
- Select specific target types
- No scoring pressure
- Learn patterns and timing

**Boss Rush**:
- Fight boss targets only
- Progressive difficulty
- Special rewards

### 3.4 Achievements (Planned)

| Achievement | Requirement |
|-------------|-------------|
| Sharpshooter | 100% accuracy in a round |
| Combo Master | 15+ hit combo |
| Golden Hunter | Hit 10 Golden Pheasants |
| Decoy Dodger | Complete round without hitting decoys |
| Speed Demon | Clear round in under 30 seconds |
| Untouchable | Complete game without losing a life |
| Duck Dynasty | Reach Round 20 |
| Team Player | Win Co-op game with friend |
| Rival | Win Versus game |
| Duelist | Win Duel game |

### 3.5 Visual Enhancements (Planned)

**Weather Effects**:
- Rain (reduced visibility)
- Fog (targets fade in/out)
- Wind (affects target trajectory)
- Night mode (spotlight mechanic)

**Seasonal Themes**:
- Spring (cherry blossoms)
- Summer (beach/ocean)
- Autumn (falling leaves)
- Winter (snow, frozen lake)

**Hit Effects**:
- Feather explosions
- Screen shake on big hits
- Slow-motion on final kill
- Particle trails

---

## 4. Technical Notes

### 4.1 Target Class Hierarchy

```
Target (base)
├── Duck
├── Pheasant
├── Pigeon
├── ClayPigeon
├── ArmoredDuck (2-hit)
├── Decoy (penalty)
└── GoldenPheasant (rare/fast)
```

### 4.2 Scoring Formula

```javascript
basePoints = target.points
speedBonus = (killTime < 1.0) ? basePoints * 0.25 : 0
comboMultiplier = getComboMultiplier(comboCount)
totalPoints = (basePoints + speedBonus) * comboMultiplier
```

### 4.3 Difficulty Scaling

```javascript
speedScale = 1.0 + (round - 1) * 0.05  // +5% per round
sizeScale = Math.max(0.7, 1.0 - (round - 1) * 0.03)  // -3% per round, min 70%
```

---

## 5. Multiplayer Balance Considerations

### Co-op Balance
- Shared lives creates tension and teamwork
- Both players contribute to same score
- No competition, pure cooperation

### Versus Balance
- First-hit-wins creates exciting races
- Both players have equal opportunity
- Skill determines winner, not luck

### Duel Balance
- Alternating targets ensures fairness
- Equal number of targets per player
- Clear visual distinction prevents confusion

---

## 6. References

- Original Duck Hunt (NES, 1984)
- Point Blank series (Namco)
- House of the Dead series (Sega)
- Time Crisis series (Namco)

---

**Document Maintainer**: Development Team  
**Last Review**: 2025-11-28
