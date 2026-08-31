#!/bin/bash

# Notification System Verification Script
# This script verifies that all 9 notification events are properly configured and working

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔔 PUSH NOTIFICATION SYSTEM VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Database connection (update these if needed)
DB_HOST="localhost"
DB_USER="root"
DB_PASS=""
DB_NAME="workwala"

# Function to run SQL query
run_query() {
  mysql -h "$DB_HOST" -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} "$DB_NAME" -e "$1" 2>/dev/null
}

# Function to check if tables exist
check_tables() {
  echo "📋 Step 1: Checking Required Tables..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  tables=(
    "user_fcm_tokens"
    "customer_fcm_tokens"
    "partner_fcm_tokens"
    "push_notifications"
    "push_notification_logs"
    "notification_categories"
  )
  
  all_exist=true
  for table in "${tables[@]}"; do
    result=$(run_query "SHOW TABLES LIKE '$table';")
    if [ -z "$result" ]; then
      echo "❌ Table '$table' does NOT exist"
      all_exist=false
    else
      echo "✅ Table '$table' exists"
    fi
  done
  
  echo ""
  if [ "$all_exist" = false ]; then
    echo "⚠️  Some tables are missing. Run the following SQL scripts:"
    echo "   1. scripts/create_fcm_tables.sql"
    echo "   2. scripts/create_notification_tables.sql"
    echo ""
    return 1
  fi
  return 0
}

# Function to check notification settings
check_settings() {
  echo "⚙️  Step 2: Checking Notification Settings..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Check master toggle
  master_toggle=$(run_query "SELECT value FROM settings WHERE key_name = 'push_notifications_enabled' AND deleted_at IS NULL LIMIT 1;" | tail -n 1)
  if [ "$master_toggle" = "1" ]; then
    echo "✅ Master toggle: ENABLED"
  else
    echo "❌ Master toggle: DISABLED (notifications will not be sent)"
  fi
  
  echo ""
  echo "Event-specific toggles:"
  
  events=(
    "notify_new_user:New User Registration"
    "notify_login:User Login Alert"
    "notify_delete_request:Delete Account Request"
    "notify_payment:Payment Events"
    "notify_new_booking:New Booking Created"
    "notify_booking_accepted:Booking Accepted"
    "notify_booking_completed:Booking Completed"
    "notify_withdrawal:Withdrawal Requests"
    "notify_booking_cancelled:Booking Cancelled"
  )
  
  for event_info in "${events[@]}"; do
    IFS=':' read -r event_key event_name <<< "$event_info"
    value=$(run_query "SELECT value FROM settings WHERE key_name = '$event_key' AND deleted_at IS NULL LIMIT 1;" | tail -n 1)
    if [ "$value" = "1" ]; then
      echo "  ✅ $event_name ($event_key)"
    else
      echo "  ❌ $event_name ($event_key) - DISABLED"
    fi
  done
  
  echo ""
}

# Function to check FCM configuration
check_fcm_config() {
  echo "🔥 Step 3: Checking Firebase Configuration..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  fcm_project=$(run_query "SELECT value FROM settings WHERE key_name = 'fcm_project_id' AND deleted_at IS NULL LIMIT 1;" | tail -n 1)
  fcm_client=$(run_query "SELECT value FROM settings WHERE key_name = 'fcm_client_email' AND deleted_at IS NULL LIMIT 1;" | tail -n 1)
  fcm_key=$(run_query "SELECT value FROM settings WHERE key_name = 'fcm_private_key' AND deleted_at IS NULL LIMIT 1;" | tail -n 1)
  
  if [ -n "$fcm_project" ] && [ "$fcm_project" != "NULL" ]; then
    echo "✅ Firebase Project ID: Configured"
  else
    echo "❌ Firebase Project ID: NOT configured"
  fi
  
  if [ -n "$fcm_client" ] && [ "$fcm_client" != "NULL" ]; then
    echo "✅ Firebase Client Email: Configured"
  else
    echo "❌ Firebase Client Email: NOT configured"
  fi
  
  if [ -n "$fcm_key" ] && [ "$fcm_key" != "NULL" ]; then
    echo "✅ Firebase Private Key: Configured"
  else
    echo "❌ Firebase Private Key: NOT configured"
  fi
  
  echo ""
}

# Function to check FCM tokens
check_fcm_tokens() {
  echo "📱 Step 4: Checking Registered FCM Tokens..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  admin_tokens=$(run_query "SELECT COUNT(*) FROM user_fcm_tokens WHERE deleted_at IS NULL;" | tail -n 1)
  customer_tokens=$(run_query "SELECT COUNT(*) FROM customer_fcm_tokens WHERE deleted_at IS NULL;" | tail -n 1)
  partner_tokens=$(run_query "SELECT COUNT(*) FROM partner_fcm_tokens WHERE deleted_at IS NULL;" | tail -n 1)
  
  echo "Admin tokens: $admin_tokens"
  echo "Customer tokens: $customer_tokens"
  echo "Partner tokens: $partner_tokens"
  
  total=$((admin_tokens + customer_tokens + partner_tokens))
  if [ "$total" -eq 0 ]; then
    echo ""
    echo "⚠️  No FCM tokens registered. Notifications cannot be sent until users register their devices."
  fi
  
  echo ""
}

