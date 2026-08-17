'use client';

import { ShieldCheck, MapPin, Lock, IndianRupee } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: <ShieldCheck size={15} />, text: 'Verified Professionals' },
  { icon: <Lock size={15} />,        text: 'Secure OTP Verification' },
  { icon: <MapPin size={15} />,      text: 'Live Tracking' },
  { icon: <IndianRupee size={15} />, text: 'Transparent Pricing' },
];

export default function TrustBar() {
  return (
    <div className="ww-trust-bar">
      <div className="ww-container">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 ww-stagger">
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="ww-trust-item ww-reveal">
              <span className="ww-trust-icon">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
