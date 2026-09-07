# WhatsApp OTP Integration Guide

This guide explains how to set up WhatsApp OTP functionality using Meta Business API.

## Overview

The application now supports sending OTPs via WhatsApp in addition to SMS (MSG91). When WhatsApp is enabled and properly configured, OTPs will be sent via WhatsApp. Otherwise, the system falls back to SMS or dev mode (console logging).

## Prerequisites

1. **Meta Business Account** - Create at [business.facebook.com](https://business.facebook.com/)
2. **WhatsApp Business Account** - Set up through Meta Business Suite
3. **Verified Phone Number** - A phone number verified with Meta for WhatsApp Business
4. **Message Template** - An approved OTP template in Meta Business Manager

## Setup Steps

### 1. Create WhatsApp Business Account

1. Go to [Meta Business Suite](https://business.facebook.com/)
2. Navigate to **Business Settings** → **Accounts** → **WhatsApp Accounts**
3. Click **Add** and follow the setup wizard
4. Verify your business phone number

### 2. Get API Credentials

#### Phone Number ID
1. Go to **Business Settings** → **WhatsApp** → **API Setup**
2. Copy your **Phone Number ID** (e.g., `1255897550943348`)

#### Business Account ID
1. In **Business Settings** → **WhatsApp Accounts**
2. Copy your **WhatsApp Business Account ID** (e.g., `1956538045015229`)

#### Permanent Access Token
1. Go to **Business Settings** → **Users** → **System Users**
2. Create a new System User or select existing one
3. Click **Generate New Token**
4. Select your WhatsApp app
5. Grant permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
6. Set token to **Never Expire** (recommended for production)
7. Copy and securely store the token

#### Webhook Verify Token
1. Create a secure random string (e.g., `aquatrek_webhook_2026`)
2. Use this same token when setting up webhooks in Meta

### 3. Create Message Template

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp Manager** → **Message Templates**
3. Click **Create Template**
4. Template details:
   - **Name**: `otp_verification` (must match the code)
   - **Category**: Authentication
   - **Language**: English
   - **Body**: 
     ```
     Your OTP is {{1}}. It will expire in 5 minutes. Do not share this code with anyone.
     ```
5. Submit for approval (usually approved within minutes)

### 4. Configure in Application

1. Log in to your admin panel
2. Go to **Settings** → **SMS / OTP** tab
3. Scroll to **WhatsApp Meta API Configuration**
4. Fill in the credentials:
   - **Phone Number ID**: From step 2
   - **WhatsApp Business Account ID**: From step 2
   - **Permanent Access Token**: From step 2
   - **Webhook Verify Token**: From step 2
5. Toggle **Enable WhatsApp Integration** to ON
6. Click **Save Changes**

### 5. Run Database Migration

Execute the SQL migration to add WhatsApp settings to your database:

```bash
mysql -u your_username -p your_database < migrations/add_whatsapp_settings.sql
```

Or run directly in your MySQL client:

```sql
INSERT INTO settings (key_name, value, group_name, created_at, updated_at) VALUES
('whatsapp_enabled', '0', 'sms', NOW(), NOW()),
('whatsapp_phone_number_id', '', 'sms', NOW(), NOW()),
('whatsapp_business_account_id', '', 'sms', NOW(), NOW()),
('whatsapp_access_token', '', 'sms', NOW(), NOW()),
('whatsapp_webhook_verify_token', '', 'sms', NOW(), NOW())
ON DUPLICATE KEY UPDATE key_name = key_name, updated_at = NOW();
```

## How It Works

### Priority System

1. **WhatsApp Enabled** → OTPs sent via WhatsApp
2. **WhatsApp Disabled** → Falls back to MSG91 SMS
3. **Neither Configured** → Dev mode (console logging)

### Code Flow

```typescript
// Check if WhatsApp is enabled
const whatsappEnabled = await isWhatsAppEnabled();

if (whatsappEnabled) {
  // Send via WhatsApp
  result = await sendWhatsAppOtp(phone, otp);
} else {
  // Fallback to SMS
  result = await sendOtp(phone, otp);
}
```

### API Response

The response includes the method used:

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "method": "whatsapp"  // or "sms"
}
```

## Testing

### Development Mode

When credentials are not configured, the system runs in dev mode:

```
┌─────────────────────────────────┐
│  [DEV] CUSTOMER OTP             │
│  Phone : 9876543210             │
│  OTP   : 123456                 │
│  Method: WHATSAPP               │
└─────────────────────────────────┘
```

### Production Testing

1. Enable WhatsApp in settings
2. Try logging in with a test phone number
3. Check if WhatsApp message is received
4. Verify OTP works correctly

## Troubleshooting

### OTP Not Received

1. **Check Template Status**: Ensure your template is approved
2. **Verify Phone Format**: Must be in format `91XXXXXXXXXX` (country code + number)
3. **Check Token Permissions**: Token must have `whatsapp_business_messaging` permission
4. **Review Logs**: Check server console for error messages

### Common Errors

#### "Template not found"
- Template name in code must match Meta: `otp_verification`
- Template must be approved and active

#### "Invalid phone number"
- Phone must be in international format without `+` or spaces
- Example: `919876543210` for Indian number

#### "Token expired"
- Generate a new permanent access token
- Update in settings

### Webhook Setup (Optional)

For receiving delivery status and user messages:

1. Set up a webhook endpoint in your application
2. Configure webhook in Meta Business Settings
3. Use your **Webhook Verify Token** for verification

## Security Notes

1. **Never commit tokens** to version control
2. **Use environment variables** for sensitive data in production
3. **Rotate tokens** periodically
4. **Monitor API usage** in Meta Business Manager
5. **Keep tokens secure** - they provide full access to your WhatsApp Business account

## Files Modified

- `src/lib/whatsapp.ts` - WhatsApp utility functions
- `src/app/api/admin/settings/route.ts` - Settings API with WhatsApp keys
- `src/app/admin/settings/page.tsx` - Admin UI for WhatsApp config
- `src/app/api/customer/auth/send-otp/route.ts` - Customer OTP with WhatsApp
- `src/app/api/partner/auth/send-otp/route.ts` - Partner OTP with WhatsApp
- `migrations/add_whatsapp_settings.sql` - Database migration

## Support

For issues with:
- **Meta API**: [Meta for Developers](https://developers.facebook.com/support/)
- **WhatsApp Business**: [WhatsApp Business Help](https://www.facebook.com/business/help/whatsapp)
- **Template Approval**: Usually takes 5-30 minutes, check Message Templates section

## Additional Resources

- [WhatsApp Business Platform Documentation](https://developers.facebook.com/docs/whatsapp)
- [Meta Business API](https://developers.facebook.com/docs/graph-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
