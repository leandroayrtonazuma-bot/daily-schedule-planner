import { describe, expect, it } from 'vitest';
import { readBoolean, readNumber, readNumbers, readOptionalString, readString,
  readStrings,
} from '@/lib/form';

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }

  return data;
}

describe('readString', () => {
  it('値を返す', () => {
    expect(readString(form({ title: 'ランニング' }), 'title')).toBe('ランニング');
  });

  it('前後の空白を落とす', () => {
    expect(readString(form({ title: '  走る  ' }), 'title')).toBe('走る');
  });

  it('無ければ空文字', () => {
    expect(readString(form({}), 'title')).toBe('');
  });
});

describe('readOptionalString', () => {
  it('空文字は null にする', () => {
    expect(readOptionalString(form({ dueDate: '' }), 'dueDate')).toBeNull();
  });

  it('値があればそのまま', () => {
    expect(readOptionalString(form({ dueDate: '2026-08-21' }), 'dueDate')).toBe('2026-08-21');
  });
});

describe('readNumber', () => {
  it('数値に変換する', () => {
    expect(readNumber(form({ minutes: '45' }), 'minutes', 0)).toBe(45);
  });

  it('小数も読める', () => {
    expect(readNumber(form({ factor: '1.2' }), 'factor', 1)).toBe(1.2);
  });

  it('数値でなければ既定値', () => {
    expect(readNumber(form({ minutes: 'たくさん' }), 'minutes', 30)).toBe(30);
  });

  it('無ければ既定値', () => {
    expect(readNumber(form({}), 'minutes', 30)).toBe(30);
  });
});

describe('readBoolean', () => {
  it('チェックされていれば true', () => {
    expect(readBoolean(form({ includeAllDay: 'on' }), 'includeAllDay')).toBe(true);
  });

  it('無ければ false（チェックボックスは未チェックだと送られない）', () => {
    expect(readBoolean(form({}), 'includeAllDay')).toBe(false);
  });

  it('明示的に false と送られたら false', () => {
    expect(readBoolean(form({ isActive: 'false' }), 'isActive')).toBe(false);
  });
});

describe('readNumbers', () => {
  it('同名の値をすべて数値で集める', () => {
    expect(readNumbers(form({ daysOfWeek: ['1', '3', '5'] }), 'daysOfWeek')).toEqual([1, 3, 5]);
  });

  it('数値でないものは捨てる', () => {
    expect(readNumbers(form({ daysOfWeek: ['1', 'げつ'] }), 'daysOfWeek')).toEqual([1]);
  });

  it('無ければ空配列', () => {
    expect(readNumbers(form({}), 'daysOfWeek')).toEqual([]);
  });

  it('昇順に並べ、重複を除く', () => {
    expect(readNumbers(form({ daysOfWeek: ['5', '1', '5'] }), 'daysOfWeek')).toEqual([1, 5]);
  });
});

describe('readStrings', () => {
  it('同じ名前の値をすべて集める', () => {
    const form = new FormData();
    form.append('carry', 'a');
    form.append('carry', 'b');

    expect(readStrings(form, 'carry')).toEqual(['a', 'b']);
  });

  it('値が無ければ空配列', () => {
    expect(readStrings(new FormData(), 'carry')).toEqual([]);
  });

  it('空文字は捨てる', () => {
    const form = new FormData();
    form.append('carry', 'a');
    form.append('carry', '');

    expect(readStrings(form, 'carry')).toEqual(['a']);
  });

  it('重複を取り除く', () => {
    const form = new FormData();
    form.append('carry', 'a');
    form.append('carry', 'a');

    expect(readStrings(form, 'carry')).toEqual(['a']);
  });
});
