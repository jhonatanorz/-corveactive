type Fill = "periwinkle" | "periwinkle-2" | "lime" | "royal";

export function Blob({
  fill = "periwinkle",
  className = "",
  style,
}: {
  fill?: Fill;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`blob ${className}`}
      style={{ background: `var(--${fill})`, ...style }}
    />
  );
}
