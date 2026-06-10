"use client";

// Skeleton loaders for Desktop pages - shimmer effect instead of logo spinner

// Feed/Article list skeleton
export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-cream border border-warm rounded-xl p-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-lg bg-skeleton-light flex-shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-skeleton-light" />
              <div className="h-3 w-1/2 rounded bg-skeleton-light" />
              <div className="h-3 w-1/4 rounded bg-skeleton-light" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Rankings list skeleton
export function RankingsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-cream border border-warm rounded-xl animate-pulse">
          <div className="w-6 h-6 rounded bg-skeleton-light" />
          <div className="w-10 h-10 rounded-full bg-skeleton-light" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 rounded bg-skeleton-light" />
            <div className="h-3 w-20 rounded bg-skeleton-light" />
          </div>
          <div className="h-5 w-16 rounded bg-skeleton-light" />
        </div>
      ))}
    </div>
  );
}

// Rewards/Shop grid skeleton
export function RewardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-cream border border-warm rounded-xl p-4 animate-pulse">
          <div className="w-full h-24 rounded-lg bg-skeleton-light mb-3 relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
          </div>
          <div className="h-4 w-3/4 rounded bg-skeleton-light mb-2" />
          <div className="h-3 w-1/2 rounded bg-skeleton-light" />
        </div>
      ))}
    </div>
  );
}

// Rankroll/Polls skeleton
export function PollsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-cream border border-warm rounded-xl overflow-hidden animate-pulse">
          <div className="h-44 bg-skeleton-light relative overflow-hidden">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
          </div>
          <div className="p-4 space-y-2">
            <div className="h-5 w-3/4 rounded bg-skeleton-light" />
            <div className="h-3 w-1/2 rounded bg-skeleton-light" />
            <div className="flex gap-2 mt-3">
              <div className="h-8 flex-1 rounded-lg bg-skeleton-light" />
              <div className="h-8 flex-1 rounded-lg bg-skeleton-light" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Generic card skeleton
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-cream border border-warm rounded-xl p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-skeleton-light relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-skeleton-light" />
              <div className="h-3 w-1/3 rounded bg-skeleton-light" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// TV Page skeleton
export function TVSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-6 h-6 rounded bg-skeleton-light" />
        <div className="h-6 w-32 rounded bg-skeleton-light" />
      </div>
      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-cream border border-warm rounded-xl overflow-hidden animate-pulse">
            <div className="aspect-video bg-skeleton-light relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
            </div>
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 rounded bg-skeleton-light" />
              <div className="h-3 w-1/2 rounded bg-skeleton-light" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Radio Page skeleton
export function RadioSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header with Equalizer placeholder */}
      <div className="text-center space-y-3 animate-pulse">
        <div className="h-8 w-48 mx-auto rounded bg-skeleton-light" />
        <div className="h-4 w-32 mx-auto rounded bg-skeleton-light" />
        <div className="h-3 w-40 mx-auto rounded bg-skeleton-light" />
        {/* Equalizer placeholder */}
        <div className="flex items-end justify-between h-12 gap-1 mt-4">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="flex-1 bg-skeleton-light rounded-t-sm" style={{ height: `${30 + Math.random() * 70}%` }} />
          ))}
        </div>
      </div>
      {/* Station Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-cream border border-warm rounded-xl animate-pulse">
            <div className="w-12 h-12 rounded-full bg-skeleton-light relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-skeleton-light" />
              <div className="h-3 w-1/2 rounded bg-skeleton-light" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// News/Notifications skeleton
export function NewsSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between animate-pulse mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-skeleton-light" />
          <div className="h-5 w-24 rounded bg-skeleton-light" />
        </div>
        <div className="w-8 h-8 rounded-lg bg-skeleton-light" />
      </div>
      {/* Notification items */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 bg-cream border border-warm rounded-xl animate-pulse">
          <div className="w-10 h-10 rounded-full bg-skeleton-light relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-skeleton-light" />
            <div className="h-3 w-full rounded bg-skeleton-light" />
            <div className="h-3 w-1/4 rounded bg-skeleton-light" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Profile skeleton
export function ProfileSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 animate-pulse">
        <div className="w-20 h-20 rounded-full bg-skeleton-light relative overflow-hidden">
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-6 w-40 rounded bg-skeleton-light" />
          <div className="h-4 w-24 rounded bg-skeleton-light" />
        </div>
      </div>
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-cream border border-warm rounded-xl p-4 text-center animate-pulse">
            <div className="h-8 w-16 mx-auto rounded bg-skeleton-light mb-2" />
            <div className="h-3 w-12 mx-auto rounded bg-skeleton-light" />
          </div>
        ))}
      </div>
      {/* Menu Items */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-cream border border-warm rounded-xl animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-skeleton-light" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-skeleton-light" />
              <div className="h-3 w-48 rounded bg-skeleton-light" />
            </div>
            <div className="w-5 h-5 rounded bg-skeleton-light" />
          </div>
        ))}
      </div>
    </div>
  );
}
