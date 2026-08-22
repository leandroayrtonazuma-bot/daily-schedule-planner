import { afterEach, describe, expect, it } from 'vitest';
import { resolveDataFilePath } from '@/lib/store/file-db';

/**
 * Vercel の関数実行環境は /var/task 以下が読み取り専用で、
 * data/store.json を作ろうとすると ENOENT で落ちる（実際にデプロイして確認した）。
 * VERCEL=1 のときだけ書き込み可能な /tmp に逃がす。
 */
describe('resolveDataFilePath', () => {
  const originalOverride = process.env.SCHEDULE_DATA_FILE;
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    if (originalOverride === undefined) delete process.env.SCHEDULE_DATA_FILE;
    else process.env.SCHEDULE_DATA_FILE = originalOverride;

    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('通常は process.cwd() 配下の data/store.json', () => {
    delete process.env.SCHEDULE_DATA_FILE;
    delete process.env.VERCEL;

    const path = resolveDataFilePath();
    expect(path.replace(/\\/g, '/')).toMatch(/\/data\/store\.json$/);
    expect(path.replace(/\\/g, '/')).not.toMatch(/^\/tmp\//);
  });

  it('VERCEL=1 のときは /tmp 配下にする', () => {
    delete process.env.SCHEDULE_DATA_FILE;
    process.env.VERCEL = '1';

    const path = resolveDataFilePath();
    expect(path.replace(/\\/g, '/')).toMatch(/^\/tmp\/.*store\.json$/);
  });

  it('SCHEDULE_DATA_FILE が設定されていれば VERCEL より優先する', () => {
    process.env.SCHEDULE_DATA_FILE = '/custom/path.json';
    process.env.VERCEL = '1';

    const path = resolveDataFilePath();
    expect(path.replace(/\\/g, '/')).toMatch(/\/custom\/path\.json$/);
  });
});
