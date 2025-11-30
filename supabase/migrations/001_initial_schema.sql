-- ============================================
-- Lightgun Arcade - Initial Database Schema
-- Version: 1.0
-- Date: 2024-11-30
-- ============================================

-- ============================================
-- USERS & PROFILES
-- ============================================

-- Extends Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(50),
  avatar_url TEXT,
  bio TEXT,
  role VARCHAR(20) DEFAULT 'player' CHECK (role IN ('player', 'organizer', 'moderator', 'admin')),
  privacy_settings JSONB DEFAULT '{
    "profile": "public",
    "activity": "friends", 
    "friend_requests": "everyone"
  }',
  stats JSONB DEFAULT '{
    "total_games_played": 0,
    "total_playtime_seconds": 0,
    "favorite_game": null
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FRIENDS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- ============================================
-- GAMES & SCORES
-- ============================================

-- Registered games
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  author_id UUID REFERENCES profiles(id),
  description TEXT,
  is_builtin BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All scores
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  score INTEGER NOT NULL,
  metadata JSONB,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal bests (denormalized for fast lookup)
CREATE TABLE IF NOT EXISTS personal_bests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  best_score INTEGER NOT NULL,
  best_score_id UUID REFERENCES scores(id),
  attempts INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, mode, difficulty)
);

-- ============================================
-- PLAY SESSIONS & ACTIVITY
-- ============================================

CREATE TABLE IF NOT EXISTS play_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  mode VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20),
  duration_seconds INTEGER,
  players JSONB NOT NULL,
  is_multiplayer BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Activity feed
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  game_id VARCHAR(50) REFERENCES games(id) ON DELETE SET NULL,
  reference_id UUID,
  metadata JSONB,
  visibility VARCHAR(20) DEFAULT 'friends' CHECK (visibility IN ('public', 'friends', 'private')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON profiles(last_active DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_id);
CREATE INDEX IF NOT EXISTS idx_scores_leaderboard ON scores(game_id, mode, difficulty, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_created ON scores(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_personal_bests_user ON personal_bests(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_bests_game ON personal_bests(game_id, mode, difficulty, best_score DESC);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_feed(activity_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_bests ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Anyone can view public profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (
    privacy_settings->>'profile' = 'public' 
    OR auth.uid() = id
  );

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- FRIENDSHIPS POLICIES
-- ============================================

-- Users can view friendships they're part of
CREATE POLICY "Users can view own friendships"
  ON friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can create friend requests
CREATE POLICY "Users can create friend requests"
  ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requested_by AND auth.uid() = user_id);

-- Users can update friendships they're part of (accept/decline/block)
CREATE POLICY "Users can update own friendships"
  ON friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Users can delete friendships they're part of
CREATE POLICY "Users can delete own friendships"
  ON friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ============================================
-- GAMES POLICIES
-- ============================================

-- Anyone can view public games
CREATE POLICY "Public games are viewable by everyone"
  ON games FOR SELECT
  USING (is_public = true);

-- Only admins can insert/update games (for now)
CREATE POLICY "Admins can manage games"
  ON games FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- SCORES POLICIES
-- ============================================

-- Anyone can view scores
CREATE POLICY "Scores are viewable by everyone"
  ON scores FOR SELECT
  USING (true);

-- Users can insert their own scores
CREATE POLICY "Users can insert own scores"
  ON scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- PERSONAL BESTS POLICIES
-- ============================================

-- Anyone can view personal bests
CREATE POLICY "Personal bests are viewable by everyone"
  ON personal_bests FOR SELECT
  USING (true);

-- Users can manage their own personal bests
CREATE POLICY "Users can manage own personal bests"
  ON personal_bests FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- PLAY SESSIONS POLICIES
-- ============================================

-- Users can view sessions they participated in
CREATE POLICY "Users can view own sessions"
  ON play_sessions FOR SELECT
  USING (
    players @> jsonb_build_array(jsonb_build_object('user_id', auth.uid()::text))
  );

-- Anyone can insert sessions (for now)
CREATE POLICY "Anyone can create sessions"
  ON play_sessions FOR INSERT
  WITH CHECK (true);

-- ============================================
-- ACTIVITY FEED POLICIES
-- ============================================

-- Activity visibility based on settings
CREATE POLICY "Activity visibility"
  ON activity_feed FOR SELECT
  USING (
    visibility = 'public' 
    OR auth.uid() = user_id
    OR (
      visibility = 'friends' 
      AND EXISTS (
        SELECT 1 FROM friendships 
        WHERE status = 'accepted' 
        AND (
          (user_id = auth.uid() AND friend_id = activity_feed.user_id)
          OR (friend_id = auth.uid() AND user_id = activity_feed.user_id)
        )
      )
    )
  );

-- Users can insert their own activities
CREATE POLICY "Users can insert own activities"
  ON activity_feed FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- ACTIVITY REACTIONS POLICIES
-- ============================================

-- Users can view reactions on activities they can see
CREATE POLICY "Reactions viewable with activity"
  ON activity_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_feed af
      WHERE af.id = activity_id
      AND (
        af.visibility = 'public'
        OR af.user_id = auth.uid()
        OR (
          af.visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM friendships
            WHERE status = 'accepted'
            AND (
              (user_id = auth.uid() AND friend_id = af.user_id)
              OR (friend_id = auth.uid() AND user_id = af.user_id)
            )
          )
        )
      )
    )
  );

-- Users can add reactions
CREATE POLICY "Users can add reactions"
  ON activity_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON activity_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- ACTIVITY COMMENTS POLICIES
-- ============================================

-- Users can view comments on activities they can see
CREATE POLICY "Comments viewable with activity"
  ON activity_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activity_feed af
      WHERE af.id = activity_id
      AND (
        af.visibility = 'public'
        OR af.user_id = auth.uid()
        OR (
          af.visibility = 'friends'
          AND EXISTS (
            SELECT 1 FROM friendships
            WHERE status = 'accepted'
            AND (
              (user_id = auth.uid() AND friend_id = af.user_id)
              OR (friend_id = auth.uid() AND user_id = af.user_id)
            )
          )
        )
      )
    )
  );

-- Users can add comments
CREATE POLICY "Users can add comments"
  ON activity_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON activity_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON activity_comments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_personal_bests_updated_at
  BEFORE UPDATE ON personal_bests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_activity_comments_updated_at
  BEFORE UPDATE ON activity_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: Built-in Games
-- ============================================

INSERT INTO games (id, name, version, description, is_builtin, is_public)
VALUES 
  ('not-duck-hunt', 'Not Duck Hunt', '1.0.0', 'A classic duck hunting game. Definitely not a clone of anything.', true, true),
  ('point-gun', 'Point Gun', '1.0.0', 'A collection of fast-paced shooting mini-games.', true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  version = EXCLUDED.version,
  description = EXCLUDED.description;
