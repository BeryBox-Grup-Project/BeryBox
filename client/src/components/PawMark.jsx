export function PawMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      fill="currentColor"
      aria-hidden="true"
    >
      <ellipse cx="58" cy="58" rx="22" ry="28" transform="rotate(-18 58 58)" />
      <ellipse cx="100" cy="38" rx="24" ry="30" />
      <ellipse cx="142" cy="58" rx="22" ry="28" transform="rotate(18 142 58)" />
      <ellipse cx="168" cy="96" rx="18" ry="24" transform="rotate(38 168 96)" />
      <path d="M42 118c8-28 38-44 62-40 28 4 52 28 58 52 6 26-8 52-34 62-18 7-40 4-56-8-22-16-38-40-30-66z" />
    </svg>
  );
}
