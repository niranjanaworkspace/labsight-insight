/*
# Add parameter_name column to analysis table

## Overview
The analysis table is missing a `parameter_name` column that the dashboard needs to display
which parameter each analysis finding relates to. This adds it as a nullable text column.

## Modified Tables
### analysis
- Added `parameter_name` (text, nullable) — human-readable parameter name for the finding

## Security
- No policy changes needed. Existing RLS policies already cover the new column via
  the existing column-level grants.
*/

ALTER TABLE analysis ADD COLUMN IF NOT EXISTS parameter_name text;
