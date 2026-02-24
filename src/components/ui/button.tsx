import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#e5e5e5] text-[#0a0a0a] hover:bg-[#d4d4d4]",
  ghost: "text-[var(--color-ink)] hover:bg-[rgb(42_42_42/65%)]",
  outline:
    "border border-[var(--color-line-2)] bg-transparent text-[var(--color-ink)] hover:bg-[rgb(26_26_26/65%)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:bg-[rgb(255_90_120)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
