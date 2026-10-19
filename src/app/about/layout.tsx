import type { Metadata } from "next";

// An info page: indexable (the root layout says noindex for the app screens)
export const metadata: Metadata = {
  title: "About Best of GenX | Best of GenX",
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
