import Link from "next/link";

type PageHeaderProps = {
  title: string;
  description: string;
  breadcrumb: Array<{ label: string; href?: string }>;
};

export function PageHeader({ title, description, breadcrumb }: PageHeaderProps) {
  return (
    <header className="mb-6">
      <nav className="mb-2 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
        {breadcrumb.map((item, index) => (
          <div className="flex items-center gap-2" key={`${item.label}-${index}`}>
            {item.href ? (
              <Link href={item.href} className="hover:text-[var(--color-brand)]">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
            {index < breadcrumb.length - 1 && <span>/</span>}
          </div>
        ))}
      </nav>
      <h1 className="display-font text-3xl font-semibold tracking-wide text-[var(--color-ink)]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{description}</p>
    </header>
  );
}
