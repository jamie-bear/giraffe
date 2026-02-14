import type { Metadata } from 'next';
import { Denk_One } from 'next/font/google';
import { Providers } from '@/lib/providers';
import '@/styles/globals.css';

const denkOne = Denk_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-denk-one',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Giraffe',
  description: 'See Everything.',
  icons: {
    icon: '/giraffe-logo-icon-v1.1.svg',
    apple: '/giraffe-logo-icon-v1.1.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={denkOne.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
