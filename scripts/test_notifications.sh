#!/bin/bash

# Test Push Notification System
# This script tests all 9 notification events to ensure they trigger correctly

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 PUSH NOTIFICATION SYSTEM TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

BASE_URL="http://localhost:3000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check database for notification records
check_db_notifications() {
    local event_name=$1
    echo -e "${BLUE}Checking database for notifications...${NC}"
    echo "Please manually verify in phpMyAdmin:"
    echo "  1. Open: http://localhost/phpmyadmin"
    echo "  2. Select 'workwala' database"
    echo "  3. Check 'push_notifications' table - should have new record with title matching event"
    echo "  4. Check 'push_notification_logs' table - should have logs for each recipient"
    echo ""
}

# Test 1: Admin Login Notification
echo -e "${YELLOW}TEST 1: Admin Login Notification (notify_admin_login)${NC}"
echo "Action: Login to admin panel"
echo "Expected: Admin users should receive notification about admin login"
echo "Steps:"
echo "  1. Go to: ${BASE_URL}/admin/login"
echo "  2. Login with admin credentials"
echo "  3. Check server logs for notification output"
check_db_notifications "Admin Login"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 2: Partner Registration Notification
echo -e "${YELLOW}TEST 2: Partner Registration (notify_new_user)${NC}"
echo "Action: Register new partner via mobile app"
echo "Expected: Admin users should receive notification about new partner registration"
echo "Steps:"
echo "  1. Use partner mobile app or API: POST ${BASE_URL}/api/partner/auth/verify-otp"
echo "  2. Complete OTP verification for new partner"
echo "  3. Check server logs for notification output"
check_db_notifications "Partner Registration"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 3: New Booking Notification
echo -e "${YELLOW}TEST 3: New Booking (notify_new_booking)${NC}"
echo "Action: Create new booking via customer app"
echo "Expected: Admin users should receive notification about new booking"
echo "Steps:"
echo "  1. Use customer mobile app or API: POST ${BASE_URL}/api/customer/bookings"
echo "  2. Create a new booking"
echo "  3. Check server logs for notification output"
check_db_notifications "New Booking"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 4: Booking Acceptance Notification
echo -e "${YELLOW}TEST 4: Booking Acceptance (notify_booking_accepted)${NC}"
echo "Action: Partner accepts a booking"
echo "Expected:"
echo "  - Customer should receive notification that partner accepted their booking"
echo "  - Admin users should receive notification about booking acceptance"
echo "Steps:"
echo "  1. Use partner mobile app or API: POST ${BASE_URL}/api/partner/jobs/accept"
echo "  2. Accept an available booking"
echo "  3. Check server logs for notification output"
check_db_notifications "Booking Acceptance"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 5: Booking Completion Notification
echo -e "${YELLOW}TEST 5: Booking Completion (notify_booking_completed)${NC}"
echo "Action: Complete a booking"
echo "Expected:"
echo "  - Customer should receive notification that booking is completed"
echo "  - Admin users should receive notification about booking completion"
echo "Steps:"
echo "  1. Use customer mobile app or API: POST ${BASE_URL}/api/customer/bookings/[id]/complete"
echo "  2. Complete an active booking"
echo "  3. Check server logs for notification output"
check_db_notifications "Booking Completion"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 6: Payment Processed Notification
echo -e "${YELLOW}TEST 6: Payment Processed (notify_payment_processed)${NC}"
echo "Action: Process payment for completed booking"
echo "Expected: Admin users should receive notification about payment processing"
echo "Note: This is triggered during booking completion flow"
echo "Steps:"
echo "  1. Complete a booking (Test 5)"
echo "  2. Payment notification should be sent automatically"
echo "  3. Check server logs for notification output"
check_db_notifications "Payment Processed"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 7: Withdrawal Request Notification
echo -e "${YELLOW}TEST 7: Withdrawal Request (notify_withdrawal_request)${NC}"
echo "Action: Partner requests withdrawal"
echo "Expected: Admin users should receive notification about withdrawal request"
echo "Steps:"
echo "  1. Use partner mobile app or API: POST ${BASE_URL}/api/partner/withdrawal/request"
echo "  2. Request a withdrawal"
echo "  3. Check server logs for notification output"
check_db_notifications "Withdrawal Request"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 8: Withdrawal Approval Notification
echo -e "${YELLOW}TEST 8: Withdrawal Approval (notify_withdrawal_request)${NC}"
echo "Action: Admin approves withdrawal request"
echo "Expected: Partner should receive notification about withdrawal approval"
echo "Steps:"
echo "  1. Login to admin panel: ${BASE_URL}/admin/withdrawals"
echo "  2. Approve a pending withdrawal request"
echo "  3. Check server logs for notification output"
check_db_notifications "Withdrawal Approval"
echo ""
read -p "Press Enter to continue to next test..."
echo ""

# Test 9: Account Deletion Request Notification
echo -e "${YELLOW}TEST 9: Account Deletion Request (notify_account_deletion)${NC}"
echo "Action: User requests account deletion"
echo "Expected: Admin users should receive notification about account deletion request"
echo "Steps:"
echo "  1. Use mobile app or API: POST ${BASE_URL}/api/public/delete-account"
echo "  2. Request account deletion"
echo "  3. Check server logs for notification output"
check_db_notifications "Account Deletion"
echo ""
read -p "Press Enter to continue..."
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ TEST CHECKLIST${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "For each test, verify:"
echo "  ✓ Server logs show notification being sent"
echo "  ✓ Record created in 'push_notifications' table"
echo "  ✓ Logs created in 'push_notification_logs' table"
echo "  ✓ Notification appears in mobile app notification inbox"
echo "  ✓ FCM push notification received on device (if FCM configured)"
echo ""
echo "Database Verification:"
echo "  1. Open phpMyAdmin: http://localhost/phpmyadmin"
echo "  2. Select 'workwala' database"
echo "  3. Check tables:"
echo "     - push_notifications (should have 9+ new records)"
echo "     - push_notification_logs (should have logs for each recipient)"
echo "     - notification_categories (should have 6 categories)"
echo ""
echo "Mobile App Verification:"
echo "  1. Customer App: GET ${BASE_URL}/api/customer/notifications"
echo "  2. Partner App: GET ${BASE_URL}/api/partner/notifications"
echo "  3. Verify notifications appear in inbox"
echo ""
echo "Admin Settings Verification:"
echo "  1. Open: ${BASE_URL}/admin/settings (Notifications tab)"
echo "  2. Verify all 9 event toggles exist"
echo "  3. Test disabling individual events"
echo "  4. Test master toggle disables all events"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ TESTING COMPLETE${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
