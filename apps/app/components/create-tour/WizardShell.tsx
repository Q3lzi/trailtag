"use client";

import { Check } from "lucide-react";

const STEPS = ["Tour-Art", "Zeit & Fahrzeug", "Notfall & Begleitung", "Route", "Details", "Übersicht"];

export default function WizardShell({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center mb-10">
        {STEPS.map((label, i) => {
          const isDone = i < step;
          const isCurrent = i === step;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone
                      ? "bg-forest-700 text-white"
                      : isCurrent
                      ? "bg-forest-950 text-white"
                      : "bg-forest-950/[0.06] text-stone"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${isCurrent ? "text-forest-950" : "text-stone"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 -mt-4 ${isDone ? "bg-forest-700" : "bg-forest-950/[0.08]"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="animate-rise">{children}</div>
    </div>
  );
}
