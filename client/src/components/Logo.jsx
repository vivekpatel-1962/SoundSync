import React from 'react';

export default function Logo({ className }) {
  // Simple headphones + waveform mark, uses currentColor so you can control with text-* classes
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      className={className}
    >
      {/* Headband */}
      <path
        d="M8 36a24 24 0 0 1 48 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Earcups */}
      <rect x="6" y="36" width="12" height="18" rx="6" fill="currentColor" />
      <rect x="46" y="36" width="12" height="18" rx="6" fill="currentColor" />
      {/* Waveform */}
      <polyline
        points="18,46 24,42 28,50 32,34 36,48 40,44 46,44"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
