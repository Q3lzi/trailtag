// Minimal hand-drawn-style line icons matching the topographic aesthetic.
// Kept local (not from a generic icon pack) so the visual language stays specific to Trailtag.

export function IconQr({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <rect x="6" y="6" width="14" height="14" rx="1.5" />
      <rect x="28" y="6" width="14" height="14" rx="1.5" />
      <rect x="6" y="28" width="14" height="14" rx="1.5" />
      <rect x="10" y="10" width="6" height="6" fill="currentColor" stroke="none" />
      <rect x="32" y="10" width="6" height="6" fill="currentColor" stroke="none" />
      <rect x="10" y="32" width="6" height="6" fill="currentColor" stroke="none" />
      <path d="M28 28h6v6h-6zM40 28v6M28 40h6M36 36h6v6h-6z" />
    </svg>
  );
}

export function IconPin({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M24 44s14-13.5 14-23.5C38 11.5 31.7 5 24 5S10 11.5 10 20.5C10 30.5 24 44 24 44z" />
      <circle cx="24" cy="20" r="5.5" />
    </svg>
  );
}

export function IconPulse({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M5 24h8l4-12 8 22 4-14 3 4h11" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function IconShield({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <path d="M24 5l16 6v12c0 12-7 18.5-16 21-9-2.5-16-9-16-21V11l16-6z" strokeLinejoin="round" />
      <path d="M17 24l5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconUsers({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <circle cx="17" cy="16" r="6" />
      <circle cx="33" cy="18" r="5" />
      <path d="M6 41c0-7 5-12 11-12s11 5 11 12" strokeLinecap="round" />
      <path d="M27 32c5 0 9 4 9 9" strokeLinecap="round" />
    </svg>
  );
}

export function IconPhoneOff({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <rect x="13" y="5" width="22" height="38" rx="3" />
      <path d="M9 9l30 30" strokeLinecap="round" />
      <path d="M21 36h6" strokeLinecap="round" />
    </svg>
  );
}

export function IconClock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" strokeWidth="1.6" stroke="currentColor">
      <circle cx="24" cy="24" r="18" />
      <path d="M24 14v10l7 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArrowDown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth="2" stroke="currentColor">
      <path d="M12 4v16M5 13l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth="2.2" stroke="currentColor">
      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconApple({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.39-1.93 2.77-3.43 2.8-1.475.03-1.95-.86-3.63-.86-1.68 0-2.21.83-3.6.89-1.46.06-2.58-1.5-3.53-2.88-1.95-2.83-3.44-7.99-1.44-11.46.99-1.72 2.76-2.81 4.68-2.84 1.47-.03 2.85.99 3.63.99.78 0 2.42-1.22 4.08-1.04.7.03 2.66.28 4.03 2.13-.1.07-2.4 1.4-2.38 4.18.02 3.32 2.93 4.43 2.96 4.45-.03.07-.46 1.6-1.52 3.13l.66-2.63z"/>
    </svg>
  );
}

export function IconPlay({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3 20.5v-17c0-1.7 1.85-2.75 3.3-1.85l13 7.5c1.5.85 1.5 3.03 0 3.88l-13 7.5c-1.45.9-3.3-.15-3.3-1.85z"/>
    </svg>
  );
}
