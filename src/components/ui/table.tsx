import { HTMLAttributes, PropsWithChildren, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#2a2a2a] bg-[#0a0a0a]">
      <table className={cn("min-w-full border-collapse", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[#1a1a1a] border-b border-[#2a2a2a]", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("bg-[#0a0a0a]", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left text-xs font-medium text-[#9a9a9a]",
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
        "h-11 border-b border-[#2a2a2a] px-4 text-sm text-[#ffffff]",
        className,
      )}
      {...props}
    />
  );
}

export function TR({ className, ...props }: PropsWithChildren<HTMLAttributes<HTMLTableRowElement>>) {
  return <tr className={cn("transition-colors hover:bg-[#1a1a1a]", className)} {...props} />;
}

export function TableEmpty({ colSpan = 1, className }: { colSpan?: number; className?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("h-32 text-center text-sm text-[#9a9a9a]", className)}>
        데이터 없음
      </td>
    </tr>
  );
}
