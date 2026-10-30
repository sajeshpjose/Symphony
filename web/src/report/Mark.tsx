// The yello mark: a square with a rounded bottom-left corner and a four-point star cut out
// (same paths as design/yello-mark.svg). The star shows whatever is behind it.
export function Mark({ size, color = '#222222', className }: { size: number | string; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true">
      <path
        fill={color}
        fillRule="evenodd"
        d="M0 0H100V100H50A50 50 0 0 1 0 50Z M50 0A50 50 0 0 0 100 50A50 50 0 0 0 50 100A50 50 0 0 0 0 50A50 50 0 0 0 50 0Z"
      />
    </svg>
  )
}