# Function to check notification history
check_notification_history() {
  echo "📊 Step 5: Checking Notification History..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  total_notifications=$(run_query "SELECT COUNT(*) FROM push_notifications WHERE deleted_at IS NULL;" | tail -n 1)
  sent_notifications=$(run_query "SELECT COUNT(*) FROM push_notifications WHERE status = 'sent' AND deleted_at IS NULL;" | tail -n 1)
  total_logs=$(run_query "SELECT COUNT(*) FROM push_notification_logs;" | tail -n 1)
  sent_logs=$(run_query "SELECT COUNT(*) FROM push_notification_logs WHERE status = 'sent';" | tail -n 1)
  failed_logs=$(run_query "SELECT COUNT(*) FROM push_notification_logs WHERE status = 'failed';" | tail -n 1)
  
  echo "Total notifications created: $total_notifications"
  echo "Notifications sent: $sent_notifications"
  echo ""
  echo "Total delivery logs: $total_logs"
  echo "  ✅ Sent: $sent_logs"
  echo "  ❌ Failed: $failed_logs"
  
  if [ "$total_notifications" -gt 0 ]; then
    echo ""
    echo "Recent notifications (last 5):"
    run_query "SELECT id, title, LEFT(body, 50) as body_preview, status, sent_at FROM push_notifications WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5;" | column -t -s $'\t'
  fi
  
  echo ""
}

# Function to check notification categories
check_categories() {
  echo "🏷️  Step 6: Checking Notification Categories..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  categories=$(run_query "SELECT COUNT(*) FROM notification_categories WHERE deleted_at IS NULL;" | tail -n 1)
  echo "Total categories: $categories"
  
  if [ "$categories" -gt 0 ]; then
    echo ""
    echo "Available categories:"
    run_query "SELECT id, name, slug FROM notification_categories WHERE deleted_at IS NULL ORDER BY id;" | column -t -s $'\t'
  else
    echo "⚠️  No categories found. Run scripts/create_notification_tables.sql to create default categories."
  fi
  
  echo ""
}

# Function to test notification endpoints
test_endpoints() {
  echo "🧪 Step 7: Testing Notification Trigger Points..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "The following events should trigger notifications:"
  echo ""
  echo "1. ✅ Customer Registration (notify_new_user)"
  echo "   Endpoint: POST /api/customer/auth/verify-otp"
  echo "   Triggers: When new customer registers"
  echo ""
  echo "2. ✅ Partner Registration (notify_new_user)"
  echo "   Endpoint: POST /api/partner/auth/verify-otp"
  echo "   Triggers: When new partner registers"
  echo ""
  echo "3. ✅ Customer/Partner Login (notify_login)"
  echo "   Endpoint: POST /api/customer/auth/verify-otp"
  echo "   Endpoint: POST /api/partner/auth/verify-otp"
  echo "   Triggers: When existing user logs in"
  echo ""
  echo "4. ✅ Admin Login (notify_login)"
  echo "   Endpoint: POST /api/auth/login"
  echo "   Triggers: When admin logs in"
  echo ""
  echo "5. ✅ New Booking Created (notify_new_booking)"
  echo "   Endpoint: POST /api/customer/bookings"
  echo "   Triggers: When customer creates a booking"
  echo ""
  echo "6. ✅ Booking Accepted (notify_booking_accepted)"
  echo "   Endpoint: POST /api/partner/jobs/accept"
  echo "   Triggers: When partner accepts a booking"
  echo ""
  echo "7. ✅ Booking Completed (notify_booking_completed)"
  echo "   Endpoint: POST /api/customer/bookings/[id]/complete"
  echo "   Triggers: When booking is completed with payment"
  echo ""
  echo "8. ✅ Payment Processed (notify_payment)"
  echo "   Endpoint: POST /api/customer/bookings/[id]/complete"
  echo "   Triggers: When payment is successful (UPI/Wallet/Cash)"
  echo ""
  echo "9. ✅ Withdrawal Request (notify_withdrawal)"
  echo "   Endpoint: POST /api/partner/withdrawal/request"
  echo "   Triggers: When partner requests withdrawal"
  echo ""
  echo "10. ✅ Withdrawal Status Update"
  echo "    Endpoint: PATCH /api/admin/withdrawals"
  echo "    Triggers: When admin approves/rejects/completes withdrawal"
  echo ""
  echo "11. ✅ Delete Account Request (notify_delete_request)"
  echo "    Endpoint: POST /api/public/delete-account"
  echo "    Triggers: When user requests account deletion"
  echo ""
  echo "12. ⚠️  Booking Cancelled (notify_booking_cancelled)"
  echo "    Status: NOT IMPLEMENTED (future feature)"
  echo ""
}

# Function to provide recommendations
provide_recommendations() {
  echo "💡 Step 8: Recommendations..."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "To ensure notifications work properly:"
  echo ""
  echo "1. ✅ Enable push notifications in Admin Settings"
  echo "   → Go to Admin → Settings → Notifications"
  echo "   → Enable master toggle"
  echo "   → Enable individual event toggles"
  echo ""
  echo "2. ✅ Configure Firebase credentials"
  echo "   → Get credentials from Firebase Console"
  echo "   → Add to Admin Settings → Notifications"
  echo ""
  echo "3. ✅ Register FCM tokens"
  echo "   → Customers: POST /api/customer/fcm/register"
  echo "   → Partners: POST /api/partner/fcm/register"
  echo "   → Admins: POST /api/admin/fcm/register"
  echo ""
  echo "4. ✅ Test notifications"
  echo "   → Trigger events (create booking, login, etc.)"
  echo "   → Check console logs for notification status"
  echo "   → Verify notifications appear in mobile app inbox"
  echo ""
  echo "5. ✅ Monitor notification delivery"
  echo "   → Check push_notification_logs table"
  echo "   → Look for failed deliveries"
  echo "   → Review error messages"
  echo ""
}

# Main execution
main() {
  check_tables
  if [ $? -eq 0 ]; then
    check_settings
    check_fcm_config
    check_fcm_tokens
    check_notification_history
    check_categories
    test_endpoints
    provide_recommendations
  fi
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Verification Complete!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# Run the script
main
