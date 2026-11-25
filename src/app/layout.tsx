import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'mascotkit',
  description: 'Every app deserves a mascot. Build one in a minute and export it as SVG, PNG or React.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
