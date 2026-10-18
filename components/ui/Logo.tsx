import React from 'react';

/**
 * The Cato monogram — bracketed CL with pixel accents.
 * Recreated as crisp inline SVG so it scales from favicon to hero.
 */
export default function Logo({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* bracket frame — top-left & bottom-right corners */}
      <path
        d="M4 22 V4 h18"
        stroke="#0a0c12"
        strokeWidth="4.2"
        strokeLinecap="square"
      />
      <path
        d="M60 42 V60 H42"
        stroke="#0a0c12"
        strokeWidth="4.2"
        strokeLinecap="square"
      />
      {/* pixel accents */}
      <rect x="46" y="4" width="4.6" height="4.6" fill="#2e4bff" />
      <rect x="54" y="12" width="3.4" height="3.4" fill="#0a0c12" />
      {/* C */}
      <path
        d="M35.5 24.5 A9.5 9.5 0 1 0 35.5 39.5"
        stroke="#0a0c12"
        strokeWidth="5"
        strokeLinecap="square"
        fill="none"
      />
      {/* L */}
      <path
        d="M42 24 V40 h11"
        stroke="#0a0c12"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}
