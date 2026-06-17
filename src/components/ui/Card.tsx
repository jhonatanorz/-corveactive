import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-white rounded-lg shadow-1 ${className}`} {...props} />;
}
