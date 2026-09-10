-- Migration: Create service_area_requests table
-- Description: Track customer requests for services in unavailable areas
-- Date: 2026-09-10

-- Create service_area_requests table
CREATE TABLE IF NOT EXISTS service_area_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT DEFAULT NULL COMMENT 'Customer who made the request (NULL if not logged in)',
  category_id INT NOT NULL COMMENT 'Service category requested',
  latitude DECIMAL(10, 8) NOT NULL COMMENT 'Customer location latitude',
  longitude DECIMAL(11, 8) NOT NULL COMMENT 'Customer location longitude',
  city VARCHAR(100) DEFAULT NULL COMMENT 'City name (reverse geocoded)',
  address TEXT DEFAULT NULL COMMENT 'Full address (optional)',
  device_info JSON DEFAULT NULL COMMENT 'Device details (platform, OS version, etc.)',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'Request IP address',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When the request was made',
  
  INDEX idx_category (category_id),
  INDEX idx_customer (customer_id),
  INDEX idx_location (latitude, longitude),
  INDEX idx_requested_at (requested_at),
  INDEX idx_city (city),
  
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tracks customer requests for services in unavailable areas';
