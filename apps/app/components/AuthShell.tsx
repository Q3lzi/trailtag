import Link from "next/link";
import ContourBackdrop from "./ContourBackdrop";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-forest-950 relative overflow-hidden flex items-center justify-center px-6">
      <div className="absolute inset-0 text-white/80">
        <ContourBackdrop className="w-full h-full opacity-40" />
      </div>
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-[0.12] pointer-events-none"
        style={{ background: "radial-gradient(circle, #4a8f6f, transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="https://trailtag.ch" className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-white">
            Trailtag
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-2xl shadow-black/30">{children}</div>
      </div>
    </div>
  );
}
