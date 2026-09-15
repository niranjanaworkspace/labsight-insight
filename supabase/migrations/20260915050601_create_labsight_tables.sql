/*
# Create LABSIGHT AI core tables

## Overview
Creates the five core tables for LABSIGHT AI: profiles, reports, lab_results, analysis, and anomalies.
All tables are user-scoped (multi-tenant) with Row Level Security enabled so each authenticated
user can only see and modify their own data.

## New Tables

### 1. profiles
- `id` (uuid, primary key, references auth.users) — one row per user
- `full_name` (text) — display name
- `created_at` (timestamptz) — when the profile was created
- `updated_at` (timestamptz) — when the profile was last updated

### 2. reports
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, defaults to auth.uid()) — owner
- `title` (text) — report title (e.g. "Complete Blood Count")
- `report_date` (date) — date the lab report was issued
- `lab_name` (text) — name of the laboratory
- `sample_number` (text) — lab sample identifier
- `parameter_count` (integer) — number of parameters in the report
- `status` (text) — "stable" | "review" | "significant"
- `summary` (text) — AI-generated summary of the report
- `file_url` (text, nullable) — URL to the uploaded file in storage
- `created_at` (timestamptz)

### 3. lab_results
- `id` (uuid, primary key)
- `report_id` (uuid, references reports, cascade delete) — which report this result belongs to
- `user_id` (uuid, references auth.users, defaults to auth.uid()) — owner (denormalized for RLS)
- `parameter_key` (text) — machine key (e.g. "tsh", "hemoglobin")
- `parameter_name` (text) — human-readable name
- `value` (numeric) — the measured value
- `unit` (text) — unit of measurement
- `reference_range` (text) — reference range string
- `status` (text) — "stable" | "review" | "significant"
- `created_at` (timestamptz)

### 4. analysis
- `id` (uuid, primary key)
- `report_id` (uuid, references reports, cascade delete) — which report was analyzed
- `user_id` (uuid, references auth.users, defaults to auth.uid()) — owner
- `headline` (text) — short headline of the finding
- `status` (text) — "stable" | "review" | "significant"
- `change_label` (text) — e.g. "+81.3%"
- `confidence` (integer) — confidence score 0-100
- `reasons` (jsonb) — array of reason strings
- `recommendation` (text) — recommendation text
- `created_at` (timestamptz)

### 5. anomalies
- `id` (uuid, primary key)
- `report_id` (uuid, references reports, cascade delete) — which report the anomaly was found in
- `user_id` (uuid, references auth.users, defaults to auth.uid()) — owner
- `parameter_key` (text) — which parameter is anomalous
- `parameter_name` (text) — human-readable name
- `anomaly_type` (text) — "high" | "low" | "trend" | "cross_range"
- `severity` (text) — "stable" | "review" | "significant"
- `description` (text) — description of the anomaly
- `created_at` (timestamptz)

## Security
- RLS enabled on all five tables.
- Each table has 4 policies (SELECT, INSERT, UPDATE, DELETE) scoped to `authenticated` users
  checking `auth.uid() = user_id`.
- `user_id` columns default to `auth.uid()` so frontend inserts that omit `user_id` still pass
  the WITH CHECK constraint.
- lab_results, analysis, and anomalies also have `user_id` for direct ownership checks
  (not just parent-based checks) so policies remain simple and correct.
*/

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profiles" ON profiles;
CREATE POLICY "select_own_profiles" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profiles" ON profiles;
CREATE POLICY "insert_own_profiles" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profiles" ON profiles;
CREATE POLICY "update_own_profiles" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profiles" ON profiles;
CREATE POLICY "delete_own_profiles" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- 2. reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_date date,
  lab_name text,
  sample_number text,
  parameter_count integer DEFAULT 0,
  status text DEFAULT 'stable',
  summary text,
  file_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reports" ON reports;
CREATE POLICY "update_own_reports" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reports" ON reports;
CREATE POLICY "delete_own_reports" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3. lab_results
CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  parameter_name text NOT NULL,
  value numeric,
  unit text,
  reference_range text,
  status text DEFAULT 'stable',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lab_results" ON lab_results;
CREATE POLICY "select_own_lab_results" ON lab_results FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lab_results" ON lab_results;
CREATE POLICY "insert_own_lab_results" ON lab_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_lab_results" ON lab_results;
CREATE POLICY "update_own_lab_results" ON lab_results FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_lab_results" ON lab_results;
CREATE POLICY "delete_own_lab_results" ON lab_results FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. analysis
CREATE TABLE IF NOT EXISTS analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text NOT NULL,
  status text DEFAULT 'stable',
  change_label text,
  confidence integer DEFAULT 0,
  reasons jsonb DEFAULT '[]'::jsonb,
  recommendation text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analysis" ON analysis;
CREATE POLICY "select_own_analysis" ON analysis FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_analysis" ON analysis;
CREATE POLICY "insert_own_analysis" ON analysis FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_analysis" ON analysis;
CREATE POLICY "update_own_analysis" ON analysis FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_analysis" ON analysis;
CREATE POLICY "delete_own_analysis" ON analysis FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 5. anomalies
CREATE TABLE IF NOT EXISTS anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  parameter_name text NOT NULL,
  anomaly_type text,
  severity text DEFAULT 'stable',
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_anomalies" ON anomalies;
CREATE POLICY "select_own_anomalies" ON anomalies FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_anomalies" ON anomalies;
CREATE POLICY "insert_own_anomalies" ON anomalies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_anomalies" ON anomalies;
CREATE POLICY "update_own_anomalies" ON anomalies FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_anomalies" ON anomalies;
CREATE POLICY "delete_own_anomalies" ON anomalies FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_report_id ON lab_results(report_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_user_id ON lab_results(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_report_id ON analysis(report_id);
CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_report_id ON anomalies(report_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON anomalies(user_id);
