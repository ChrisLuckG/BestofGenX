"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import BackButton from "./BackButton";

// THE page header. Every section (Trivia, QuizzBattle, Rankroll ...) renders this,
// so switching between them never moves anything:
//   [back arrow][icon] Title / subtitle ........................ [right slot]
// - the back arrow (when there is one) starts exactly where the icon of a root page
//   starts, the icon always follows it, the title sits after the icon
// - the row has a fixed height, and the right slot is absolutely positioned, so a
//   button, a filter or a coin chip can never make the header taller or push the title
export default function PageHeader({
  icon: Icon, iconColor = "#E36B11", title, subtitle, onBack, right, sticky = false, className = "",
}: {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Buttons / chips / filters on the right */
  right?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div className={`px-4 pt-4 pb-3 border-b border-warm bg-cream ${sticky ? "sticky top-0 z-10" : ""} ${className}`}>
      <div className="relative flex items-center gap-3 h-8">
        {onBack && <BackButton onClick={onBack} className="-ml-1" />}
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: iconColor }} />
        <div className="min-w-0">
          <span className="font-display text-lg tracking-wider text-gray-900 block leading-none truncate">{title}</span>
          {subtitle && <span className="text-[10px] text-gray-500 -mt-0.5 block truncate">{subtitle}</span>}
        </div>
        {right && <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5">{right}</div>}
      </div>
    </div>
  );
}

// The ONLY button/chip sizes allowed in a page header: 36px high, same padding, same
// type. Each header used to size its own (py-1.5 here, py-3 there), so the button
// in the Rankroll header and the one in Trivia were different shapes.
const HEADER_CONTROL = "relative inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider transition-colors";

export function HeaderButton({
  icon: Icon, label, onClick, color = "#E36B11", active = false, disabled = false, loading = false, badge, neon = false, title,
}: {
  icon?: LucideIcon;
  label: string;
  onClick?: () => void;
  /** Hex colour of the button */
  color?: string;
  /** Filled = switched on / primary; otherwise tinted outline */
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Small red count in the corner (hidden at 0) */
  badge?: number;
  /** Arcade glow + wiggle, as on the Trivia page */
  neon?: boolean;
  title?: string;
}) {
  const off = disabled || loading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      title={title}
      style={{
        ...(off
          ? {}
          : active
            ? { backgroundColor: color, borderColor: color, color: "#fff" }
            : { backgroundColor: `${color}1A`, borderColor: `${color}55`, color }),
        ...(neon ? { ["--fx-glow" as string]: `${color}BF` } : {}),
      }}
      className={`${HEADER_CONTROL} border ${neon ? "fx-neon group" : ""} ${
        off ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" : "hover:brightness-95"
      } ${active && !off ? "shadow-sm" : ""}`}
    >
      {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${neon ? "fx-wiggle" : ""} ${loading ? "animate-pulse" : ""}`} />}
      <span>{label}</span>
      {!!badge && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow animate-pulse">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

/** Non-interactive pill with the same size as HeaderButton (e.g. the BOGX counter). */
export function HeaderChip({ children, color = "#E36B11" }: { children: ReactNode; color?: string }) {
  return (
    <div className={`${HEADER_CONTROL} text-white shadow-sm`} style={{ backgroundColor: color }}>
      {children}
    </div>
  );
}