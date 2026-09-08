import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PalEstra',
  description: 'Schede di allenamento fra preparatore e atleta, senza fogli di calcolo.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The athlete uses this in a gym: no accidental double-tap zoom, but
  // pinch zoom stays available for accessibility.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
