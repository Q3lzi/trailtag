export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-forest-950/[0.07] shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-stone uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-forest-700/50" strokeWidth={1.8} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold text-forest-950 tabular-nums">{value}</span>
        {unit && <span className="text-sm text-stone">{unit}</span>}
      </div>
    </div>
  );
}
