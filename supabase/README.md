# Supabase Setup Guide

## Initial Setup

### 1. Run Database Migration

Go to your Supabase Dashboard → SQL Editor and run the contents of:
- `migrations/001_initial_schema.sql`

This creates all tables, indexes, RLS policies, and seeds the built-in games.

### 2. Set Up Storage

Run the contents of `storage_setup.sql` in the SQL Editor to create the avatars bucket.

### 3. Configure Authentication Providers

Go to Authentication → Providers and enable:

#### Email/Password
- Already enabled by default
- Consider enabling "Confirm email" for production

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://zygjkzbezzgoywbunaig.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

#### Discord OAuth
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 → Add redirect: `https://zygjkzbezzgoywbunaig.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

#### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL: `https://zygjkzbezzgoywbunaig.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

### 4. Configure Site URL

Go to Authentication → URL Configuration:
- Site URL: `http://localhost:5173` (for development)
- Add redirect URLs for production domain when ready

## Database Schema Overview

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `friendships` | Friend relationships |
| `games` | Registered games |
| `scores` | All game scores |
| `personal_bests` | Best scores per user/game/mode |
| `play_sessions` | Game session tracking |
| `activity_feed` | Social activity posts |
| `activity_reactions` | Reactions to activities |
| `activity_comments` | Comments on activities |

### Row Level Security

All tables have RLS enabled with appropriate policies:
- Profiles: Public profiles viewable, users can edit own
- Scores: Everyone can view, users can insert own
- Friends: Users can manage their own friendships
- Activity: Visibility based on privacy settings

## Useful Queries

### Check if tables exist
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### View all profiles
```sql
SELECT * FROM profiles;
```

### View leaderboard for a game
```sql
SELECT p.username, s.score, s.difficulty, s.created_at
FROM scores s
JOIN profiles p ON s.user_id = p.id
WHERE s.game_id = 'not-duck-hunt'
ORDER BY s.score DESC
LIMIT 10;
```
