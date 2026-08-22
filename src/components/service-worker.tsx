'use client';

import { useEffect } from 'react';

/**
 * Service Worker の登録（PLAN.md 8章 Phase 6）。
 *
 * ホーム画面に追加できるようにするために要る。
 * 開発中は登録しない。古い sw が挟まって、変更が反映されない事故が起きるため。
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 登録できなくてもアプリは動く。ホーム画面に追加できないだけ
    });
  }, []);

  return null;
}
