import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-[#2a2a2a] bg-[#141414] p-5",
        className,
      )}
      {...props}
    />
  );
}
