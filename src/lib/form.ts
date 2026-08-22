/**
 * Server Action に届く FormData から値を取り出す。
 * すべて文字列で届くので、ここで型と既定値を確定させる。
 */

export function readString(form: FormData, name: string): string {
  const value = form.get(name);

  return typeof value === 'string' ? value.trim() : '';
}

/** 空文字は「未入力」として null にする（締切や単発日付など） */
export function readOptionalString(form: FormData, name: string): string | null {
  return readString(form, name) || null;
}

export function readNumber(form: FormData, name: string, fallback: number): number {
  const raw = readString(form, name);
  if (!raw) return fallback;

  const value = Number(raw);

  return Number.isFinite(value) ? value : fallback;
}

/** チェックボックスは未チェックだと送られてこない。'false' も未チェック扱いにする */
export function readBoolean(form: FormData, name: string): boolean {
  const value = form.get(name);
  if (value === null) return false;

  return value !== 'false' && value !== '';
}

/** 同名の値をまとめて数値配列にする。昇順・重複なし */
export function readNumbers(form: FormData, name: string): number[] {
  const values = form
    .getAll(name)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  return [...new Set(values)].sort((a, b) => a - b);
}

/** 同じ名前のチェックボックス群を読む。重複と空文字は落とす */
export function readStrings(form: FormData, name: string): string[] {
  const seen = new Set<string>();

  for (const value of form.getAll(name)) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) seen.add(text);
  }

  return [...seen];
}
