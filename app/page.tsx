import Link from 'next/link';

export default function Home() {
  return <main className="grid-bg flex min-h-screen flex-col items-center justify-center px-6 text-center"><div className="max-w-3xl"><p className="mb-5 font-mono text-sm uppercase tracking-[.35em] text-cyan-400">Structural integration workspace</p><h1 className="text-6xl font-semibold tracking-tight text-white md:text-8xl">ISOMORF</h1><p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-400">A technical environment for turning structural concepts into precise, editable geometry.</p><div className="mt-10 flex justify-center gap-4"><Link className="rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300" href="/register">Create workspace</Link><Link className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-200 transition hover:border-cyan-400" href="/login">Sign in</Link></div></div></main>;
}
