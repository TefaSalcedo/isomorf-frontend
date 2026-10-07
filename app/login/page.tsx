import { AuthForm } from '@/components/auth/auth-form';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={typeof next === 'string' ? next : undefined} />;
}
