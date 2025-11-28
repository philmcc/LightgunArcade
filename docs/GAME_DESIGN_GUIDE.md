# Lightgun Game Design Guide

**Version**: 1.0  
**Last Updated**: 2025-11-28  
**Status**: Living Document

This guide captures best practices, design patterns, and lessons learned from developing lightgun games for the Lightgun Arcade platform. It will grow over time as we build more games and discover what works.

---

## Table of Contents

1. [Core Design Principles](#1-core-design-principles)
2. [Scoring Systems](#2-scoring-systems)
3. [Target Design](#3-target-design)
4. [Difficulty & Progression](#4-difficulty--progression)
5. [Multiplayer Design](#5-multiplayer-design)
6. [Input & Controls](#6-input--controls)
7. [Feedback & Juice](#7-feedback--juice)
8. [Accessibility](#8-accessibility)
9. [Common Pitfalls](#9-common-pitfalls)
10. [Genre-Specific Tips](#10-genre-specific-tips)

---

## 1. Core Design Principles

### 1.1 Respect the Hardware

Lightguns are physical devices with unique characteristics:

- **Accuracy varies**: Players using mice will be more precise than those using physical guns
- **Fatigue is real**: Holding a gun up for extended periods is tiring
- **Calibration matters**: Always account for slight inaccuracies in aim

**Design Implications**:
- Make targets reasonably sized (not pixel-perfect)
- Include natural breaks in gameplay (round transitions, cutscenes)
- Consider "aim assist" options for accessibility

### 1.2 Immediacy is Everything

Lightgun games thrive on instant feedback:

- **Input latency must be <16ms** - anything higher feels sluggish
- **Visual feedback on every shot** - hit or miss, something should happen
- **Audio confirms actions** - distinct sounds for shoot, hit, miss, reload

### 1.3 Readable Targets

Players need to instantly identify:
- What to shoot (targets)
- What NOT to shoot (civilians, penalties)
- Target priority (high-value vs standard)

**Techniques**:
- Color coding (enemies = red, friendlies = blue/green)
- Size differentiation (bigger = more important)
- Animation states (idle vs attacking)
- Glow/outline effects for special targets

### 1.4 Flow State

The best lightgun games create a rhythm:
- Targets appear in patterns
- Difficulty ramps smoothly
- Moments of intensity followed by brief respite
- Clear progression markers (rounds, levels, bosses)

---

## 2. Scoring Systems

### 2.1 Base Scoring

Every target needs a clear point value. Consider:

| Factor | Higher Points | Lower Points |
|--------|---------------|--------------|
| Size | Smaller targets | Larger targets |
| Speed | Faster movement | Slower/stationary |
| Rarity | Rare spawns | Common spawns |
| Risk | Dangerous targets | Safe targets |

**Example from Not Duck Hunt**:
- Pigeon (slow, large): 75 points
- Duck (medium): 100 points
- Pheasant (fast, erratic): 150 points
- GoldenPheasant (rare, very fast): 500 points

### 2.2 Combo Systems

Combos reward consistent accuracy and create excitement:

```
Combo Multiplier Thresholds:
- 3+ consecutive hits: 1.5x
- 5+ consecutive hits: 2.0x
- 8+ consecutive hits: 3.0x
```

**Design Tips**:
- Visual combo counter builds anticipation
- Audio escalation (pitch increase, intensity)
- Combo timer creates urgency
- Breaking combo should feel impactful (but not punishing)

### 2.3 Bonus Points

Layer additional scoring on top of base points:

| Bonus Type | Trigger | Typical Value |
|------------|---------|---------------|
| Speed Bonus | Kill in <1 second | +25% |
| Accuracy Bonus | 100% hit rate in round | +500 flat |
| Chain Kill | Multiple kills in quick succession | +50 per chain |
| First Hit | Hit target before opponent (versus) | Full points |
| Perfect Round | No misses, all targets hit | +1000 |

### 2.4 Penalties

Penalties add risk/reward decisions:

- **Decoy targets**: Look like valid targets, penalize on hit (-200 points)
- **Civilian targets**: Instant life loss or major penalty
- **Friendly fire**: In co-op, hitting partner's zone
- **Overkill**: Shooting already-dead targets (optional penalty)

**Important**: Penalties should be AVOIDABLE with skill, not random.

---

## 3. Target Design

### 3.1 Target Archetypes

Build a vocabulary of target types:

| Archetype | Characteristics | Example |
|-----------|-----------------|---------|
| **Standard** | Baseline difficulty, common | Duck |
| **Fast** | Quick movement, higher points | Pheasant |
| **Tank** | Multiple hits required | ArmoredDuck |
| **Penalty** | Negative points if hit | Decoy |
| **Bonus** | Rare, high value, challenging | GoldenPheasant |
| **Explosive** | Chain reaction potential | BombDuck (planned) |
| **Splitting** | Becomes multiple targets | SplitDuck (planned) |

### 3.2 Movement Patterns

Variety in movement keeps gameplay fresh:

- **Linear**: Straight line, predictable
- **Sinusoidal**: Wave pattern, rhythmic
- **Erratic**: Random direction changes
- **Homing**: Moves toward player/center
- **Fleeing**: Moves away from cursor
- **Stationary**: Pops up, doesn't move
- **Arcing**: Parabolic trajectory (clay pigeons)

### 3.3 Visual Hierarchy

Players should instantly know target priority:

1. **Size**: Larger = easier to see, usually lower value
2. **Color**: Bright/warm colors draw attention
3. **Effects**: Glows, particles, trails for special targets
4. **Animation**: More animation = more important

### 3.4 Spawn Patterns

How targets appear matters:

- **Wave-based**: Groups appear together, cleared before next wave
- **Continuous**: Steady stream of targets
- **Triggered**: Appear based on player action or timer
- **Positional**: Specific spawn points create predictability

---

## 4. Difficulty & Progression

### 4.1 Difficulty Curves

Smooth progression keeps players engaged:

```
Round 1-2: Tutorial difficulty, learn mechanics
Round 3-4: Introduce special targets
Round 5-6: Speed/size scaling kicks in
Round 7+: Full difficulty, all target types
```

### 4.2 Scaling Parameters

What to scale and how:

| Parameter | Scaling Method | Typical Rate |
|-----------|----------------|--------------|
| Target Speed | Multiplicative | +5% per round |
| Target Size | Multiplicative (min cap) | -3% per round (min 70%) |
| Spawn Rate | Additive | +0.5 targets per round |
| Special Spawn % | Stepped | Unlock at specific rounds |
| Time Limit | Subtractive | -2 seconds per round |

### 4.3 Difficulty Modes

Offer multiple difficulty levels:

**Beginner**:
- Larger targets
- Slower movement
- More forgiving timing
- Extra lives

**Normal**:
- Balanced experience
- Standard scaling

**Hard**:
- Smaller targets
- Faster movement
- Aggressive scaling
- Fewer lives

**Expert**:
- Minimal target size
- Maximum speed
- One-hit deaths
- Leaderboard focus

### 4.4 Adaptive Difficulty (Optional)

Adjust in real-time based on performance:

- Track hit/miss ratio over last N shots
- If accuracy < 50%, slightly slow targets
- If accuracy > 90%, slightly speed up
- Never tell the player this is happening

---

## 5. Multiplayer Design

### 5.1 Mode Types

#### Cooperative (Co-op)
- Shared objectives
- Combined or shared resources (lives, score)
- Communication encouraged
- "We win together or lose together"

**Design Tips**:
- Make targets require teamwork (too many for one player)
- Shared lives creates tension and investment
- Celebrate team achievements

#### Competitive (Versus)
- Individual scoring
- Race mechanics (first hit wins)
- Clear winner/loser

**Design Tips**:
- Ensure equal opportunity (symmetric spawns)
- Visual distinction between players
- Prevent griefing (can't block opponent's shots)

#### Duel
- Assigned targets per player
- Only shoot YOUR targets
- Tests accuracy and restraint

**Design Tips**:
- Clear visual assignment (color coding)
- Alternating or balanced target distribution
- Penalty for shooting opponent's targets

### 5.2 Player Differentiation

Players must be visually distinct:

- **Colors**: P1=Red, P2=Blue, P3=Green, P4=Yellow
- **Cursors**: Unique crosshair per player
- **HUD Position**: Separate score/ammo displays
- **Audio**: Distinct sound per player's shots (subtle)

### 5.3 Balancing Multiplayer

Ensure fairness:

- **Symmetric spawns**: Same targets available to all
- **Equal resources**: Same ammo, same lives
- **No blocking**: Players can't interfere with each other's shots
- **Catch-up mechanics** (optional): Bonus targets for trailing player

---

## 6. Input & Controls

### 6.1 Shoot Mechanics

The core action must feel perfect:

- **Instant response**: No delay between click and shot
- **Clear feedback**: Visual + audio on every shot
- **Generous hitboxes**: Slightly larger than visual target

### 6.2 Reload Systems

Options for reload mechanics:

| Type | How It Works | Best For |
|------|--------------|----------|
| **Automatic** | Reloads between rounds | Casual games |
| **Manual** | Player triggers reload | Realistic games |
| **Off-screen** | Shoot off-screen to reload | Arcade authentic |
| **Timed** | Auto-reload after delay | Hybrid approach |

### 6.3 Ammo Management

Ammo creates strategic decisions:

- **Limited ammo per round**: Forces accuracy (Not Duck Hunt: 3 shots)
- **Unlimited ammo**: Focus on speed, not conservation
- **Shared pool**: Team must coordinate (co-op)
- **Per-player pools**: Individual responsibility (versus)

### 6.4 Secondary Actions

Beyond shooting:

- **Pause**: Start button or keyboard
- **Reload**: Off-screen or button
- **Special weapon**: Charged shot, bomb, etc.
- **Dodge/Cover**: For games with return fire

---

## 7. Feedback & Juice

### 7.1 Visual Feedback

Every action needs visual confirmation:

| Action | Feedback |
|--------|----------|
| Shot fired | Muzzle flash, recoil animation |
| Hit target | Explosion, particles, score popup |
| Miss | Bullet hole, ricochet effect |
| Kill | Death animation, feathers/debris |
| Combo | Counter increase, glow effect |
| Bonus | Special particle burst, text popup |

### 7.2 Audio Feedback

Sound is 50% of the experience:

| Sound | Purpose |
|-------|---------|
| Gunshot | Confirms trigger pull |
| Hit | Confirms successful shot |
| Miss | Indicates failed shot |
| Kill | Satisfying confirmation |
| Combo milestone | Rewards streak |
| Warning | Alerts to danger/time |
| Round complete | Celebration/transition |

### 7.3 Screen Effects

Use sparingly for impact:

- **Screen shake**: Big kills, explosions
- **Flash**: Critical hits, bonuses
- **Slow motion**: Final kill, boss defeat
- **Zoom**: Dramatic moments

### 7.4 Score Popups

Floating scores add satisfaction:

```javascript
// Score popup design
- Position: At hit location
- Animation: Float upward, fade out
- Color: White (normal) → Orange (good) → Red (great)
- Size: Scales with point value
- Duration: 1-2 seconds
```

---

## 8. Accessibility

### 8.1 Visual Accessibility

- **Colorblind modes**: Don't rely solely on red/green
- **High contrast option**: Bold outlines, clear backgrounds
- **Target size options**: Adjustable hitbox/visual size
- **Reduced motion**: Option to disable screen shake/flash

### 8.2 Input Accessibility

- **Multiple input methods**: Mouse, gun, touch all supported
- **Aim assist options**: Slight magnetism toward targets
- **Auto-fire option**: For players who can't rapid-click
- **One-handed mode**: All actions on single device

### 8.3 Difficulty Accessibility

- **Practice mode**: No pressure, learn mechanics
- **Invincibility option**: Play for fun, not challenge
- **Adjustable speed**: Slow-motion gameplay option
- **Skip difficult sections**: Don't gate content behind skill

---

## 9. Common Pitfalls

### 9.1 Avoid These Mistakes

❌ **Pixel-perfect hitboxes**: Frustrating with imprecise input
✅ **Generous hitboxes**: Slightly larger than visual

❌ **Instant death from single mistake**: Feels unfair
✅ **Life system with recovery**: Allows learning

❌ **Random difficulty spikes**: Breaks flow
✅ **Smooth progression**: Gradual increase

❌ **Unclear what to shoot**: Confusing targets
✅ **Visual hierarchy**: Obvious targets vs hazards

❌ **No feedback on miss**: Player doesn't know what happened
✅ **Clear miss indication**: Sound, visual, both

❌ **Punishing penalties**: -1000 points for one mistake
✅ **Proportional penalties**: Match the risk/reward

❌ **Endless sessions**: Player fatigue
✅ **Natural break points**: Rounds, levels, saves

### 9.2 Lessons from Not Duck Hunt

**What Worked**:
- Combo system creates excitement and rewards skill
- Special targets add variety without overwhelming
- Per-player ammo in multiplayer prevents resource conflicts
- Mode-specific instructions reduce confusion
- Dog laugh ONLY on actual failure (not last-shot hits)

**What We Fixed**:
- Dog laugh was triggering incorrectly → Added proper live target check
- 2-player mode defaulting to 1 player → Added minPlayers option
- Single player showing both cursors → Added cursor hiding for inactive guns
- Shared ammo in multiplayer → Separated per-player ammo

---

## 10. Genre-Specific Tips

### 10.1 Gallery Shooters (Not Duck Hunt style)

- Targets appear, must be shot before escaping
- Limited ammo per wave
- Focus on accuracy over speed
- Clear round structure

### 10.2 Rail Shooters (House of the Dead style)

- Camera moves on rails
- Enemies attack player
- Cover/dodge mechanics
- Boss battles

### 10.3 Target Practice (Point Blank style)

- Varied mini-games
- Time pressure
- Accuracy challenges
- Multiplayer competition

### 10.4 Survival Horror

- Limited ammo creates tension
- Enemies require multiple hits
- Resource management
- Jump scares and atmosphere

### 10.5 Western/Dueling

- Quick draw mechanics
- One-shot kills
- Reaction time focus
- Showdown moments

---

## Appendix A: Useful Formulas

### Combo Multiplier
```javascript
function getComboMultiplier(combo) {
    if (combo >= 8) return 3.0;
    if (combo >= 5) return 2.0;
    if (combo >= 3) return 1.5;
    return 1.0;
}
```

### Speed Bonus
```javascript
function getSpeedBonus(killTimeMs, basePoints) {
    if (killTimeMs < 1000) {
        return Math.floor(basePoints * 0.25);
    }
    return 0;
}
```

### Difficulty Scaling
```javascript
function getDifficultyScale(round) {
    return {
        speed: 1.0 + (round - 1) * 0.05,
        size: Math.max(0.7, 1.0 - (round - 1) * 0.03)
    };
}
```

### Hit Detection (Generous)
```javascript
function isHit(shotX, shotY, target) {
    const hitboxPadding = 5; // pixels of forgiveness
    const dx = shotX - target.x;
    const dy = shotY - target.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    return distance <= (target.radius + hitboxPadding);
}
```

---

## Appendix B: Reference Games

Study these classics for inspiration:

| Game | Notable Features |
|------|------------------|
| Duck Hunt (NES) | Simple, iconic, dog feedback |
| Point Blank (Arcade) | Mini-game variety, multiplayer |
| House of the Dead (Arcade) | Rail shooter, horror, bosses |
| Time Crisis (Arcade) | Cover system, pedal reload |
| Virtua Cop (Arcade) | Justice shots, combo system |
| Silent Scope (Arcade) | Sniper mechanics, zoom |
| Ghost Squad (Arcade) | Branching paths, unlocks |
| Resident Evil: Umbrella Chronicles | Story integration, upgrades |

---

## Contributing to This Guide

This is a living document. Add your learnings:

1. Document what worked in your game
2. Document what didn't work and why
3. Share formulas and code snippets
4. Add genre-specific tips

---

**Document Maintainer**: Development Team  
**Last Review**: 2025-11-28
