'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Building2, Calculator, FileCheck, Play, Users } from 'lucide-react';

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const blockRef = useRef<SVGGElement>(null);
  const cableRef = useRef<SVGLineElement>(null);
  const trucksRef = useRef<SVGGElement>(null);
  const buildingRef = useRef<SVGGElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });

      tl.fromTo(
        blockRef.current,
        { y: 0 },
        { y: 40, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' },
        0
      );

      tl.fromTo(
        cableRef.current,
        { attr: { y2: 650 } },
        { attr: { y2: 690 }, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' },
        0
      );

      tl.fromTo(
        trucksRef.current,
        { x: 1040 },
        { x: -10, duration: 1, ease: 'none' },
        0
      );
    },
    { scope: heroRef }
  );

  useGSAP(
    () => {
      gsap.fromTo(
        '.building-line',
        { strokeDashoffset: 100 },
        {
          strokeDashoffset: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power2.out',
          delay: 0.3,
        }
      );
    },
    { scope: buildingRef }
  );

  return (
    <div className="bg-white text-slate-900">
      <main
        ref={heroRef}
        className="grid-bg-light relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center"
      >
        <svg
          className="absolute inset-0 z-0 h-full w-full opacity-75"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dump trucks: start off-screen left and drive into view, scaled up */}
          <g transform="translate(-520, 760)">
            <g ref={trucksRef} data-testid="dump-trucks">
              <g transform="scale(1.2)">
                <g className="stroke-slate-600" transform="translate(0, 0)">
                  <rect x="0" y="-30" width="90" height="40" className="fill-slate-300/70" rx="3" strokeWidth="2" />
                  <path d="M0 -30 L30 -55 L90 -55 L90 -30" className="fill-slate-300/70" strokeWidth="2" />
                  <rect x="95" y="-25" width="50" height="35" className="fill-slate-300/70" rx="2" strokeWidth="2" />
                  <circle cx="25" cy="15" r="12" className="fill-slate-600" />
                  <circle cx="75" cy="15" r="12" className="fill-slate-600" />
                  <circle cx="120" cy="15" r="12" className="fill-slate-600" />
                </g>
                <g className="stroke-slate-600" transform="translate(220, 0)">
                  <rect x="0" y="-30" width="90" height="40" className="fill-slate-300/70" rx="3" strokeWidth="2" />
                  <path d="M0 -30 L30 -55 L90 -55 L90 -30" className="fill-slate-300/70" strokeWidth="2" />
                  <rect x="95" y="-25" width="50" height="35" className="fill-slate-300/70" rx="2" strokeWidth="2" />
                  <circle cx="25" cy="15" r="12" className="fill-slate-600" />
                  <circle cx="75" cy="15" r="12" className="fill-slate-600" />
                  <circle cx="120" cy="15" r="12" className="fill-slate-600" />
                </g>
              </g>
            </g>
          </g>

          {/* Tower crane on the right, scaled around its base */}
          <g
            className="stroke-slate-700"
            transform="translate(1180, 900) scale(1.1) translate(-1180, -900)"
          >
            <line x1="1180" y1="890" x2="1180" y2="620" strokeWidth="10" />
            <line x1="1180" y1="620" x2="1030" y2="665" strokeWidth="8" />
            <line x1="1180" y1="620" x2="1330" y2="640" strokeWidth="5" />
            <rect x="1165" y="870" width="40" height="28" className="fill-slate-500" strokeWidth="2" />
            <rect x="1158" y="620" width="50" height="32" className="fill-slate-400" strokeWidth="2" />
            <line x1="1130" y1="620" x2="1230" y2="620" strokeWidth="3" />
          </g>

          {/* Building skeleton: columns and beams draw themselves */}
          <g
            ref={buildingRef}
            className="stroke-slate-500"
            transform="translate(280, 560) scale(1.4)"
          >
            <line
              className="building-line"
              x1="0"
              y1="0"
              x2="0"
              y2="-160"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="30"
              y1="0"
              x2="30"
              y2="-160"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="60"
              y1="0"
              x2="60"
              y2="-160"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="90"
              y1="0"
              x2="90"
              y2="-160"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="0"
              y1="-40"
              x2="90"
              y2="-40"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="0"
              y1="-80"
              x2="90"
              y2="-80"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="0"
              y1="-120"
              x2="90"
              y2="-120"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="0"
              y1="-160"
              x2="90"
              y2="-160"
              strokeWidth="2"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="0"
              y1="0"
              x2="30"
              y2="-40"
              strokeWidth="1.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="30"
              y1="0"
              x2="60"
              y2="-40"
              strokeWidth="1.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="60"
              y1="0"
              x2="90"
              y2="-40"
              strokeWidth="1.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="0"
              y1="-80"
              x2="30"
              y2="-40"
              strokeWidth="1.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="30"
              y1="-80"
              x2="60"
              y2="-40"
              strokeWidth="1.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <line
              className="building-line"
              x1="60"
              y1="-80"
              x2="90"
              y2="-40"
              strokeWidth="1.5"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
          </g>

          {/* Crane cable and suspended concrete block, scaled up */}
          <line
            ref={cableRef}
            data-testid="crane-cable"
            x1="1015"
            y1="642"
            x2="1015"
            y2="660"
            strokeWidth="3"
            className="stroke-slate-600"
          />
          <g transform="translate(1015, 660)">
            <g ref={blockRef} data-testid="concrete-block">
              <g transform="scale(1.15)">
                <rect
                  x="-35"
                  y="0"
                  width="70"
                  height="45"
                  className="fill-slate-500 stroke-slate-700"
                  rx="2"
                  strokeWidth="2"
                />
                <line x1="-25" y1="12" x2="25" y2="12" strokeWidth="1.5" className="stroke-slate-400" />
                <line x1="-25" y1="30" x2="25" y2="30" strokeWidth="1.5" className="stroke-slate-400" />
              </g>
            </g>
          </g>
        </svg>

        <div className="relative z-10 max-w-3xl">
          <p className="mb-5 font-mono text-sm uppercase tracking-[.35em] text-cyan-600">
            Structural integration workspace
          </p>
          <h1 className="text-6xl font-semibold tracking-tight text-slate-900 md:text-8xl">ISOMORF</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-600">
            A technical environment for turning structural concepts into precise, editable geometry.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              className="rounded-lg bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
              href="/register"
            >
              Create workspace
            </Link>
            <Link
              className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 transition hover:border-cyan-500 hover:text-cyan-600"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>

      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">What we offer</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            A modern workspace built for structural and BIM teams.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ValueCard
            icon={Building2}
            title="Integrated modeling"
            description="Build structural geometry and link it directly to BIM data without switching tools."
          />
          <ValueCard
            icon={Calculator}
            title="Cloud calculation"
            description="Run load cases and preview FEM analysis from any browser, with results synced in real time."
          />
          <ValueCard
            icon={Users}
            title="Team collaboration"
            description="Share projects, plans and models with engineers, architects and reviewers in one place."
          />
          <ValueCard
            icon={FileCheck}
            title="Technical deliverables"
            description="Export drawings, reports and documentation ready for construction and code review."
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="grid h-20 w-20 place-items-center rounded-full border border-slate-200 bg-white/80 text-cyan-600 backdrop-blur">
              <Play className="h-8 w-8 fill-current" />
            </div>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Video coming soon</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ValueCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 transition hover:border-slate-300">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-cyan-100 text-cyan-600">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
