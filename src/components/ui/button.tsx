import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#e5e5e5] text-[#0a0a0a] hover:bg-[#d4d4d4] active:bg-[#b0b0b0]",
  ghost: "text-[#e5e5e5] hover:bg-[#1a1a1a] active:bg-[#2a2a2a]",
  outline:
    "border border-[#3a3a3a] bg-transparent text-[#e5e5e5] hover:bg-[#1a1a1a] active:bg-[#2a2a2a]",
  danger:
    "bg-[#ff4d6d] text-[#ffffff] hover:opacity-80 active:opacity-60",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
