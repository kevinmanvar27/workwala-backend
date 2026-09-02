# 🚨 WALLET API 500 ERROR - QUICK FIX CARD

## Problem
Partner 26 cannot withdraw money. Wallet API returns 500 error.

## Root Cause
Invalid JSON metadata in `wallet_transactions` table: `"[object Object]"` instead of proper JSON.

---

## 🎯 QUICK FIX (Choose One)

### Option 1: Automated Script (RECOMMENDED) ⭐
```bash
# SSH into production
ssh u122886170@joinlinko.com

# Run hotfix
cd /home/u122886170/domains/joinlinko.com/public_html/workwala-backend
NODE_ENV=production node scripts/production_wallet_hotfix.js

# Type "yes" when prompted
```

### Option 2: Manual Database Fix
```sql
-- In phpMyAdmin, run this:
UPDATE wallet_transactions
SET metadata = NULL
WHERE partner_id = 26
  AND metadata IS NOT NULL
  AND (metadata = '[object Object]' OR metadata NOT LIKE '{%');
```

### Option 3: Restart Server (If code not loaded)
```bash
pm2 restart workwala-backend
# OR
systemctl restart workwala-backend
```

---

## ✅ Verify Fix

```bash
# Test API
curl -H "Authorization: Bearer TOKEN" https://joinlinko.com/api/partner/wallet

# Should return: 200 OK with available_for_withdrawal: 320
```

---

## 📋 Expected Result

**Before:** 500 Error  
**After:** 200 OK with ₹320 available for withdrawal

---

## 🆘 If Still Broken

1. Check production server has latest code: `git log -1 --oneline` (should show 904e6b2 or later)
2. Check database has been fixed: Run diagnostic script
3. Check server restarted: `pm2 status` or `ps aux | grep node`
4. Check logs: `pm2 logs workwala-backend --lines 100`

---

## 📞 Files To Reference

- **Quick Guide:** `PRODUCTION_HOTFIX_README.md`
- **Detailed Guide:** `WALLET_500_ERROR_FIX_GUIDE.md`
- **Deployment Steps:** `DEPLOYMENT_STEPS.md`

---

**Time to Fix:** 5-10 minutes  
**Risk Level:** 🟢 LOW  
**Priority:** 🔴 HIGH
