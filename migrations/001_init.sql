-- Enable uuid generation if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- members
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initials text NOT NULL,
  display_name text,
  avatar_color text,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- badges
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  alt_text text,
  categories text[] DEFAULT ARRAY[]::text[],
  eligibility_type text NOT NULL DEFAULT 'everyone',
  eligibility_user_ids uuid[] DEFAULT NULL,
  award_date timestamptz DEFAULT NULL,
  auto_award boolean DEFAULT false,
  active boolean DEFAULT true,
  archived boolean DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- badge_images
CREATE TABLE IF NOT EXISTS badge_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid REFERENCES badges(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  format text NOT NULL,
  width int,
  height int,
  created_at timestamptz DEFAULT now()
);

-- earned_badges
CREATE TABLE IF NOT EXISTS earned_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid REFERENCES badges(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  star_count smallint DEFAULT 1,
  comment text,
  comment_by text,
  earned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (badge_id, member_id, star_count)
);

-- suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_by uuid REFERENCES members(id),
  name text,
  description text,
  agent_conversation jsonb,
  generated_image_paths text[],
  selected_image_path text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending'
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_members_initials ON members (initials);
CREATE INDEX IF NOT EXISTS idx_badges_eligibility_type ON badges (eligibility_type);
CREATE INDEX IF NOT EXISTS idx_badge_images_badge_id ON badge_images (badge_id);
CREATE INDEX IF NOT EXISTS idx_earned_badges_member_id ON earned_badges (member_id);
CREATE INDEX IF NOT EXISTS idx_earned_badges_badge_id ON earned_badges (badge_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions (status);

-- Notes:
-- 1. Run this in Supabase SQL editor.
-- 2. Add members to the members table (initials list) after creation.
-- 3. Create a Supabase Storage bucket named 'badges' and 'suggestions' later.
