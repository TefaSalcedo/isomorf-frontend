'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from '@/lib/i18n/locale-context';
import { locales } from '@/lib/i18n/messages';

export function LanguageSwitcher({ className = '', variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations('editor.language');
  const dark = variant === 'dark';

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={`inline-flex items-center rounded-lg border p-0.5 ${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'} ${className}`}
    >
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          title={t(option === 'en' ? 'english' : 'spanish')}
          className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 ${
            dark
              ? `focus-visible:ring-cyan-500 ${locale === option ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`
              : `focus-visible:ring-violet-500 ${locale === option ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
