import * as admin from 'firebase-admin';
import { query } from './db';

/**
 * Reads Firebase Admin SDK credentials from the settings table (notifications group)
 * and returns { projectId, clientEmail, privateKey } — or null if not configured.
 *
 * The private key is stored in the DB with real newlines (\n).
 * Firebase Admin SDK requires real newlines, so we normalize \\n → \n just in case.
 */
async function getFirebaseConfig(): Promise<{
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null> {
  try {
    const rows = await query<{ key_name: string; value: string }[]>(
      `SELECT key_name, value FROM settings
       WHERE group_name = 'notifications'
         AND key_name IN ('fcm_project_id', 'fcm_client_email', 'fcm_private_key')
         AND deleted_at IS NULL`
    );

    const cfg: Record<string, string> = {};
    rows.forEach((r) => (cfg[r.key_name] = r.value));

    const projectId   = cfg['fcm_project_id']   || '';
    const clientEmail = cfg['fcm_client_email']  || '';
    // Normalize escaped newlines that come from copy-pasting the JSON file value
    const privateKey  = (cfg['fcm_private_key']  || '').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) return null;

    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

/**
 * Returns an initialized firebase-admin app instance.
 * Re-uses an existing app if already initialized (Next.js hot-reload safe).
 * Returns null if credentials are not configured in the DB.
 */
export async function getFirebaseApp(): Promise<admin.app.App | null> {
  const cfg = await getFirebaseConfig();
  if (!cfg) return null;

  const appName = 'linko';

  // Re-use existing app if already initialized
  try {
    return admin.app(appName);
  } catch {
    // App not initialized yet — create it
  }

  try {
    return admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId:   cfg.projectId,
          clientEmail: cfg.clientEmail,
          privateKey:  cfg.privateKey,
        }),
      },
      appName
    );
  } catch (err) {
    console.error('Firebase Admin init error:', err);
    return null;
  }
}

/**
 * Returns a Firebase Messaging instance, or null if not configured.
 */
export async function getFirebaseMessaging(): Promise<admin.messaging.Messaging | null> {
  const app = await getFirebaseApp();
  if (!app) return null;
  return admin.messaging(app);
}

/**
 * Checks whether push notifications are enabled in settings.
 */
export async function isPushEnabled(): Promise<boolean> {
  try {
    const rows = await query<{ value: string }[]>(
      `SELECT value FROM settings
       WHERE key_name = 'push_notifications_enabled'
         AND deleted_at IS NULL
       LIMIT 1`
    );
    return rows[0]?.value === '1';
  } catch {
    return false;
  }
}

/**
 * Checks whether a specific notification event is enabled.
 * @param event  e.g. 'notify_new_user' | 'notify_login' | 'notify_delete_request' | 'notify_payment'
 */
export async function isNotifyEventEnabled(event: string): Promise<boolean> {
  try {
    const rows = await query<{ value: string }[]>(
      `SELECT value FROM settings
       WHERE key_name = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [event]
    );
    return rows[0]?.value === '1';
  } catch {
    return false;
  }
}

/**
 * Sends a push notification to a single FCM device token.
 * Returns true on success, false on failure.
 *
 * @example
 * await sendPushNotification(token, 'New User', 'A new user registered');
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return false;

    await messaging.send({
      token,
      notification: { title, body },
      ...(data ? { data } : {}),
    });
    return true;
  } catch (error: any) {
    // Handle invalid/expired tokens
    if (error?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
        error?.errorInfo?.code === 'messaging/invalid-registration-token') {
      console.warn(`⚠️ [FCM] Invalid token detected, should be removed: ${token.substring(0, 20)}...`);
      // Delete invalid token from database
      await deleteInvalidToken(token);
      return false;
    }
    
    console.error('Push notification error:', error);
    return false;
  }
}

/**
 * Delete invalid FCM token from all token tables
 */
async function deleteInvalidToken(token: string): Promise<void> {
  try {
    const { query } = await import('./db');
    
    // Delete from admin tokens
    await query('DELETE FROM user_fcm_tokens WHERE fcm_token = ?', [token]);
    
    // Delete from customer tokens
    await query('DELETE FROM customer_fcm_tokens WHERE fcm_token = ?', [token]);
    
    // Delete from partner tokens
    await query('DELETE FROM partner_fcm_tokens WHERE fcm_token = ?', [token]);
    
    console.log(`🗑️ [FCM] Deleted invalid token from database`);
  } catch (err) {
    console.error('❌ [FCM] Error deleting invalid token:', err);
  }
}
