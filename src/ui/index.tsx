import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-medium transition ' +
  'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

const variants = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line hover:border-faint',
  ghost: 'text-muted hover:text-ink hover:bg-surface',
  danger: 'text-warn border border-line hover:bg-warn-soft',
} as const;

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof variants }) {
  return <button {...props} className={cn(buttonBase, variants[variant], className)} />;
}

export function LinkButton({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return <Link {...props} className={cn(buttonBase, variants[variant], className)} />;
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('rounded-[var(--radius-card)] border border-line bg-surface', className)}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-faint',
        'focus:border-accent focus:outline-none',
        className,
      )}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-faint',
        'focus:border-accent focus:outline-none',
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}

const badgeTones = {
  neutral: 'bg-bg text-muted border-line',
  accent: 'bg-accent-soft text-accent-ink border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        badgeTones[tone],
        className,
      )}
    />
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="mt-1.5 text-sm text-muted">{children}</div> : null}
    </Card>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {action}
    </div>
  );
}

/** "18 ore fa" — the sheet cannot tell you this, which is half the point. */
export function timeAgo(value: Date | string | null): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'adesso';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? 'mese' : 'mesi'} fa`;
}
