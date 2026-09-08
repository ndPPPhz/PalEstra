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
          <Link href="/home" className="shrink-0 font-semibold tracking-tight">
            PalEstra
          </Link>
          {/* Below sm the links live in the bottom bar instead: three of
              them plus the logo do not fit across a phone, and a thumb
              reaches the bottom of the screen far more easily anyway. */}
          <nav className="ml-3 hidden flex-1 items-center gap-1 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-muted transition hover:bg-surface hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="ml-auto shrink-0 sm:ml-0">
            <button className="rounded-lg px-3 py-1.5 text-sm text-faint transition hover:text-ink">
              Esci
            </button>
          </form>
        </div>
      </header>

      {/* Room for the bottom bar, plus the iPhone home indicator. */}
      <main className="mx-auto max-w-5xl px-4 py-7 pb-28 sm:pb-7">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="flex items-stretch justify-around">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex-1 px-2 py-3 text-center text-sm text-muted transition active:bg-surface"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
