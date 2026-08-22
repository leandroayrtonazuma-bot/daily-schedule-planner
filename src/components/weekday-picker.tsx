import { WEEKDAY_LABELS, type DayOfWeek } from '@/lib/domain';

/**
 * 曜日の選択。チェックボックスを見た目だけボタンにしている。
 * 送信時は同名の複数値として届くので、readNumbers で受ける。
 */
export function WeekdayPicker({
  name,
  selected,
}: {
  name: string;
  selected: readonly DayOfWeek[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAY_LABELS.map((label, day) => (
        <label
          key={day}
          className="cursor-pointer select-none rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors has-checked:border-foreground has-checked:bg-foreground has-checked:text-background hover:bg-muted has-checked:hover:bg-foreground"
        >
          <input
            type="checkbox"
            name={name}
            value={day}
            defaultChecked={selected.includes(day as DayOfWeek)}
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </div>
  );
}
