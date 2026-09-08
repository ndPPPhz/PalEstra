import Link from 'next/link';
import { requireUserPage } from '@/server/session';
import { listAthletes, listCoaches } from '@/core/relationships';
import { logoutAction } from '@/app/actions';

/**
 * One shell for both roles. Nobody is "a coach" or "an athlete" globally,
 * so the navigation is built from what the person actually has: coaching
 * links appear only once they follow someone.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage();
  const [athletes, coaches] = await Promise.all([listAthletes(user.id), listCoaches(user.id)]);

  const links = [
    { href: '/home', label: 'Home' },
    ...(athletes.length > 0 ? [{ href: '/atleti', label: 'Atleti' }] : []),
    { href: '/esercizi', label: 'Esercizi' },
    ...(coaches.length > 0 || athletes.length === 0 ? [] : []),
    { href: '/impostazioni', label: 'Impostazioni' },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
          <Link href="/home" className="mr-3 font-semibold tracking-tight">
            PalEstra
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction}>
            <button className="rounded-lg px-3 py-1.5 text-sm text-faint transition hover:text-ink">
              Esci
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-7">{children}</main>
    </div>
  );
}
