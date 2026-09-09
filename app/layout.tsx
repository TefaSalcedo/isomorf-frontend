import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-context';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] });
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = { title: 'ISOMORF | Structural Integration', description: 'A technical workspace for structural engineering integration.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${jakarta.variable} ${inter.variable}`}><body><AuthProvider>{children}</AuthProvider></body></html>;
}
