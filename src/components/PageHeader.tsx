"use client";

import { isValidElement } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import BackButton from "./BackButton";

// Lucide icons and the app's own SVG components (Feed, Timeline) both fit this
export type IconType = ComponentType<{ className?: string }>;

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
  /** An icon component (sized and coloured here) or a ready element (used as is) */
  icon: IconType | ReactElement;
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
        <span className="flex-shrink-0 inline-flex" style={{ color: iconColor }}>{isValidElement(Icon) ? Icon : (() => { const C = Icon as IconType; return <C className="w-5 h-5" />; })()}</span>
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
  icon: Icon, label, onClick, color = "#E36B11", active = false, disabled = false, loading = false, badge, neon = true, iconOnly = false, title,
}: {
  icon?: IconType;
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
  /** Arcade glow on hover + wiggling icon (the Trivia "Open Battles" effect). On by default, so every header button feels alike. */
  neon?: boolean;
  /** Square icon-only button (narrow columns); the label becomes the tooltip and aria-label */
  iconOnly?: boolean;
  title?: string;
}) {
  const off = disabled || loading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={off}
      title={title ?? (iconOnly ? label : undefined)}
      aria-label={iconOnly ? label : undefined}
      style={{
        ...(off
          ? {}
          : active
            ? { backgroundColor: color, borderColor: color, color: "#fff" }
            : { backgroundColor: `${color}1A`, borderColor: `${color}55`, color }),
        ...(neon ? { ["--fx-glow" as string]: `${color}BF` } : {}),
      }}
      className={`${HEADER_CONTROL} ${iconOnly ? "!px-0 w-9" : ""} border ${neon ? "fx-neon group" : ""} ${
        off ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" : "hover:brightness-95"
      } ${active && !off ? "shadow-sm" : ""}`}
    >
      {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${neon ? "fx-wiggle" : ""} ${loading ? "animate-pulse" : ""}`} />}
      {!iconOnly && <span>{label}</span>}
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

/**
 * A dropdown that looks exactly like a HeaderButton (same 36px height, shape, type,
 * tint, hover glow). Idle = tinted outline, "active" (something other than the default
 * picked) = filled. Native <select> underneath, so it works with touch and keyboard.
 */
export function HeaderSelect({
  icon: Icon, value, onChange, options, active = false, color = "#E36B11", label, className = "",
}: {
  icon?: IconType;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  /** Filled look, e.g. when a filter is set */
  active?: boolean;
  color?: string;
  /** Accessible name */
  label: string;
  className?: string;
}) {
  const fg = active ? "#fff" : color;
  return (
    <div
      className={`group fx-neon relative inline-flex items-center h-9 rounded-lg ${className}`}
      style={{ ["--fx-glow" as string]: `${color}BF` }}
    >
      {Icon && <span className="pointer-events-none absolute left-3 inline-flex fx-wiggle" style={{ color: fg }}><Icon className="w-3.5 h-3.5" /></span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        style={active
          ? { backgroundColor: color, borderColor: color, color: "#fff" }
          : { backgroundColor: `${color}1A`, borderColor: `${color}55`, color }}
        className={`appearance-none cursor-pointer h-9 w-full ${Icon ? "pl-8" : "pl-3.5"} pr-8 rounded-lg border text-[11px] font-semibold uppercase tracking-wider truncate transition-colors hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#E36B11]/50 ${active ? "shadow-sm" : ""}`}
      >
        {options.map(o => <option key={o.value} value={o.value} className="bg-white text-gray-900 normal-case tracking-normal font-normal">{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2.5 w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}