'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, MapPin, Search, Filter } from 'lucide-react';
import PermissionGuard from '@/components/admin/PermissionGuard';
import ServiceAreaForm from '@/components/admin/ServiceAreaForm';
import ServiceAreaRequestsModal from '@/components/admin/ServiceAreaRequestsModal';

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface ServiceArea {
  id: number;
  name: string;
  latitude: string; // DECIMAL from MySQL comes as string
  longitude: string; // DECIMAL from MySQL comes as string
  radius_meters: number;
  status: 'active' | 'disabled';
  city: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  areas: ServiceArea[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    cities: string[];
  };
  error?: string;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ServiceAreasPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // UI State
  const [showForm, setShowForm] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [editingArea, setEditingArea] = useState<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    city: string | null;
    status: 'active' | 'disabled';
  } | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Get CSRF token
  const getCsrfToken = () => {
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='));
    return csrfCookie ? csrfCookie.split('=')[1] : '';
  };

  // Fetch service areas
  const fetchAreas = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (statusFilter) params.append('status', statusFilter);
      if (cityFilter) params.append('city', cityFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/service-areas?${params}`);
      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch service areas');
      }

      setAreas(data.areas);
      setPagination(data.pagination);
      setCities(data.filters.cities);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, cityFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  // Toggle status
  const handleToggleStatus = async (id: number, currentStatus: string) => {
    try {
      const response = await fetch(`/api/admin/service-areas/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'x-csrf-token': getCsrfToken()
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle status');
      }

      // Optimistic UI update
      setAreas(prev =>
        prev.map(area =>
          area.id === id ? { ...area, status: data.status } : area
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
      fetchAreas(); // Revert on error
    }
  };

  // Delete area
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service area? This action cannot be undone.')) {
      return;
    }

    setDeletingId(id);

    try {
      const response = await fetch(`/api/admin/service-areas/${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': getCsrfToken()
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete service area');
      }

      fetchAreas();
    } catch (err: any) {
      alert(err.message || 'Failed to delete service area');
    } finally {
      setDeletingId(null);
    }
  };

  // Open edit form
  const handleEdit = (area: ServiceArea) => {
    setEditingArea({
      id: area.id,
      name: area.name,
      latitude: parseFloat(area.latitude),
      longitude: parseFloat(area.longitude),
      radius_meters: area.radius_meters,
      city: area.city,
      status: area.status,
    });
    setShowForm(true);
  };

  // Close form
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingArea(undefined);
  };

  // Form success
  const handleFormSuccess = () => {
    fetchAreas();
  };

  // Reset filters
  const handleResetFilters = () => {
    setStatusFilter('');
    setCityFilter('');
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <PermissionGuard permission="service-areas.manage">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Service Areas</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage geographic coverage zones for service availability
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRequestsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <MapPin className="w-5 h-5" />
              View Area Requests
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Service Area
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or city..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(statusFilter || cityFilter || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Coordinates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Radius
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Loading service areas...
                    </td>
                  </tr>
                ) : areas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No service areas found. Click "Add Service Area" to create one.
                    </td>
                  </tr>
                ) : (
                  areas.map((area) => (
                    <tr key={area.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-purple-600" />
                          <span className="font-medium text-gray-900">{area.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {area.city || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-600">
                        {Number(area.latitude).toFixed(4)}, {Number(area.longitude).toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {(area.radius_meters / 1000).toFixed(2)} km
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(area.id, area.status)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            area.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {area.status === 'active' ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(area)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(area.id)}
                            disabled={deletingId === area.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {areas.length} of {pagination.total} areas
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <ServiceAreaForm
            area={editingArea}
            onClose={handleCloseForm}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* Requests Modal */}
        {showRequestsModal && (
          <ServiceAreaRequestsModal
            onClose={() => setShowRequestsModal(false)}
          />
        )}
      </div>
    </PermissionGuard>
  );
}
