-- Migration: Create service_areas table
-- Description: Stores geographic service coverage zones with circular radius-based areas
-- Date: 2026-09-06

-- Create service_areas table
CREATE TABLE IF NOT EXISTS service_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT 'Area name (e.g., "Mavdi, Rajkot")',
  latitude DECIMAL(10, 8) NOT NULL COMMENT 'Center point latitude (-90 to 90)',
  longitude DECIMAL(11, 8) NOT NULL COMMENT 'Center point longitude (-180 to 180)',
  radius_meters INT UNSIGNED NOT NULL COMMENT 'Coverage radius in meters',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active' COMMENT 'Area availability status',
  city VARCHAR(100) DEFAULT NULL COMMENT 'City name for filtering (optional)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_city (city),
  INDEX idx_status_city (status, city),
  INDEX idx_coordinates (latitude, longitude)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Service coverage areas for availability checks';
