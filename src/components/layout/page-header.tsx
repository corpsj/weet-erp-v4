import Link from "next/link";
import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  actionButtons?: ReactNode;
};

export function PageHeader({ title, description, breadcrumb, actionButtons }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-2 flex items-center gap-2 text-xs text-[#9a9a9a]">
            {breadcrumb.map((item, index) => (
              <div className="flex items-center gap-2" key={`${item.label}-${index}`}>
                {item.href ? (
                  <Link href={item.href} className="transition-colors hover:text-[#ffffff]">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-[#ffffff]">{item.label}</span>
                )}
                {index < breadcrumb.length - 1 && <span className="text-[#3a3a3a]">/</span>}
              </div>
            ))}
          </nav>
        )}
        <h1 className="display-font text-xl font-semibold tracking-tight text-[#ffffff]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-[#9a9a9a]">{description}</p>}
      </div>
      {actionButtons && (
        <div className="flex shrink-0 items-center gap-2">
          {actionButtons}
        </div>
      )}
    </header>
  );
}
