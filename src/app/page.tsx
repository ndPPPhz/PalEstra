import { redirect } from 'next/navigation';
import { currentUser } from '@/server/session';

export default async function Root() {
  redirect((await currentUser()) ? '/home' : '/login');
}
