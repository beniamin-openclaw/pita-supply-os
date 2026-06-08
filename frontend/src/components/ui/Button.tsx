import { type ButtonHTMLAttributes, type ReactElement } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "success";
type ButtonSize = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover active:bg-brand-active",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-danger text-white hover:bg-red-800",
  success: "bg-success text-white hover:bg-green-800",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-5 py-3 text-sm", // ≥44px tap target (mobile-first)
  sm: "px-3 py-2 text-xs",
};

/**
 * Token-driven button — the first shared UI primitive, built on the Phase 1
 * @theme tokens (brand / danger / success). Input/Badge/Card/Banner are deferred
 * to the first spin-off that needs them (plan-review F4).
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
      {...rest}
    />
  );
}
