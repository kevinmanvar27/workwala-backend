# 🚨 URGENT: Wallet API 500 Error Fix - Production Deployment

## Quick Summary
Partner 26 cannot withdraw money. Wallet API returns 500 error due to invalid JSON metadata in database.

**Fix Status:** ✅ Code fix deployed (commit 904e6b2)  
**Action Required:** Run hotfix script on production server

---

## 🎯 Quick Fix (5 minutes)

### Option 1: Automated Hotfix Script (Recommended)

**SSH into production server and run:**

```bash
cd /path/to/workwala-backend
NODE_ENV=production node scripts/production_wallet_hotfix.js
```

This will:
1. ✅ Diagnose the issue
2. ✅ Show what's wrong
3. ✅ Ask permission to fix
4. ✅ Apply fixes automatically
5. ✅ Verify the fix worked

**When prompted "Fix invalid metadata now?", type:** `yes`

---

### Option 2: Manual Database Fix (If script fails)

**1. Login to phpMyAdmin or database client**

**2. Run this query to find the problem:**
```sql
SELECT id, partner_id, type, amount, metadata
FROM wallet_transactions
WHERE partner_id = 26
  AND metadata IS NOT NULL
  AND (
    metadata = '[object Object]'
    OR metadata NOT LIKE '{%'
  );
```

**3. If any rows found, fix them:**
```sql
UPDATE wallet_transactions
SET metadata = NULL
WHERE partner_id = 26
  AND metadata IS NOT NULL
  AND (
    metadata = '[object Object]'
    OR metadata NOT LIKE '{%'
  );
```

**4. Verify fix:**
```sql
-- Should return 0
SELECT COUNT(*) FROM wallet_transactions
WHERE partner_id = 26
  AND metadata IS NOT NULL
  AND (metadata = '[object Object]' OR metadata NOT LIKE '{%');
```

---

### Option 3: Restart Production Server (If code not loaded)

The fix is already in the code (commit 904e6b2), but server needs restart:

```bash
# If using PM2:
pm2 restart workwala-backend

# If using systemd:
sudo systemctl restart workwala-backend

# If using direct Node.js:
pkill -f "node.*workwala"
cd /path/to/workwala-backend
npm run start:prod &
```

---

## 📋 Verification Steps

### 1. Check if fix worked:

```bash
cd /path/to/workwala-backend
NODE_ENV=production node scripts/diagnose_wallet_issue.js
```

Should show:
- ✅ Partner 26 found
- ✅ All wallet settings configured
- ✅ No invalid metadata
- ✅ Available balance: ₹320

### 2. Test API endpoint:

```bash
# Get auth token from partner app or database
TOKEN="partner_jwt_token_here"

# Test wallet API
curl -H "Authorization: Bearer $TOKEN" \
     https://joinlinko.com/api/partner/wallet

# Should return 200 OK with JSON response
```

### 3. Test in Flutter app:

1. Open partner app
2. Login as partner 26 (phone: 8690203040)
3. Navigate to wallet
4. Click withdraw button
5. **Should open modal with ₹320 available**

---

## 🔍 What Was The Problem?

### Root Cause:
Some wallet transactions had invalid metadata stored as `"[object Object]"` instead of proper JSON:

```javascript
// WRONG (what was in database):
metadata: "[object Object]"

// CORRECT (what should be):
metadata: '{"platform_fee":60,"task_fee":20,"fees_pending":true}'
```

### Why It Caused 500 Error:
```javascript
// This line in walletHelper.ts would crash:
JSON.parse("[object Object]")  // ❌ SyntaxError!
```

### How We Fixed It:
1. Added error handling to skip invalid metadata
2. Created script to clean up database
3. Added validation to prevent future issues

---

## 📁 Files Involved

### Backend Files Modified:
1. `src/lib/walletHelper.ts` - Added error handling (commit 904e6b2)
2. `scripts/fix_wallet_metadata.js` - Database cleanup script
3. `scripts/diagnose_wallet_issue.js` - Diagnostic tool
4. `scripts/production_wallet_hotfix.js` - Automated fix script

