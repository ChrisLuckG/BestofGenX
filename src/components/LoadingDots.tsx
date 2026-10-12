/** Three dots blinking in sequence - loading placeholder for numbers (scoreboard). Colour via text-* class. */
export default function LoadingDots({ className = 'text-[#E36B11]' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] align-middle ${className}`} aria-label="Loading">
      {[0, 1, 2].map(i => (
        <span key={i} className="loading-dot w-[5px] h-[5px] rounded-full bg-current" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
