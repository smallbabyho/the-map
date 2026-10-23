// 가벼운 선 아이콘 모음 (외부 아이콘 라이브러리 없이)
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
)
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
)
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>
)
export const GripIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" />
  </Svg>
)
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)
export const MinusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
)
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>
)
export const MapIcon = (p: IconProps) => (
  <Svg {...p}><path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></Svg>
)
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
)
export const FitIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /></Svg>
)
export const ImageIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 9" /></Svg>
)
export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Svg>
)
export const LockIcon = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
)
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 12 5 5 9-10" /></Svg>
)
export const PaletteIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.7C22 5.9 17.5 3 12 3z" /><circle cx="7.5" cy="11.5" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15.5" cy="7.5" r="1" /></Svg>
)
export const PinIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>
)
export const LocateIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3.5" /><circle cx="12" cy="12" r="7.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" /></Svg>
)