### Documentation Created:
1. `WALLET_500_ERROR_FIX_GUIDE.md` - Comprehensive guide
2. `PRODUCTION_HOTFIX_README.md` - This file

---

## 🚀 Deployment Checklist

- [ ] SSH into production server
- [ ] Navigate to backend directory
- [ ] Verify on latest commit: `git log -1 --oneline` (should show 904e6b2)
- [ ] Run hotfix script: `NODE_ENV=production node scripts/production_wallet_hotfix.js`
- [ ] Type "yes" when asked to fix
- [ ] Verify fix: Run diagnostic script
- [ ] Test API endpoint with curl
- [ ] Test in Flutter app
- [ ] Monitor logs for 24 hours: `pm2 logs workwala-backend`

---

## 🆘 Troubleshooting

### Issue: "Partner 26 NOT FOUND"
**Cause:** Wrong database or partner doesn't exist  
**Fix:** Check `.env` file has correct `DB_NAME` and `DB_HOST`

### Issue: "Cannot connect to database"
**Cause:** Database credentials wrong or service down  
**Fix:** Check MySQL is running: `systemctl status mysql`

### Issue: Still getting 500 error after fix
**Cause:** Server not restarted or different error  
**Fix:** 
1. Restart server: `pm2 restart workwala-backend`
2. Check logs: `pm2 logs workwala-backend --lines 100`
3. Look for actual error message

### Issue: Script asks for password
**Cause:** Database password required  
**Fix:** Ensure `.env` or `.env.production` has `DB_PASSWORD` set

---

## 📞 Support

If issues persist after following this guide:

1. **Capture diagnostic output:**
   ```bash
   NODE_ENV=production node scripts/diagnose_wallet_issue.js > diagnostic.txt 2>&1
   ```

2. **Capture production logs:**
   ```bash
   pm2 logs workwala-backend --lines 200 > production-logs.txt
   ```

3. **Check database state:**
   ```sql
   SELECT * FROM partners WHERE id = 26;
   SELECT * FROM wallet_transactions WHERE partner_id = 26;
   SELECT * FROM settings WHERE key_name LIKE 'partner_%';
   ```

4. **Share these files with development team**

---

## ✅ Success Indicators

After fix is applied, you should see:

1. **In diagnostic script:**
   ```
   ✅ Partner found: Developer RekTech (ID: 26)
   ✅ All wallet settings configured
   ✅ No invalid metadata found
   ✅ Available for Withdrawal: ₹320
   ```

2. **In API response:**
   ```json
   {
     "success": true,
     "balance": {
       "available_for_withdrawal": 320
     }
   }
   ```

3. **In Flutter app:**
   - Withdrawal modal opens
   - Shows "Available: ₹320"
   - Can request withdrawal

4. **In production logs:**
   - No more "SyntaxError: not valid JSON"
   - No more 500 errors on /api/partner/wallet

---

## 🔐 Production Server Access

**Hostinger Details:**
- URL: https://joinlinko.com
- Database: u122886170_linko
- Backend Path: `/home/u122886170/domains/joinlinko.com/public_html/workwala-backend`

**SSH Access:**
```bash
ssh u122886170@joinlinko.com
# OR via Hostinger control panel terminal
```

**Database Access:**
- phpMyAdmin: https://joinlinko.com:2083/cpsess.../phpMyAdmin
- Or via Hostinger control panel → Databases

---

## 📊 Expected Results

### Before Fix:
```
GET /api/partner/wallet
Status: 500
Error: "Failed to fetch wallet details"
```

### After Fix:
```
GET /api/partner/wallet
Status: 200
Body: {
  "success": true,
  "balance": {
    "total": 600,
    "minimum_required": 200,
    "total_pending_fees": 80,
    "available_for_withdrawal": 320
  },
  "settings": {
    "minimum_withdrawal_amount": 100
  }
}
```

---

**Last Updated:** 2026-09-02  
**Priority:** 🔴 HIGH - Production issue affecting partner withdrawals  
**Estimated Fix Time:** 5-10 minutes  
**Risk Level:** 🟢 LOW - Safe database cleanup, no data loss
