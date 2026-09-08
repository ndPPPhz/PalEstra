import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@/server/session';
import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await currentUser()) redirect('/home');
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">PalEstra</h1>
      <p className="mt-2 mb-8 text-muted">
        Le schede del tuo preparatore, senza fogli di calcolo.
      </p>
      <Suspense>
        <LoginForm next={next} />
      </Suspense>
    </main>
  );
}
