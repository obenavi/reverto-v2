import Link from 'next/link';

/** Small shared primitives. Everything here is a server component by default. */

export function Shell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={`mx-auto w-full max-w-app px-4 py-6 ${className}`}>{children}</main>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-[13px] font-semibold text-brand">
          ← {back.label}
        </Link>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
    </header>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-warning-light text-warning',
  active: 'bg-success-light text-success',
  confirmed: 'bg-success-light text-success',
  completed: 'bg-brand-light text-brand',
  held: 'bg-warning-light text-warning',
  captured: 'bg-success-light text-success',
  released: 'bg-brand-light text-brand',
  new: 'bg-brand-light text-brand',
  open: 'bg-warning-light text-warning',
  suspended: 'bg-danger-light text-danger',
  rejected: 'bg-danger-light text-danger',
  cancelled: 'bg-danger-light text-danger',
  failed: 'bg-danger-light text-danger',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${STATUS_STYLES[status] ?? 'bg-gray-100 text-ink-muted'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-4 py-10 text-center">
      <p className="font-semibold text-ink-muted">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success';
  children: React.ReactNode;
}) {
  const tones = {
    info: 'bg-brand-light text-brand',
    warn: 'bg-warning-light text-warning',
    error: 'bg-danger-light text-danger',
    success: 'bg-success-light text-success',
  };
  return (
    <div className={`rounded-btn px-3 py-2 text-[13px] font-medium ${tones[tone]}`}>
      {children}
    </div>
  );
}
