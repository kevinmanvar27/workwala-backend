-- Migration: Add fee tracking columns to withdrawal_requests table
-- Purpose: Track admin profit from platform and task fees during partner withdrawals
-- Date: 2024

-- Add fee tracking columns
ALTER TABLE withdrawal_requests 
ADD COLUMN gross_amount DECIMAL(10,2) DEFAULT 0 COMMENT 'Partner earnings before fee deduction' AFTER amount,
ADD COLUMN platform_fee DECIMAL(10,2) DEFAULT 0 COMMENT 'Platform fee deducted (admin profit)' AFTER gross_amount,
ADD COLUMN task_fee DECIMAL(10,2) DEFAULT 0 COMMENT 'Task fee deducted (admin profit)' AFTER platform_fee,
ADD COLUMN total_fee DECIMAL(10,2) DEFAULT 0 COMMENT 'Total fees deducted (platform + task)' AFTER task_fee,
ADD COLUMN net_payout DECIMAL(10,2) DEFAULT 0 COMMENT 'Actual amount to transfer to partner (amount - total_fee)' AFTER total_fee;

-- Add index for reporting queries
CREATE INDEX idx_withdrawal_fees ON withdrawal_requests(status, total_fee, processed_date);

-- Add comment to table for documentation
ALTER TABLE withdrawal_requests 
COMMENT 'Withdrawal requests with fee tracking. gross_amount = earnings before fees, total_fee = admin profit, net_payout = actual transfer amount';
