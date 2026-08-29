'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  Search, CheckCircle, XCircle, Clock, DollarSign,
  ChevronLeft, ChevronRight, Inbox, Phone, Eye, X,
  AlertTriangle, Save, ChevronDown, FileText, TrendingUp,
} from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import { apiFetch } from '@/lib/apiFetch';

interface WithdrawalRow {
  id: number;
  partner_id: number;
  partner_name: string;
  partner_phone: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  request_date: string;
  processed_date: string | null;
  processed_by: number | null;
  admin_name: string | null;
  admin_notes: string | null;
  partner_notes: string | null;
  transaction_id: string | null;
  partner_balance: number;
}

interface Stats {
  pending: { count: number; amount: number };
  approved: { count: number; amount: number };
  completed: { count: number; amount: number };
}

// Status styling
const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  pending:   { dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   label: 'Pending'   },
  approved:  { dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    label: 'Approved'  },
  completed: { dot: 'bg-[#2E7D32]',   text: 'text-[#2E7D32]',  bg: 'bg-green-50',   label: 'Completed' },
  rejected:  { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     label: 'Rejected'  },
};

const TAB_OPTIONS = ['pending', 'approved', 'completed', 'rejected', 'all'] as const;
type StatusTab = typeof TAB_OPTIONS[number];

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusTab>('pending');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRow | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processAction, setProcessAction] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    console.log('🔍 Fetching withdrawals...', { search, statusFilter, page, limit });
    try {
      const response = await apiFetch(
        `/api/admin/withdrawals?search=${encodeURIComponent(search)}&status=${statusFilter}&page=${page}&limit=${limit}`
      );
      const res = await response.json();
      console.log('✅ Withdrawals response:', res);
      if (res.withdrawals) {
        console.log('📊 Setting withdrawals:', res.withdrawals.length, 'records');
        // Convert numeric fields from strings to numbers
        const normalizedWithdrawals = res.withdrawals.map((w: any) => ({
          ...w,
          amount: Number(w.amount),
          partner_balance: Number(w.partner_balance),
        }));
        setWithdrawals(normalizedWithdrawals);
        setTotal(res.total || 0);
        setStats(res.stats || null);
      } else {
        console.warn('⚠️ No withdrawals in response');
      }
    } catch (err) {
      console.error('❌ Error fetching withdrawals:', err);
      toast.error('Failed to load withdrawals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, limit]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const handleProcess = async () => {
    if (!selectedWithdrawal) return;
    
    if (processAction === 'complete' && !transactionId.trim()) {
      toast.error('Transaction ID is required to complete withdrawal');
      return;
    }

    setProcessing(true);
    try {
      const response = await apiFetch('/api/admin/withdrawals', {
        method: 'PATCH',
        body: JSON.stringify({
          id: selectedWithdrawal.id,
          action: processAction,
          admin_notes: adminNotes.trim() || undefined,
          transaction_id: processAction === 'complete' ? transactionId.trim() : undefined,
        }),
      });
      
      const res = await response.json();

      if (res.success) {
        toast.success(res.message || `Withdrawal ${processAction}ed successfully`);
        setShowProcessModal(false);
        setSelectedWithdrawal(null);
        setAdminNotes('');
        setTransactionId('');
        fetchWithdrawals();
      } else {
        toast.error(res.error || 'Failed to process withdrawal');
      }
    } catch (err) {
      toast.error('Failed to process withdrawal');
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const openProcessModal = (withdrawal: WithdrawalRow, action: 'approve' | 'reject' | 'complete') => {
    setSelectedWithdrawal(withdrawal);
    setProcessAction(action);
    setAdminNotes('');
    setTransactionId('');
    setShowProcessModal(true);
  };

  const openDetailsModal = (withdrawal: WithdrawalRow) => {
    setSelectedWithdrawal(withdrawal);
    setShowDetailsModal(true);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <PermissionGuard permission="users.view">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">Withdrawal Requests</h1>
            <p className="text-sm text-[#757575] mt-1">Manage partner withdrawal requests</p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-5 border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700 font-medium">Pending Requests</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">{stats.pending.count}</p>
                  <p className="text-sm text-amber-600 mt-1">₹{stats.pending.amount.toFixed(2)}</p>
                </div>
                <div className="bg-amber-200 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-amber-700" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Approved</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{stats.approved.count}</p>
                  <p className="text-sm text-blue-600 mt-1">₹{stats.approved.amount.toFixed(2)}</p>
                </div>
                <div className="bg-blue-200 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-blue-700" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Completed</p>
                  <p className="text-2xl font-bold text-green-900 mt-1">{stats.completed.count}</p>
                  <p className="text-sm text-green-600 mt-1">₹{stats.completed.amount.toFixed(2)}</p>
                </div>
                <div className="bg-green-200 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-700" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#757575]" />
              <input
                type="text"
                placeholder="Search by partner name or phone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setStatusFilter(tab);
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab
                      ? 'bg-[#7C3AED] text-white'
                      : 'bg-[#F5F5F5] text-[#757575] hover:bg-[#E5E5E5]'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#7C3AED]"></div>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Inbox className="w-16 h-16 text-[#BDBDBD] mb-4" />
              <p className="text-[#757575] text-lg">No withdrawal requests found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#F9F9F9] border-b border-[#E5E5E5]">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#757575] uppercase tracking-wider">
                        Partner
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#757575] uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#757575] uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#757575] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#757575] uppercase tracking-wider">
                        Request Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[#757575] uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {withdrawals.map((withdrawal) => {
                      const style = STATUS_STYLES[withdrawal.status];
                      return (
                        <tr key={withdrawal.id} className="hover:bg-[#F9F9F9] transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-[#1a1a1a]">
                                {withdrawal.partner_name || 'N/A'}
                              </p>
                              <p className="text-sm text-[#757575] flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {withdrawal.partner_phone}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-[#1a1a1a]">₹{withdrawal.amount.toFixed(2)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-[#757575]">₹{withdrawal.partner_balance.toFixed(2)}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
                              {style.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-[#757575]">
                              {new Date(withdrawal.request_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-[#BDBDBD]">
                              {new Date(withdrawal.request_date).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openDetailsModal(withdrawal)}
                                className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4 text-[#757575]" />
                              </button>
                              {withdrawal.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => openProcessModal(withdrawal, 'approve')}
                                    className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </button>
                                  <button
                                    onClick={() => openProcessModal(withdrawal, 'reject')}
                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  </button>
                                  <button
                                    onClick={() => openProcessModal(withdrawal, 'complete')}
                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Complete"
                                  >
                                    <DollarSign className="w-4 h-4 text-blue-600" />
                                  </button>
                                </>
                              )}
                              {withdrawal.status === 'approved' && (
                                <button
                                  onClick={() => openProcessModal(withdrawal, 'complete')}
                                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E5E5]">
                  <p className="text-sm text-[#757575]">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm text-[#757575]">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-[#E5E5E5] hover:bg-[#F5F5F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedWithdrawal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-[#E5E5E5] px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#1a1a1a]">Withdrawal Details</h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[#757575]">Partner Name</p>
                    <p className="font-medium text-[#1a1a1a]">{selectedWithdrawal.partner_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#757575]">Phone</p>
                    <p className="font-medium text-[#1a1a1a]">{selectedWithdrawal.partner_phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#757575]">Amount</p>
                    <p className="font-bold text-lg text-[#1a1a1a]">₹{selectedWithdrawal.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#757575]">Partner Balance</p>
                    <p className="font-medium text-[#1a1a1a]">₹{selectedWithdrawal.partner_balance.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#757575]">Status</p>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[selectedWithdrawal.status].bg} ${STATUS_STYLES[selectedWithdrawal.status].text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[selectedWithdrawal.status].dot}`}></span>
                      {STATUS_STYLES[selectedWithdrawal.status].label}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-[#757575]">Request Date</p>
                    <p className="font-medium text-[#1a1a1a]">
                      {new Date(selectedWithdrawal.request_date).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {selectedWithdrawal.processed_date && (
                    <>
                      <div>
                        <p className="text-sm text-[#757575]">Processed Date</p>
                        <p className="font-medium text-[#1a1a1a]">
                          {new Date(selectedWithdrawal.processed_date).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-[#757575]">Processed By</p>
                        <p className="font-medium text-[#1a1a1a]">{selectedWithdrawal.admin_name || 'N/A'}</p>
                      </div>
                    </>
                  )}
                  {selectedWithdrawal.transaction_id && (
                    <div className="col-span-2">
                      <p className="text-sm text-[#757575]">Transaction ID</p>
                      <p className="font-mono text-sm text-[#1a1a1a] bg-[#F5F5F5] px-3 py-2 rounded-lg">
                        {selectedWithdrawal.transaction_id}
                      </p>
                    </div>
                  )}
                </div>
                {selectedWithdrawal.partner_notes && (
                  <div>
                    <p className="text-sm text-[#757575] mb-2">Partner Notes</p>
                    <p className="text-sm text-[#1a1a1a] bg-[#F9F9F9] px-4 py-3 rounded-lg">
                      {selectedWithdrawal.partner_notes}
                    </p>
                  </div>
                )}
                {selectedWithdrawal.admin_notes && (
                  <div>
                    <p className="text-sm text-[#757575] mb-2">Admin Notes</p>
                    <p className="text-sm text-[#1a1a1a] bg-amber-50 px-4 py-3 rounded-lg border border-amber-200">
                      {selectedWithdrawal.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Process Modal */}
        {showProcessModal && selectedWithdrawal && createPortal(
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full">
              <div className="border-b border-[#E5E5E5] px-6 py-4">
                <h2 className="text-xl font-bold text-[#1a1a1a]">
                  {processAction === 'approve' && 'Approve Withdrawal'}
                  {processAction === 'reject' && 'Reject Withdrawal'}
                  {processAction === 'complete' && 'Complete Withdrawal'}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-[#F9F9F9] p-4 rounded-lg">
                  <p className="text-sm text-[#757575]">Partner</p>
                  <p className="font-medium text-[#1a1a1a]">{selectedWithdrawal.partner_name}</p>
                  <p className="text-sm text-[#757575] mt-2">Amount</p>
                  <p className="font-bold text-lg text-[#1a1a1a]">₹{selectedWithdrawal.amount.toFixed(2)}</p>
                </div>

                {processAction === 'complete' && (
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                      Transaction ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter payment transaction ID"
                      className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    Admin Notes {processAction === 'reject' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={processAction === 'reject' ? 'Provide reason for rejection' : 'Add notes (optional)'}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent resize-none"
                  />
                </div>

                {processAction === 'complete' && selectedWithdrawal.amount > selectedWithdrawal.partner_balance && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">Insufficient Balance</p>
                      <p className="text-sm text-red-700 mt-1">
                        Partner balance (₹{selectedWithdrawal.partner_balance.toFixed(2)}) is less than withdrawal amount (₹{selectedWithdrawal.amount.toFixed(2)})
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-[#E5E5E5] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowProcessModal(false)}
                  disabled={processing}
                  className="px-4 py-2 text-[#757575] hover:bg-[#F5F5F5] rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcess}
                  disabled={processing || (processAction === 'complete' && selectedWithdrawal.amount > selectedWithdrawal.partner_balance)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                    processAction === 'approve'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : processAction === 'reject'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {processAction === 'approve' && 'Approve'}
                      {processAction === 'reject' && 'Reject'}
                      {processAction === 'complete' && 'Complete'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </PermissionGuard>
  );
}
