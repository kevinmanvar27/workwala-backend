# Wallet API 500 Error - Investigation & Fix Guide

## Problem Statement
Partner 26 (Developer RekTech, phone: 8690203040) cannot open the withdrawal modal. The wallet API returns:
```
flutter: 🔍 Wallet API Response: {statusCode: 500, error: Failed to fetch wallet details}
```

## Expected Behavior
- Partner has ₹600 balance
- Minimum wallet balance: ₹200
- Pending fees: ₹80 (₹60 platform + ₹20 task)
- Available for withdrawal: ₹320 (600 - 200 - 80)
- Withdrawal modal should display this information

## Root Cause Analysis

The 500 error occurs in the `calculatePendingFees()` function when it tries to parse transaction metadata. The error from production logs:

```
SyntaxError: "[object Object]" is not valid JSON
at JSON.parse()
at /home/u122886170/.../walletHelper.ts:176
```

### Why This Happens:
1. Some wallet transactions have invalid metadata stored as `"[object Object]"` instead of proper JSON
2. When `JSON.parse()` tries to parse this string, it throws an error
3. The error crashes the entire wallet API endpoint, returning 500

### Fix Status:
✅ Error handling code has been added to `walletHelper.ts` (commit 904e6b2)
✅ The code gracefully skips transactions with invalid metadata
✅ Code is committed and pushed to GitHub
⚠️  **BUT: Production server may not have restarted with the new code**

## Solution Steps

### Step 1: Verify Production Deployment

**Check if production has the latest code:**

```bash
# SSH into production server
ssh your-production-server

# Navigate to backend directory
cd /path/to/workwala-backend

# Check current commit
git log -1 --oneline

# Should show: 904e6b2 Changes related wallet balance
```

**If not on latest commit:**
```bash
# Pull latest code
git pull origin main

# Install dependencies (if needed)
npm install

# Restart the application
pm2 restart workwala-backend
# OR
systemctl restart workwala-backend
# OR kill and restart the Node.js process
```

### Step 2: Run Diagnostic Script

**On production server:**
```bash
cd /path/to/workwala-backend
NODE_ENV=production node scripts/diagnose_wallet_issue.js
```

This will:
- ✅ Check if partner 26 exists
- ✅ Verify wallet settings are configured
- ✅ List all transactions for partner 26
- ✅ Identify transactions with invalid metadata
- ✅ Test metadata parsing
- ✅ Calculate pending fees
- ✅ Provide actionable recommendations

### Step 3: Fix Invalid Metadata (if found)

**If diagnostic finds invalid metadata:**
```bash
cd /path/to/workwala-backend
NODE_ENV=production node scripts/fix_wallet_metadata.js
```

This will:
- Find all transactions with invalid metadata (`"[object Object]"` or non-JSON strings)
- Set their metadata to NULL (safest option)
- Verify the fix was successful

### Step 4: Verify Fix

**Test the wallet API:**
```bash
# Get partner's auth token (from Flutter app or database)
TOKEN="partner_jwt_token_here"

# Test wallet API
curl -H "Authorization: Bearer $TOKEN" \
     https://joinlinko.com/api/partner/wallet
```

**Expected response:**
```json
{
  "success": true,
  "balance": {
    "gross_earnings": 600,
    "pending_platform_fees": 60,
    "pending_task_fees": 20,
    "total_pending_fees": 80,
    "total": 600,
    "minimum_required": 200,
    "available_for_withdrawal": 320,
    "is_below_minimum": false,
    "is_negative": false
  },
  "settings": {
    "minimum_balance": 200,
    "minimum_withdrawal_amount": 100,
    "platform_fee_type": "percentage",
    "platform_fee_value": 10,
    "task_fee": 20
  },
  "statistics": { ... },
  "recent_transactions": [ ... ]
}
```

## Alternative: Quick Fix Without Server Access

If you **cannot access the production server** directly, you can:

### Option A: Force Restart via Hosting Panel
1. Login to Hostinger control panel
2. Navigate to your application
3. Restart the Node.js application
4. This will load the latest committed code

### Option B: Trigger Deployment via Git Hook
If you have auto-deployment set up:
```bash
# Make a trivial change to force deployment
cd /Applications/XAMPP/xamppfiles/htdocs/workwala/workwala-backend
echo "# Force deployment" >> README.md
git add README.md
git commit -m "chore: Force production deployment"
git push origin main
```

