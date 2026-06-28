export default function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-forest-950/15 bg-white/50 py-16 px-8 text-center">
      <Icon className="w-9 h-9 text-forest-950/20 mx-auto mb-4" strokeWidth={1.3} />
      <h3 className="font-display text-base font-semibold text-forest-950 mb-1.5">{title}</h3>
      <p className="text-sm text-stone max-w-xs mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
