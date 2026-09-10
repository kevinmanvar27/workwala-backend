'use client';

import { useEffect, useState } from 'react';
import { X, MapPin, TrendingUp, Calendar, Users } from 'lucide-react';

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface AreaRequest {
  id: number;
  category_id: number;
  category_name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  request_count: number;
  last_requested_at: string;
  customer_name: string | null;
  customer_phone: string | null;
}

interface Props {
  onClose: () => void;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ServiceAreaRequestsModal({ onClose }: Props) {
  const [requests, setRequests] = useState<AreaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState<'location' | 'category'>('location');
  const [total, setTotal] = useState(0);

  // Fetch requests
  useEffect(() => {
    fetchRequests();
  }, [groupBy]);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/service-area-requests?groupBy=${groupBy}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch requests');
      }

      setRequests(data.requests || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Service Area Requests</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track customer demand in unavailable areas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">
                Total Requests: <span className="text-purple-600 font-bold">{total}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Group By Toggle */}
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Group by:</span>
            <button
              onClick={() => setGroupBy('location')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                groupBy === 'location'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </button>
            <button
              onClick={() => setGroupBy('category')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                groupBy === 'category'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" />
              Service Type
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 font-medium">{error}</div>
              <button
                onClick={fetchRequests}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retry
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No requests yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Requests will appear here when customers try to book services in unavailable areas
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow bg-white"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900 text-lg">
                          {req.category_name}
                        </span>
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                          {req.request_count} request{req.request_count > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        {/* Location */}
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                          <span>
                            {req.city || `${req.latitude.toFixed(4)}, ${req.longitude.toFixed(4)}`}
                          </span>
                        </div>

                        {/* Customer info (only in location grouping) */}
                        {req.customer_name && (
                          <div className="flex items-start gap-2">
                            <Users className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>
                              {req.customer_name} ({req.customer_phone})
                            </span>
                          </div>
                        )}

                        {/* Time */}
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{formatDate(req.last_requested_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <a
                      href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
                    >
                      View on Map
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${req.latitude},${req.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
                    >
                      Get Directions
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              💡 <strong>Tip:</strong> Use this data to prioritize service area expansion
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
