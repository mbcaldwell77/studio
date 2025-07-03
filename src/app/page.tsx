import { redirect } from 'next/navigation';

export default async function LoginPage() {
  // Since there is no longer a login page,
  // we redirect directly to the main collection view.
  redirect('/collection');
}
