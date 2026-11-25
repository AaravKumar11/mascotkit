'use client';

import dynamic from 'next/dynamic';

// The studio reads its state from the URL hash, so it renders in the browser only.
const Studio = dynamic(() => import('@/components/Studio').then((m) => m.Studio), { ssr: false });

export default function Home() {
  return <Studio />;
}
