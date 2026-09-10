-- Wave-based partner search expansion
-- Adds three columns to bookings to track the expanding radius search.
-- All columns are NULL-able so existing rows are unaffected (backward compatible).
-- NULL search_radius_km  → old booking, no radius filter applied.
-- NULL search_expires_at → old booking, never auto-cancelled by wave logic.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS search_radius_km   TINYINT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Current wave radius in km (1-5). NULL = no wave filter.',
  ADD COLUMN IF NOT EXISTS radius_expanded_at DATETIME         NULL DEFAULT NULL
    COMMENT 'When the radius was last expanded. Used to time the next wave.',
  ADD COLUMN IF NOT EXISTS search_expires_at  DATETIME         NULL DEFAULT NULL
    COMMENT 'When the search window closes and the booking auto-cancels.';
