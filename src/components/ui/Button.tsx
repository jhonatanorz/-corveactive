import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center rounded-pill font-medium transition active:translate-y-px active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-royal text-ink-on-royal shadow-bold hover:bg-royal-deep",
  accent: "bg-lime text-ink hover:brightness-95",
  ghost: "border border-line-strong text-ink hover:bg-ink/5",
  soft: "bg-periwinkle-2 text-royal hover:bg-periwinkle",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "text-xs px-4 py-2",
  md: "text-sm px-5 py-3",
  lg: "text-base px-7 py-4",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: Props) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
