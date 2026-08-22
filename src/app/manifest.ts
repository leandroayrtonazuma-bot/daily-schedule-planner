import type { MetadataRoute } from 'next';

/**
 * PWA のマニフェスト（PLAN.md 8章 Phase 6）。
 * スマホのホーム画面から、ブラウザの枠なしで起動できるようにする。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '一日スケジュール',
    short_name: 'スケジュール',
    description: 'カレンダーの予定を土台に、一日の使い方を組み立てる',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'ja',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
