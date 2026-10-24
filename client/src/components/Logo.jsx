import React from 'react';

export default function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 ${className}`}
    >
      <rect width="120" height="120" rx="30" fill="#09090b" />
      {/* Sleek Minimalist Wallet / Card Geometry */}
      <rect x="26" y="38" width="68" height="48" rx="10" stroke="#ffffff" strokeWidth="6" />
      <path d="M26 52H94" stroke="#ffffff" strokeWidth="5" />
      <rect x="64" y="62" width="18" height="12" rx="4" fill="#ffffff" />
      <circle cx="40" cy="68" r="4" fill="#a1a1aa" />
    </svg>
  );
}
