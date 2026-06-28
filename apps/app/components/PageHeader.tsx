export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-9">
      <div>
        <h1 className="font-display text-[1.65rem] font-semibold text-forest-950 tracking-tight">{title}</h1>
        {subtitle && <p className="text-stone mt-1.5 text-[15px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