### Option C: Database Direct Fix
If you have phpMyAdmin or database access:

**1. Find invalid metadata:**
```sql
SELECT id, partner_id, type, amount, metadata
FROM wallet_transactions
WHERE metadata IS NOT NULL
  AND (
    metadata = '[object Object]'
    OR metadata NOT LIKE '{%'
  );
```

**2. Fix invalid metadata:**
```sql
UPDATE wallet_transactions
SET metadata = NULL
WHERE metadata IS NOT NULL
  AND (
    metadata = '[object Object]'
    OR metadata NOT LIKE '{%'
  );
```

**3. Verify fix:**
```sql
SELECT COUNT(*) as remaining_invalid
FROM wallet_transactions
WHERE metadata IS NOT NULL
  AND (
    metadata = '[object Object]'
    OR metadata NOT LIKE '{%'
  );
-- Should return 0
```

## Prevention: Avoid Future Issues

### 1. Update Booking Completion Code
Ensure metadata is always stored as proper JSON string:

```typescript
// WRONG:
metadata: bookingData  // This stores "[object Object]"

// CORRECT:
metadata: JSON.stringify(bookingData)
```

### 2. Add Database Constraint
```sql
ALTER TABLE wallet_transactions
ADD CONSTRAINT check_metadata_json
CHECK (
  metadata IS NULL OR 
  metadata LIKE '{%' OR 
  metadata LIKE '[%'
);
```

### 3. Add Validation in Code
```typescript
function saveTransaction(data: any) {
  if (data.metadata && typeof data.metadata === 'object') {
    data.metadata = JSON.stringify(data.metadata);
  }
  // ... save to database
}
```

## Troubleshooting

### Issue: Still getting 500 error after fix

**Check 1: Verify production server restarted**
```bash
# Check process start time
ps aux | grep node
# Should show recent start time
```

**Check 2: Check production logs**
```bash
# View real-time logs
tail -f /path/to/logs/production.log
# OR
pm2 logs workwala-backend
```

**Check 3: Verify database connection**
```bash
# Test database connection
node scripts/diagnose_wallet_issue.js
```

### Issue: Different error message

If you see a different error:
1. Check production logs for the actual error
2. The error handling in `walletHelper.ts` will log the specific issue
3. Look for lines starting with `❌ Transaction X: Failed to parse metadata`

### Issue: Partner 26 not found

This means:
- You're connected to the wrong database
- Partner 26 doesn't exist in production
- Database name mismatch in `.env` file

Check:
```sql
SELECT id, name, phone FROM partners WHERE phone = '8690203040';
```

## Files Modified (Reference)

1. **workwala-backend/src/lib/walletHelper.ts** (lines 174-216)
   - Added try-catch error handling in `calculatePendingFees()`
   - Handles both string and object metadata
   - Validates JSON before parsing
   - Skips invalid transactions gracefully

2. **workwala-backend/scripts/fix_wallet_metadata.js** (NEW)
   - Identifies transactions with invalid metadata
   - Fixes by setting to NULL
   - Safe to run multiple times

3. **workwala-backend/scripts/diagnose_wallet_issue.js** (NEW)
   - Comprehensive diagnostic tool
   - Tests all aspects of wallet system
   - Provides actionable recommendations

## Success Criteria

✅ Wallet API returns 200 status code
✅ Response includes balance, settings, and transactions
✅ Available balance shows ₹320
✅ Partner can open withdrawal modal
✅ Partner can request withdrawal between ₹100-₹320
✅ No more 500 errors in production logs

## Next Steps After Fix

1. **Test withdrawal flow end-to-end:**
   - Partner opens wallet
   - Views available balance
   - Requests withdrawal of ₹200
   - Admin approves withdrawal
   - Balance updates correctly

2. **Monitor production logs:**
   - Watch for any new errors
   - Verify no more metadata parse errors
   - Check transaction creation is working

3. **Update documentation:**
   - Document proper metadata handling
   - Add to developer onboarding
   - Create runbook for similar issues

## Contact & Support

If issues persist:
1. Run diagnostic script and share output
2. Check production logs and share relevant errors
3. Verify database state using SQL queries above
4. Ensure production server has latest code (commit 904e6b2 or later)

---

**Last Updated:** 2026-09-02
**Status:** Fix deployed, awaiting production restart verification
