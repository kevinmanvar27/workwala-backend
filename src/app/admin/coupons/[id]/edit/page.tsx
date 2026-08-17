'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import CouponForm from '@/components/admin/CouponForm';

export default function EditCouponPage() {
  const params   = useParams();
  const router   = useRouter();
  const couponId = Number(params.id);

  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch(`/api/admin/coupons/${couponId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.coupon) {
          const c = data.coupon;
          setInitialData({
            code: c.code,
            auto_generate: false,
            code_length: '8',
            code_prefix: '',
            name: c.name,
            description: c.description || '',
            terms_conditions: c.terms_conditions || '',
            discount_type: c.discount_type,
            discount_value: String(c.discount_value),
            min_order_value: String(c.min_order_value || 0),
            max_discount_amount: c.max_discount_amount ? String(c.max_discount_amount) : '',
            max_total_usage: c.max_total_usage ? String(c.max_total_usage) : '',
            max_usage_per_user: String(c.max_usage_per_user || 1),
            once_per_order: !!c.once_per_order,
            combinable: !!c.combinable,
            starts_at: c.starts_at ? new Date(new Date(c.starts_at).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16) : '',
            expires_at: c.expires_at ? new Date(new Date(c.expires_at).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16) : '',
            status: c.status === 'active' ? 'active' : c.status === 'scheduled' ? 'scheduled' : 'draft',
            audience_type: c.audience_type || 'all',
            audience_cities: Array.isArray(c.applicable_cities) ? c.applicable_cities.join(', ') : '',
            applicable_categories: Array.isArray(c.applicable_categories) ? c.applicable_categories : [],
            applicable_partners: Array.isArray(c.applicable_partners) ? c.applicable_partners : [],
            applicable_cities: Array.isArray(c.applicable_cities) ? c.applicable_cities : [],
            applicable_services: Array.isArray(c.applicable_services) ? c.applicable_services : [],
          });
        } else {
          toast.error('Coupon not found');
          router.push('/admin/coupons');
        }
      })
      .catch(() => {
        toast.error('Failed to load coupon');
        router.push('/admin/coupons');
      })
      .finally(() => setLoading(false));
  }, [couponId, router]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!initialData) return null;

  return <CouponForm couponId={couponId} initialData={initialData} />;
}
