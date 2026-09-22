'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from '@/lib/i18n/locale-context';
import { locales } from '@/lib/i18n/messages';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations('editor.language');

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={`inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 ${className}`}
    >
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          title={t(option === 'en' ? 'english' : 'spanish')}
          className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            locale === option ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
