"use client";

interface GenXLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function GenXLoader({ size = "md", className = "" }: GenXLoaderProps) {
  const sizeClasses = {
    sm: "h-8",
    md: "h-16",
    lg: "h-24",
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <img 
        src="/images/bogxtranscreamgroß.png" 
        alt="Loading..." 
        className={`${sizeClasses[size]} w-auto object-contain animate-pulse drop-shadow-[0_4px_20px_rgba(212,135,58,0.4)]`}
      />
      <div className="flex gap-1.5">
        <span className="w-2 h-2 bg-[#E36B11] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-[#E36B11] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-[#E36B11] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
