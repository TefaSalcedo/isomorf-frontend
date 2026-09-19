'use client';

import Link from 'next/link';
import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Eye, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg shadow-violet-500/25">
        <span className="text-lg font-bold">S</span>
      </span>
      <span>
        <span className="block text-lg font-bold tracking-tight text-slate-950">Isomorf</span>
        <span className="block text-[10px] font-bold uppercase tracking-[.16em] text-violet-600">AEC Cloud</span>
      </span>
    </Link>
  );
}

function Showcase() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950 p-10 text-white lg:col-span-5 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-violet-100 ring-1 ring-white/15">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Connected BIM ecosystem
        </span>
        <h2 className="mt-6 max-w-md text-3xl font-bold leading-tight tracking-tight">
          Design, calculate and deliver in one intuitive workspace.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-violet-100/75">
          Move from structural geometry to technical documentation without the friction of heavy CAD software.
        </p>
      </div>
      <div className="relative my-8 grid min-h-64 place-items-center overflow-hidden rounded-2xl border border-white/15 bg-[#17142b] shadow-2xl">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(167,139,250,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,.35) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative h-48 w-40 rotate-[-8deg] rounded-t-[40%] border-4 border-violet-300/70 bg-gradient-to-br from-slate-100/70 to-violet-300/20 shadow-[0_0_50px_rgba(139,92,246,.3)]">
          <div className="absolute inset-x-5 top-8 space-y-5 border-y border-violet-200/70 py-4">
            <div className="h-1 bg-violet-200/80" /><div className="h-1 bg-violet-200/70" /><div className="h-1 bg-violet-200/60" />
          </div>
          <div className="absolute -left-9 top-10 rounded-xl border border-violet-400/40 bg-slate-950/80 px-3 py-2 text-[10px] shadow-xl">
            <strong className="block text-violet-200">Beam B-12</strong><span className="text-slate-400">D/C 0.74</span>
          </div>
          <div className="absolute -right-14 bottom-8 rounded-xl border border-emerald-400/30 bg-slate-950/85 px-3 py-2 text-[10px] shadow-xl">
            <strong className="block text-emerald-300">FEM analysis</strong><span className="text-slate-400">Within tolerance</span>
          </div>
        </div>
      </div>
      <div className="relative flex items-center justify-between border-t border-white/10 pt-5 text-xs text-violet-100/70">
        <span>Precision tools for structural teams</span><span className="font-semibold text-amber-300">★★★★★</span>
      </div>
    </div>
  );
}

function SsoButton({ children }: { children: React.ReactNode }) {
  return <button type="button" disabled className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500 opacity-80 transition hover:border-violet-300"><span className="text-violet-600">✦</span>{children}<span className="text-[10px] font-medium text-slate-400">Soon</span></button>;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const submittingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(''); setPending(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'login') await login(String(data.email), String(data.password));
      else await register({ email: String(data.email), password: String(data.password), first_name: String(data.first_name), last_name: String(data.last_name) });
      router.replace('/dashboard');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to authenticate');
    } finally { submittingRef.current = false; setPending(false); }
  }

  return (
    <main className="min-h-screen bg-[#faf8fd] px-4 py-5 text-slate-900 sm:px-8 lg:px-10">
      <header className="mx-auto flex max-w-[1360px] items-center justify-between">
        <Brand />
        <p className="text-sm text-slate-500">{mode === 'login' ? 'Need an account?' : 'Already registered?'} <Link className="font-semibold text-violet-600 hover:text-violet-800" href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create account' : 'Sign in'}</Link></p>
      </header>
      <section className="mx-auto my-10 grid max-w-[1360px] overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_18px_60px_rgba(76,29,149,.10)] lg:grid-cols-12">
        <div className="px-7 py-10 sm:px-12 lg:col-span-7 lg:px-14 lg:py-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700"><span className="h-2 w-2 rounded-full bg-emerald-400" />{mode === 'login' ? 'Cloud FEM v2026.4 connected' : 'Free trial for 14 days · No credit card'}</span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{mode === 'login' ? 'Welcome to Isomorf' : 'Create your professional account'}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{mode === 'login' ? 'Sign in to manage structural models, FEM analysis and technical plans.' : 'Join structural engineers and BIM teams designing in the cloud.'}</p>
          <div className="mt-8 flex gap-3"><SsoButton>Continue with Google</SsoButton><SsoButton>Microsoft / Autodesk</SsoButton></div>
          <div className="my-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />Or use your work email<span className="h-px flex-1 bg-slate-200" /></div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && <div className="grid gap-4 sm:grid-cols-2"><Field name="first_name" label="First name" placeholder="Thomas" /><Field name="last_name" label="Last name" placeholder="Sanchez" /></div>}
            <Field name="email" label={mode === 'login' ? 'Corporate email / license' : 'Work email'} placeholder="name@company.com" type="email" icon={Mail} />
            <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold uppercase tracking-wide text-slate-600" htmlFor="password">Password</label>{mode === 'login' && <Link className="text-xs font-semibold text-violet-600" href="/forgot-password">Forgot password?</Link>}</div><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="password" required minLength={8} type="password" name="password" placeholder="At least 8 characters" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10" /><Eye className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div></div>
            {mode === 'register' && <div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><input type="checkbox" required className="mt-1 accent-violet-600" />I accept the <a className="font-semibold text-violet-600" href="#terms">Terms and Privacy Policy</a>.</div>}
            {mode === 'login' && <div className="flex items-center justify-between text-xs text-slate-500"><label className="flex items-center gap-2"><input type="checkbox" className="accent-violet-600" />Keep me signed in</label><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700"><ShieldCheck className="h-3 w-3" /> Secure session</span></div>}
            {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
            <button disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-purple-700 disabled:opacity-50">{pending ? 'Processing…' : mode === 'login' ? 'Enter workspace' : 'Create account and start free'}<ArrowRight className="h-4 w-4" /></button>
          </form>
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" />TLS 1.3 encrypted</span><span>Support center</span></div>
        </div>
        <Showcase />
      </section>
      <footer className="mx-auto flex max-w-[1360px] justify-between text-xs text-slate-400"><span>© 2026 Isomorf Technologies Inc.</span><span>Terms · Privacy · System status</span></footer>
    </main>
  );
}

function Field({ name, label, placeholder, type = 'text', icon: Icon }: { name: string; label: string; placeholder: string; type?: string; icon?: typeof Mail }) {
  return <div><label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600" htmlFor={name}>{label}</label><div className="relative">{Icon && <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}<input id={name} required name={name} type={type} placeholder={placeholder} className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50 ${Icon ? 'pl-11' : 'px-4'} text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10`} /></div></div>;
}
