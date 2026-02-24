import { HTMLAttributes, PropsWithChildren, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[rgb(42_42_42/50%)]">
      <table className={cn("min-w-full border-collapse", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[rgb(20_20_20/90%)]", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("bg-[rgb(20_20_20/70%)]", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-11 border-b border-[rgb(42_42_42/50%)] px-4 text-left text-xs font-semibold text-[var(--color-ink-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "h-11 border-b border-[rgb(42_42_42/45%)] px-4 text-sm text-[var(--color-ink)]",
        className,
      )}
      {...props}
    />
  );
}

export function TR({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableRowElement>>) {
  return <tr className={cn("hover:bg-[rgb(26_26_26/48%)]", className)} {...props} />;
}
