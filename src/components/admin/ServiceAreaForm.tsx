'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import ServiceAreaMap from './ServiceAreaMap';

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface ServiceAreaFormProps {
  area?: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    city: string | null;
    status: 'active' | 'disabled';
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  city: string;
  status: 'active' | 'disabled';
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function ServiceAreaForm({ area, onClose, onSuccess }: ServiceAreaFormProps) {
  const isEdit = !!area;

  const [formData, setFormData] = useState<FormData>({
    name: area?.name || '',
    latitude: area?.latitude || 22.2735,
    longitude: area?.longitude || 70.7513,
    radiusMeters: area?.radius_meters || 5000,
    city: area?.city || '',
    status: area?.status || 'active'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get CSRF token
  const getCsrfToken = () => {
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='));
    return csrfCookie ? csrfCookie.split('=')[1] : '';
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Area name is required');
      return;
    }

    if (formData.radiusMeters <= 0) {
      setError('Radius must be greater than 0');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEdit
        ? `/api/admin/service-areas/${area.id}`
        : '/api/admin/service-areas';

      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken()
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save service area');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Service Area' : 'Add Service Area'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Area Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Area Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Mavdi, Rajkot"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              required
            />
          </div>

          {/* City (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City (Optional)
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g., Rajkot"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'disabled' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {/* Map Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location & Coverage Area
            </label>
            <ServiceAreaMap
              latitude={formData.latitude}
              longitude={formData.longitude}
              radius={formData.radiusMeters}
              onLocationChange={(lat, lng) => {
                setFormData({ ...formData, latitude: lat, longitude: lng });
              }}
              onRadiusChange={(radius) => {
                setFormData({ ...formData, radiusMeters: radius });
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Area' : 'Create Area'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
