'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Send, Users, User, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

interface Partner {
  id: number;
  name: string;
  phone: string;
  fcm_token: string | null;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  fcm_token: string | null;
}

export default function TestNotificationPage() {
  const router = useRouter();
  const [recipientType, setRecipientType] = useState<'partner' | 'customer'>('partner');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('Test Notification');
  const [body, setBody] = useState('This is a test push notification from Linko Admin.');
  const [loading, setLoading] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Load partners and customers
  useEffect(() => {
    loadRecipients();
  }, []);

  const loadRecipients = async () => {
    setLoadingRecipients(true);
    try {
      // Load partners
      const partnersRes = await apiFetch('/api/admin/partners?limit=100');
      const partnersData = await partnersRes.json();
      if (partnersRes.ok) {
        setPartners(partnersData.partners || []);
      }

      // Load customers
      const customersRes = await apiFetch('/api/admin/customers?limit=100');
      const customersData = await customersRes.json();
      if (customersRes.ok) {
        setCustomers(customersData.customers || []);
      }
    } catch (err) {
      console.error('Failed to load recipients:', err);
      toast.error('Failed to load recipients');
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedId) {
      toast.error('Please select a recipient');
      return;
    }

    if (!title.trim() || !body.trim()) {
      toast.error('Title and body are required');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/push-notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_type: recipientType,
          recipient_id: selectedId,
          title: title.trim(),
          body: body.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || 'Test notification sent successfully!');
        // Reset form
        setTitle('Test Notification');
        setBody('This is a test push notification from Linko Admin.');
      } else {
        toast.error(data.error || 'Failed to send test notification');
      }
    } catch (err) {
      console.error('Test notification error:', err);
      toast.error('Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const recipients = recipientType === 'partner' ? partners : customers;
  const selectedRecipient = recipients.find(r => r.id === selectedId);

  return (
    <PermissionGuard permission="notifications.send">
      <div className="p-6 lg:p-8 w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-[#757575] hover:text-[#2D2D2D] text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <h1 className="text-2xl font-bold text-[#2D2D2D] tracking-tight">Test Push Notification</h1>
          <p className="text-[#757575] text-sm mt-1">
            Send a test notification to verify your Firebase configuration
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] p-6 shadow-sm space-y-6">
          {/* Recipient Type */}
          <div>
            <label className="block text-xs font-semibold text-[#757575] mb-2 uppercase tracking-wide">
              Recipient Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => { setRecipientType('partner'); setSelectedId(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  recipientType === 'partner'
                    ? 'border-[#4A2372] bg-[#F3E8FF] text-[#4A2372]'
                    : 'border-[#E0E0E0] bg-white text-[#757575] hover:border-[#4A2372]/30'
                }`}
              >
                <Users size={18} />
                <span className="font-semibold">Partner</span>
              </button>
              <button
                onClick={() => { setRecipientType('customer'); setSelectedId(null); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  recipientType === 'customer'
                    ? 'border-[#4A2372] bg-[#F3E8FF] text-[#4A2372]'
                    : 'border-[#E0E0E0] bg-white text-[#757575] hover:border-[#4A2372]/30'
                }`}
              >
                <User size={18} />
                <span className="font-semibold">Customer</span>
              </button>
            </div>
          </div>

          {/* Select Recipient */}
          <div>
            <label className="block text-xs font-semibold text-[#757575] mb-2 uppercase tracking-wide">
              Select {recipientType === 'partner' ? 'Partner' : 'Customer'}
            </label>
            {loadingRecipients ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#4A2372]" />
              </div>
            ) : (
              <select
                value={selectedId || ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent transition-all"
              >
                <option value="">-- Select a recipient --</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || r.phone} ({r.phone})
                    {!r.fcm_token && ' - No FCM Token'}
                  </option>
                ))}
              </select>
            )}
            {selectedRecipient && !selectedRecipient.fcm_token && (
              <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  This {recipientType} has not registered an FCM token yet. They need to open the app to register.
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[#757575] mb-2 uppercase tracking-wide">
              Notification Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter notification title"
              maxLength={65}
              className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent transition-all"
            />
            <p className="text-xs text-[#757575] mt-1.5">{title.length}/65 characters</p>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-[#757575] mb-2 uppercase tracking-wide">
              Notification Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter notification message"
              rows={4}
              maxLength={240}
              className="w-full bg-[#F9F9F9] border border-[#E0E0E0] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] placeholder-[#757575] focus:outline-none focus:ring-2 focus:ring-[#4A2372] focus:border-transparent transition-all resize-none"
            />
            <p className="text-xs text-[#757575] mt-1.5">{body.length}/240 characters</p>
          </div>

          {/* Send Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E0E0E0]">
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 text-sm font-semibold text-[#757575] hover:text-[#2D2D2D] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendTest}
              disabled={loading || !selectedId || !selectedRecipient?.fcm_token}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#4A2372] text-white text-sm font-semibold rounded-xl hover:bg-[#3A1D5C] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Test Notification
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Testing Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Make sure Firebase credentials are configured in Settings → Notifications</li>
                <li>The recipient must have opened the app at least once to register their FCM token</li>
                <li>Test notifications will appear immediately on the recipient's device</li>
                <li>Check the device notification settings if notifications don't appear</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
