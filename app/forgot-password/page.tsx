'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Info, KeyRound, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#faf8fd] px-5 py-5 text-slate-900 sm:px-8">
      <header className="mx-auto flex max-w-[1360px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-lg font-bold text-white shadow-lg shadow-violet-500/25">S</span>
          <span><strong className="block text-lg tracking-tight text-slate-950">Isomorf</strong><small className="block text-[10px] font-bold uppercase tracking-[.16em] text-violet-600">AEC Cloud</small></span>
        </Link>
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-violet-700"><ArrowLeft className="h-4 w-4" />Back to sign in</Link>
      </header>
      <section className="mx-auto mt-14 max-w-md rounded-3xl border border-violet-100 bg-white p-8 shadow-[0_18px_60px_rgba(76,29,149,.10)] sm:p-10">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100"><KeyRound className="h-7 w-7" /></div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Forgot your password?</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Enter the work email associated with your Isomorf account. Password recovery email delivery is coming soon while we finalize a secure free or semi-free provider.</p>
        <form className="mt-8 space-y-4" onSubmit={(event) => event.preventDefault()}>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-600" htmlFor="recovery-email">Corporate email</label>
          <div className="relative"><Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="recovery-email" type="email" required placeholder="name@company.com" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10" /></div>
          <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-500/25 opacity-80">Recovery email coming soon <ArrowRight className="h-4 w-4" /></button>
        </form>
        <div className="mt-7 flex gap-3 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-xs leading-5 text-slate-600"><Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" /><span>When enabled, recovery links will expire automatically and will never reveal whether an email is registered.</span></div>
        <p className="mt-7 text-center text-sm text-slate-500">Need an account? <Link className="font-bold text-violet-600" href="/register">Create one free</Link></p>
      </section>
      <footer className="mx-auto mt-20 flex max-w-[1360px] justify-between text-xs text-slate-400"><span>Isomorf Platform © 2026</span><span>Security · Help</span></footer>
    </main>
  );
}
