import en from '@/messages/en.json';
import es from '@/messages/es.json';

export type Locale = 'en' | 'es';

export const locales: Locale[] = ['en', 'es'];
export const defaultLocale: Locale = 'en';

export const localeTags: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-CO',
};

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

export const dictionaries = { en, es };

export type Messages = typeof en;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'es';
}

function lookup(locale: Locale, key: string): string | undefined {
  let node: unknown = dictionaries[locale];
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * Translates a message outside React components (e.g. engineering memory generation).
 * Components should prefer next-intl's useTranslations for ICU features like plurals.
 */
export function translate(locale: Locale, key: string, values?: Record<string, string | number>): string {
  const template = lookup(locale, key) ?? lookup(defaultLocale, key);
  if (template === undefined) return key;
  return interpolate(template, values);
}
