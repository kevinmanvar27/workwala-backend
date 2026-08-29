-- Migration: Create withdrawal_requests table
-- This table stores partner withdrawal requests

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_date TIMESTAMP NULL,
  processed_by INT NULL COMMENT 'Admin user ID who processed the request',
  admin_notes TEXT NULL,
  partner_notes TEXT NULL,
  bank_details JSON NULL COMMENT 'Partner bank account details',
  transaction_id VARCHAR(255) NULL COMMENT 'Payment transaction reference',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_partner_id (partner_id),
  INDEX idx_status (status),
  INDEX idx_request_date (request_date),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
