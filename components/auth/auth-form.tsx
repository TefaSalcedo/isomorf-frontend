'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'login') {
        await login(String(data.email), String(data.password));
      } else {
        await register({
          email: String(data.email),
          password: String(data.password),
          first_name: String(data.first_name),
          last_name: String(data.last_name),
        });
      }
      router.replace('/dashboard');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to authenticate');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-white via-slate-50 to-cyan-50 px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-white/60 bg-white/70 p-8 shadow-2xl backdrop-blur-xl"
      >
        <p className="font-mono text-xs uppercase tracking-[.3em] text-cyan-600">ISOMORF</p>
        <h1 className="mt-5 text-3xl font-semibold text-slate-900">
          {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {mode === 'login'
            ? 'Sign in to continue to your projects.'
            : 'Start designing your structural workspace.'}
        </p>
        {mode === 'register' && (
          <div className="mt-7 grid grid-cols-2 gap-3">
            <input
              required
              name="first_name"
              placeholder="First name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
            />
            <input
              required
              name="last_name"
              placeholder="Last name"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
            />
          </div>
        )}
        <input
          required
          type="email"
          name="email"
          placeholder="Email"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
        />
        <input
          required
          minLength={8}
          type="password"
          name="password"
          placeholder="Password"
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
        />
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="mt-6 w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending
            ? 'Processing...'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
        </button>
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === 'login' ? 'Need an account?' : 'Already registered?'}{' '}
          <Link className="text-cyan-600 hover:text-cyan-500" href={mode === 'login' ? '/register' : '/login'}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </Link>
        </p>
      </form>
    </main>
  );
}
