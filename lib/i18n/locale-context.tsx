'use client';

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { defaultLocale, dictionaries, isLocale, localeTags, type Locale } from '@/lib/i18n/messages';

const LOCALE_COOKIE = 'isomorf_locale';
const LOCALE_STORAGE_KEY = 'isomorf_locale';

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  const fromCookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
    ?.split('=')[1];
  if (isLocale(fromCookie)) return fromCookie;
  try {
    const fromStorage = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(fromStorage) ? fromStorage : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable (opaque origin or privacy mode); the cookie still persists the choice.
  }
  document.cookie = `${LOCALE_COOKIE}=${locale}; Max-Age=31536000; path=/; SameSite=Lax`;
}

function subscribeToLocale(): () => void {
  return () => {};
}

function getStoredLocale(): Locale {
  return readStoredLocale();
}

function getServerLocale(): Locale {
  return defaultLocale;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [chosen, setChosen] = useState<Locale | null>(null);
  const stored = useSyncExternalStore(subscribeToLocale, getStoredLocale, getServerLocale);
  const locale = chosen ?? stored;

  useEffect(() => {
    document.documentElement.lang = localeTags[locale];
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        persistLocale(next);
        setChosen(next);
      },
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={dictionaries[locale]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}
