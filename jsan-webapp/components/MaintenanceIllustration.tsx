export default function MaintenanceIllustration() {
  return (
    <svg
      viewBox="0 0 320 280"
      width="280"
      height="245"
      aria-hidden
      style={{ display: 'block', margin: '0 auto' }}
    >
      <defs>
        <pattern id="maintenance-grid" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#e2e8f0" strokeWidth="1" />
        </pattern>
      </defs>

      <g transform="translate(160 150) rotate(-12)">
        <rect x="-72" y="-58" width="144" height="116" fill="url(#maintenance-grid)" opacity="0.9" />
      </g>

      <g fill="none" stroke="#111827" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 118 198 L 202 198" />
        <path d="M 188 82 L 214 118 L 198 124 L 176 92 Z" />
        <path d="M 176 92 L 152 118 L 138 112 L 162 86 Z" />
        <circle cx="168" cy="78" r="11" />
        <path d="M 168 89 L 148 132 L 132 168 L 118 198" />
        <path d="M 148 132 L 176 132" />
        <path d="M 132 168 L 156 168" />
        <path d="M 214 118 L 248 118 L 252 198" />
        <path d="M 236 118 L 232 138" />
        <path d="M 248 150 L 258 150" />
        <path d="M 246 170 L 256 174" />
        <path d="M 244 186 L 254 190" />
      </g>
    </svg>
  );
}
