import LogoLoader from "@/components/LogoLoader";

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-cream flex flex-col items-center justify-center">
      <LogoLoader size="lg" text="Loading..." />
    </div>
  );
}
