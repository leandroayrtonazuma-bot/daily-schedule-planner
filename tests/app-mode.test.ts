import { describe, expect, test } from 'vitest';
import { resolveAppMode } from '@/lib/app-mode';

const filled = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
};

describe('resolveAppMode', () => {
  test('Supabase の設定が揃っていれば live', () => {
    expect(resolveAppMode(filled).mode).toBe('live');
  });

  test('設定が何も無ければ mock', () => {
    expect(resolveAppMode({}).mode).toBe('mock');
  });

  test('mock のときは何が足りないかを返す', () => {
    const result = resolveAppMode({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' });

    expect(result.mode).toBe('mock');
    expect(result.missing).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  });

  test('空文字は未設定として扱う', () => {
    expect(resolveAppMode({ ...filled, NEXT_PUBLIC_SUPABASE_ANON_KEY: '   ' }).mode).toBe('mock');
  });

  test('APP_MODE=mock なら設定が揃っていても mock', () => {
    expect(resolveAppMode({ ...filled, APP_MODE: 'mock' }).mode).toBe('mock');
  });

  test('APP_MODE=live で設定が足りなければ例外を投げる', () => {
    expect(() => resolveAppMode({ APP_MODE: 'live' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  test('APP_MODE に未知の値が入っていれば例外を投げる', () => {
    expect(() => resolveAppMode({ ...filled, APP_MODE: 'production' })).toThrow(/APP_MODE/);
  });
});
