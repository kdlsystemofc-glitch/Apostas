-- League Profiles
CREATE TABLE league_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  season TEXT,
  source TEXT,
  matches_sample NUMERIC,
  avg_goals NUMERIC,
  avg_goals_home NUMERIC,
  avg_goals_away NUMERIC,
  avg_corners NUMERIC,
  avg_corners_home NUMERIC,
  avg_corners_away NUMERIC,
  avg_cards NUMERIC,
  avg_cards_home NUMERIC,
  avg_cards_away NUMERIC,
  avg_xg NUMERIC,
  btts_pct NUMERIC,
  over_05_goals_pct NUMERIC,
  over_15_goals_pct NUMERIC,
  over_25_goals_pct NUMERIC,
  over_35_goals_pct NUMERIC,
  over_45_goals_pct NUMERIC,
  over_55_goals_pct NUMERIC,
  over_65_corners_pct NUMERIC,
  over_75_corners_pct NUMERIC,
  over_85_corners_pct NUMERIC,
  over_95_corners_pct NUMERIC,
  over_105_corners_pct NUMERIC,
  over_115_corners_pct NUMERIC,
  over_125_corners_pct NUMERIC,
  over_135_corners_pct NUMERIC,
  over_05_cards_pct NUMERIC,
  over_15_cards_pct NUMERIC,
  over_25_cards_pct NUMERIC,
  over_35_cards_pct NUMERIC,
  over_45_cards_pct NUMERIC,
  over_55_cards_pct NUMERIC,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- Matches
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  date TEXT,
  league_profile_id UUID REFERENCES league_profiles(id),
  home_stats JSONB,
  away_stats JSONB,
  results JSONB,
  real_results JSONB,
  status TEXT DEFAULT 'pending',
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) básico
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_profiles ENABLE ROW LEVEL SECURITY;

-- Política pública para leitura (ajustar depois para multi-user)
CREATE POLICY "Public read" ON matches FOR SELECT USING (true);
CREATE POLICY "Public write" ON matches FOR ALL USING (true);
CREATE POLICY "Public read" ON league_profiles FOR SELECT USING (true);
CREATE POLICY "Public write" ON league_profiles FOR ALL USING (true);
