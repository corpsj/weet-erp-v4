import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#ffffff] transition-colors outline-none",
          "placeholder:text-[#9a9a9a] placeholder:font-normal",
          "focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[#ff4d6d] focus:border-[#ff4d6d] focus:ring-1 focus:ring-[#ff4d6d]",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
