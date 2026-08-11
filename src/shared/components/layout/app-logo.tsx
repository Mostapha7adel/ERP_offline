import { useId } from "react";
import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bg = `bg-${uid}`;
  const glow = `glow-${uid}`;
  const barGold = `bar-gold-${uid}`;
  const barDark = `bar-dark-${uid}`;
  const lineG = `line-${uid}`;
  return (
    <svg
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="LedgerFlow"
      className={cn("size-8 shrink-0", className)}
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3466" />
          <stop offset="45%" stopColor="#0e1a38" />
          <stop offset="100%" stopColor="#070e20" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.4" r="0.75">
          <stop offset="0%" stopColor="#5a7fd6" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#5a7fd6" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#5a7fd6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={barGold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff2c8" />
          <stop offset="30%" stopColor="#f6cf6a" />
          <stop offset="75%" stopColor="#e0a43a" />
          <stop offset="100%" stopColor="#b2760e" />
        </linearGradient>
        <linearGradient id={barDark} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6b4205" />
          <stop offset="100%" stopColor="#4a2c03" />
        </linearGradient>
        <linearGradient id={lineG} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f6cf6a" />
          <stop offset="50%" stopColor="#ffdf8a" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      <rect width="1024" height="1024" rx="228" fill={`url(#${bg})`} />
      <rect width="1024" height="1024" rx="228" fill={`url(#${glow})`} />
      <rect
        x="22"
        y="22"
        width="980"
        height="980"
        rx="210"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.07"
        strokeWidth="5"
      />

      {/* bars 3D edge (dark bottom) */}
      <g fill={`url(#${barDark})`}>
        <rect x="316" y="632" width="92" height="140" rx="20" />
        <rect x="416" y="562" width="92" height="210" rx="20" />
        <rect x="516" y="472" width="92" height="300" rx="20" />
        <rect x="616" y="372" width="92" height="400" rx="20" />
      </g>

      {/* bars main gold */}
      <g fill={`url(#${barGold})`}>
        <rect x="316" y="610" width="92" height="150" rx="20" />
        <rect x="416" y="540" width="92" height="220" rx="20" />
        <rect x="516" y="450" width="92" height="310" rx="20" />
        <rect x="616" y="350" width="92" height="410" rx="20" />
      </g>

      {/* bar top highlights */}
      <g fill="#ffffff" opacity="0.5">
        <rect x="316" y="610" width="92" height="9" rx="5" />
        <rect x="416" y="540" width="92" height="9" rx="5" />
        <rect x="516" y="450" width="92" height="9" rx="5" />
        <rect x="616" y="350" width="92" height="9" rx="5" />
      </g>

      {/* left edge shade for 3D */}
      <g fill="#000000" opacity="0.14">
        <rect x="316" y="610" width="16" height="150" rx="8" />
        <rect x="416" y="540" width="16" height="220" rx="8" />
        <rect x="516" y="450" width="16" height="310" rx="8" />
        <rect x="616" y="350" width="16" height="410" rx="8" />
      </g>

      {/* base line */}
      <rect x="312" y="762" width="400" height="14" rx="7" fill={`url(#${barDark})`} />
      <rect x="312" y="760" width="400" height="9" rx="5" fill="#f6cf6a" opacity="0.7" />

      {/* rising trend line over the bars */}
      <path
        d="M362 604 L462 534 L562 444 L662 344"
        fill="none"
        stroke={`url(#${lineG})`}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M362 604 L462 534 L562 444 L662 344"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="662" cy="344" r="16" fill="#ffffff" />
      <circle cx="662" cy="344" r="8" fill="#f6cf6a" />
    </svg>
  );
}
