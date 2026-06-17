export const inputClass =
  "w-full rounded-sm border border-line bg-white p-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40";

export function Field({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="text-[12px] uppercase tracking-[0.18em] font-medium text-ink-2">{label}</div>
      )}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
