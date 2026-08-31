import { query } from './db';
import { isPushEnabled, isNotifyEventEnabled, sendPushNotification } from './firebase';

/**
 * Creates a notification record in push_notifications table.
 * Returns the new notification ID, or null on failure.
 */
async function createNotificationRecord(
  title: string,
  body: string,
  categorySlug?: string
): Promise<number | null> {
  try {
    let categoryId: number | null = null;
    if (categorySlug) {
      const cats = await query<{ id: number }[]>(
        `SELECT id FROM notification_categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
        [categorySlug]
      );
      if (cats.length > 0) categoryId = cats[0].id;
    }

    const result = await query<{ insertId: number }>(
      `INSERT INTO push_notifications
         (title, body, category_id, audience_type, status, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, 'custom', 'sent', NOW(), NOW(), NOW())`,
      [title, body, categoryId]
    );

    return result.insertId ?? null;
  } catch (err) {
    console.error('[NOTIFY] Error creating notification record:', err);
    return null;
  }
}

/**
 * Writes a log row in push_notification_logs.
 * Called both when FCM succeeds/fails AND when there is no FCM token at all
 * (so the notification always appears in the in-app inbox).
 */
async function writeLog(
  notificationId: number,
  recipientType: 'user' | 'customer' | 'partner',
  recipientId: number,
  recipientName: string,
  fcmToken: string | null,
  status: 'sent' | 'failed' | 'pending',
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO push_notification_logs
         (notification_id, recipient_type, recipient_id, recipient_name,
          fcm_token, status, sent_at, error_message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())`,
      [
        notificationId,
        recipientType,
        recipientId,
        recipientName,
        fcmToken ?? null,
        status,
        errorMessage ?? null,
      ]
    );
  } catch (err) {
    console.error('[NOTIFY] Error writing notification log:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyAdmins
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a push notification to all admin users.
 * Always stores the notification + per-admin log so it appears in the inbox,
 * even when no FCM token is registered.
 *
 * @param event        - Setting key, e.g. 'notify_new_booking'
 * @param title        - Notification title
 * @param body         - Notification body
 * @param data         - Optional FCM data payload
 * @param categorySlug - Optional category slug, e.g. 'booking'
 */
export async function notifyAdmins(
  event: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  categorySlug?: string
): Promise<void> {
  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔔 [NOTIFY ADMINS] Event: ${event} | Title: ${title}`);

    // 1. Check master push toggle
    const pushEnabled = await isPushEnabled();
    if (!pushEnabled) {
      console.log(`⏭️  [NOTIFY ADMINS] Push disabled globally — skipping ${event}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    // 2. Check per-event toggle
    const eventEnabled = await isNotifyEventEnabled(event);
    if (!eventEnabled) {
      console.log(`⏭️  [NOTIFY ADMINS] Event '${event}' disabled — skipping`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    // 3. Create the notification record (inbox entry)
    const notificationId = await createNotificationRecord(title, body, categorySlug);
    if (!notificationId) {
      console.log(`⚠️  [NOTIFY ADMINS] Could not create notification record for '${event}'`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }
    console.log(`📝 [NOTIFY ADMINS] Created notification record #${notificationId}`);

    // 4. Fetch all active admins (with or without FCM tokens)
    const admins = await query<{ user_id: number; name: string }[]>(
      `SELECT DISTINCT u.id AS user_id, u.name
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE r.slug IN ('admin', 'super-admin')
         AND u.status = 'active'
         AND u.deleted_at IS NULL`
    );

    if (admins.length === 0) {
      console.log(`⚠️  [NOTIFY ADMINS] No active admin users found`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    console.log(`👥 [NOTIFY ADMINS] Notifying ${admins.length} admin(s)`);

    for (const admin of admins) {
      // Get FCM tokens for this admin (may be empty)
      const tokens = await query<{ fcm_token: string }[]>(
        `SELECT fcm_token FROM user_fcm_tokens
         WHERE user_id = ? AND deleted_at IS NULL`,
        [admin.user_id]
      );

      if (tokens.length === 0) {
        // No device registered — still write an inbox log so it shows in the app
        await writeLog(notificationId, 'user', admin.user_id, admin.name, null, 'pending', 'No FCM token registered');
        console.log(`   📭 ${admin.name} — no FCM token, inbox log written`);
        continue;
      }

      for (const { fcm_token } of tokens) {
        const ok = await sendPushNotification(fcm_token, title, body, data);
        await writeLog(notificationId, 'user', admin.user_id, admin.name, fcm_token, ok ? 'sent' : 'failed', ok ? undefined : 'FCM delivery failed');
        console.log(`   ${ok ? '✅' : '❌'} ${admin.name} — FCM ${ok ? 'sent' : 'failed'}`);
      }
    }

    console.log(`✅ [NOTIFY ADMINS] Done for '${event}'`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (err) {
    console.error(`❌ [NOTIFY ADMINS] Unhandled error for '${event}':`, err);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyCustomer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a push notification to a specific customer.
 * Always stores the notification + log so it appears in the inbox,
 * even when no FCM token is registered.
 *
 * @param customerId   - Customer ID
 * @param title        - Notification title
 * @param body         - Notification body
 * @param data         - Optional FCM data payload
 * @param categorySlug - Optional category slug
 */
export async function notifyCustomer(
  customerId: number,
  title: string,
  body: string,
  data?: Record<string, string>,
  categorySlug?: string
): Promise<void> {
  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔔 [NOTIFY CUSTOMER] Customer #${customerId} | Title: ${title}`);

    // Check master push toggle
    const pushEnabled = await isPushEnabled();
    if (!pushEnabled) {
      console.log(`⏭️  [NOTIFY CUSTOMER] Push disabled globally — skipping`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    // Fetch customer info
    const customers = await query<{ name: string | null; phone: string }[]>(
      `SELECT name, phone FROM customers WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [customerId]
    );
    if (customers.length === 0) {
      console.log(`⚠️  [NOTIFY CUSTOMER] Customer #${customerId} not found`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }
    const customerName = customers[0].name || customers[0].phone;

    // Create notification record
    const notificationId = await createNotificationRecord(title, body, categorySlug);
    if (!notificationId) {
      console.log(`⚠️  [NOTIFY CUSTOMER] Could not create notification record`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }
    console.log(`📝 [NOTIFY CUSTOMER] Created notification record #${notificationId}`);

    // Get FCM tokens
    const tokens = await query<{ fcm_token: string }[]>(
      `SELECT fcm_token FROM customer_fcm_tokens
       WHERE customer_id = ? AND deleted_at IS NULL`,
      [customerId]
    );

    if (tokens.length === 0) {
      // No device — still write inbox log
      await writeLog(notificationId, 'customer', customerId, customerName, null, 'pending', 'No FCM token registered');
      console.log(`   📭 ${customerName} — no FCM token, inbox log written`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    for (const { fcm_token } of tokens) {
      const ok = await sendPushNotification(fcm_token, title, body, data);
      await writeLog(notificationId, 'customer', customerId, customerName, fcm_token, ok ? 'sent' : 'failed', ok ? undefined : 'FCM delivery failed');
      console.log(`   ${ok ? '✅' : '❌'} ${customerName} — FCM ${ok ? 'sent' : 'failed'}`);
    }

    console.log(`✅ [NOTIFY CUSTOMER] Done for customer #${customerId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (err) {
    console.error(`❌ [NOTIFY CUSTOMER] Unhandled error for customer #${customerId}:`, err);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// notifyPartner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a push notification to a specific partner.
 * Always stores the notification + log so it appears in the inbox,
 * even when no FCM token is registered.
 *
 * @param partnerId    - Partner ID
 * @param title        - Notification title
 * @param body         - Notification body
 * @param data         - Optional FCM data payload
 * @param categorySlug - Optional category slug
 */
export async function notifyPartner(
  partnerId: number,
  title: string,
  body: string,
  data?: Record<string, string>,
  categorySlug?: string
): Promise<void> {
  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔔 [NOTIFY PARTNER] Partner #${partnerId} | Title: ${title}`);

    // Check master push toggle
    const pushEnabled = await isPushEnabled();
    if (!pushEnabled) {
      console.log(`⏭️  [NOTIFY PARTNER] Push disabled globally — skipping`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    // Fetch partner info
    const partners = await query<{ name: string | null; phone: string }[]>(
      `SELECT name, phone FROM partners WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [partnerId]
    );
    if (partners.length === 0) {
      console.log(`⚠️  [NOTIFY PARTNER] Partner #${partnerId} not found`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }
    const partnerName = partners[0].name || partners[0].phone;

    // Create notification record
    const notificationId = await createNotificationRecord(title, body, categorySlug);
    if (!notificationId) {
      console.log(`⚠️  [NOTIFY PARTNER] Could not create notification record`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }
    console.log(`📝 [NOTIFY PARTNER] Created notification record #${notificationId}`);

    // Get FCM tokens
    const tokens = await query<{ fcm_token: string }[]>(
      `SELECT fcm_token FROM partner_fcm_tokens
       WHERE partner_id = ? AND deleted_at IS NULL`,
      [partnerId]
    );

    if (tokens.length === 0) {
      // No device — still write inbox log
      await writeLog(notificationId, 'partner', partnerId, partnerName, null, 'pending', 'No FCM token registered');
      console.log(`   📭 ${partnerName} — no FCM token, inbox log written`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    for (const { fcm_token } of tokens) {
      const ok = await sendPushNotification(fcm_token, title, body, data);
      await writeLog(notificationId, 'partner', partnerId, partnerName, fcm_token, ok ? 'sent' : 'failed', ok ? undefined : 'FCM delivery failed');
      console.log(`   ${ok ? '✅' : '❌'} ${partnerName} — FCM ${ok ? 'sent' : 'failed'}`);
    }

    console.log(`✅ [NOTIFY PARTNER] Done for partner #${partnerId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } catch (err) {
    console.error(`❌ [NOTIFY PARTNER] Unhandled error for partner #${partnerId}:`, err);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}
