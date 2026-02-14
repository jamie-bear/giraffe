import type { Metadata } from 'next';
import { Providers } from '@/lib/providers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Giraffe',
  description: 'Your personal media center',
  icons: {
    icon: '/giraffe-logo-icon-v1.1.svg',
    apple: '/giraffe-logo-icon-v1.1.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
