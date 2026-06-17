import type { HTMLAttributes } from "react";

export function Eyebrow({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[12px] uppercase tracking-[0.18em] font-medium text-ink-2 ${className}`}
      {...props}
    />
  );
}
