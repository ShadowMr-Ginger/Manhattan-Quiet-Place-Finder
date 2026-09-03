const SPLIT_LEFT = '#2563eb'
const SPLIT_RIGHT = '#60a5fa'

/** Nav tile: blue square bg (CSS) + white disc + blue split square */
export function HushHubLogo({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.75" fill="#fff" />
      <path
        d="M7.5 8.5H11.05C11.88 8.5 12.55 9.17 12.55 10V14C12.55 14.83 11.88 15.5 11.05 15.5H7.5C6.67 15.5 6 14.83 6 14V10C6 9.17 6.67 8.5 7.5 8.5Z"
        fill={SPLIT_LEFT}
      />
      <path
        d="M12.45 8.5H16.5C17.33 8.5 18 9.17 18 10V14C18 14.83 17.33 15.5 16.5 15.5H12.45V8.5Z"
        fill={SPLIT_RIGHT}
      />
    </svg>
  )
}
