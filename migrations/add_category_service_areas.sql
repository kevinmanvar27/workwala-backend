-- Migration: Create category_service_areas junction table
-- Description: Links categories to specific service areas for location-based availability
-- Date: 2026-09-10
--
-- RULE: If a category has NO rows in this table → available everywhere (no restriction).
--       This keeps all existing categories working without any changes.

CREATE TABLE IF NOT EXISTS category_service_areas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  category_id     INT NOT NULL,
  service_area_id INT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate assignments
  UNIQUE KEY uq_cat_area (category_id, service_area_id),

  -- Cascade deletes: removing a category or area cleans up assignments automatically
  CONSTRAINT fk_csa_category
    FOREIGN KEY (category_id)     REFERENCES categories(id)     ON DELETE CASCADE,
  CONSTRAINT fk_csa_service_area
    FOREIGN KEY (service_area_id) REFERENCES service_areas(id)  ON DELETE CASCADE,

  INDEX idx_csa_category_id     (category_id),
  INDEX idx_csa_service_area_id (service_area_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Maps which service areas each category is available in. No rows = available everywhere.';
