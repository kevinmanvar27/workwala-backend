# 🚀 Quick Start Guide - Push Notifications

## For Developers

### 1. Send Notification to Admins
```typescript
import { notifyAdmins } from '@/lib/notificationHelper';

await notifyAdmins(
  'notify_new_booking',              // Event key (must match settings)
  '📅 New Booking',                  // Title
  'Booking #123 created',            // Body
  { booking_id: '123' },             // Optional data
  'booking'                          // Optional category slug
);
```

### 2. Send Notification to Customer
```typescript
import { notifyCustomer } from '@/lib/notificationHelper';

await notifyCustomer(
  customerId,                        // Customer ID
  '✅ Booking Confirmed',            // Title
  'Your booking has been accepted',  // Body
  { booking_id: '123' },             // Optional data
  'booking'                          // Optional category slug
);
```

### 3. Send Notification to Partner
```typescript
import { notifyPartner } from '@/lib/notificationHelper';

await notifyPartner(
  partnerId,                         // Partner ID
  '💰 Payment Received',             // Title
  'You received $50 for booking #123', // Body
  { booking_id: '123' },             // Optional data
  'payment'                          // Optional category slug
);
```

---

## For Admins

### Enable/Disable Notifications
1. Go to **Admin Panel** → **Settings** → **Notifications**
2. Toggle **"Enable Push Notifications"** (master switch)
3. Toggle individual events as needed

### Test Notifications
1. Go to **Admin Panel** → **Notifications** → **Test**
2. Select recipient type (Customer/Partner)
3. Enter recipient ID
4. Enter title and message
5. Click **Send Test Notification**

---

## For Mobile App Developers

### FCM Token Registration
```typescript
// Customer App
POST /api/customer/fcm/register
{
  "fcm_token": "string",
  "device_type": "android|ios|web",  // optional
  "device_id": "unique-device-id"    // optional
}

// Partner App
POST /api/partner/fcm/register
{
  "fcm_token": "string",
  "device_type": "android|ios|web",  // optional
  "device_id": "unique-device-id"    // optional
}
```

### Fetch Notifications
```typescript
// Customer App
GET /api/customer/notifications

// Response
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "title": "Booking Confirmed",
      "message": "Your booking has been accepted",
      "type": "booking",
      "is_read": false,
      "created_at": "2026-01-15T10:30:00Z"
    }
  ],
  "unread_count": 5
}
```

---

## Notification Events

| Event | Recipients | When Triggered |
|-------|-----------|---------------|
| `notify_new_user` | Admins | New registration |
| `notify_login` | Admins | User login (OFF by default) |
| `notify_delete_request` | Admins | Delete account request |
| `notify_new_booking` | Admins, Partner | New booking created |
| `notify_booking_accepted` | Admins, Customer | Partner accepts booking |
| `notify_booking_completed` | Admins, Customer, Partner | Booking completed |
| `notify_payment` | Admins, Customer | Payment processed |
| `notify_withdrawal` | Admins, Partner | Withdrawal request/status |
| `notify_booking_cancelled` | Admins, Customer, Partner | Booking cancelled |

---

## Troubleshooting

### Notifications Not Sending?
1. ✅ Check Firebase credentials configured
2. ✅ Check master toggle enabled
3. ✅ Check event toggle enabled (for admin notifications)
4. ✅ Check recipient has FCM token registered
5. ✅ Check console logs for errors

### Check Database
```sql
-- Check FCM tokens
SELECT * FROM customer_fcm_tokens WHERE customer_id = 123;
SELECT * FROM partner_fcm_tokens WHERE partner_id = 456;

-- Check notification settings
SELECT * FROM settings WHERE key_name LIKE 'notify_%';

-- Check recent notifications
SELECT * FROM push_notifications ORDER BY created_at DESC LIMIT 10;

-- Check delivery logs
SELECT * FROM push_notification_logs ORDER BY created_at DESC LIMIT 20;
```

### Run Verification
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/workwala/workwala-backend
./scripts/verify_notifications.sh
```

---

## API Endpoints

### Admin
- `POST /api/admin/push-notifications/test` - Test notification
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings

### Customer
- `POST /api/customer/fcm/register` - Register FCM token
- `GET /api/customer/notifications` - Get notifications
- `POST /api/customer/notifications/[id]/read` - Mark as read

### Partner
- `POST /api/partner/fcm/register` - Register FCM token
- Similar notification endpoints as customer

---

## Console Logs

Look for these emoji prefixes in logs:
- 🔔 `[NOTIFICATION]` - Admin notifications
- 📱 `[CUSTOMER NOTIFICATION]` - Customer notifications
- 🔔 `[PARTNER NOTIFICATION]` - Partner notifications
- 🗑️ `[FCM]` - Token cleanup
- ✅ Success
- ❌ Failure
- ⚠️ Warning

---

## Files to Know

| File | Purpose |
|------|---------|
| `/src/lib/notificationHelper.ts` | Main notification functions |
| `/src/lib/firebase.ts` | FCM sending & token cleanup |
| `/src/app/admin/settings/page.tsx` | Admin UI toggles |
| `/scripts/verify_notifications.sh` | Verification script |
| `/NOTIFICATION_IMPLEMENTATION.md` | Full documentation |

---

**Need Help?** Check `/NOTIFICATION_IMPLEMENTATION.md` for detailed documentation.
