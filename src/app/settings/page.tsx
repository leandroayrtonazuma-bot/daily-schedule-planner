import { Trash2, TrendingUp } from 'lucide-react';
import { ModeBanner } from '@/components/mode-banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WeekdayPicker } from '@/components/weekday-picker';
import { ALL_DAYS_OF_WEEK, WEEKDAY_LABELS, type BlockedWindow } from '@/lib/domain';
import { MIN_SAMPLES, suggestEstimateFactor } from '@/lib/estimate';
import { requireSession } from '@/lib/session';
import { listBlockedWindows, listTasks } from '@/lib/store';
import {
  addBlockedWindowAction,
  applyEstimateFactorAction,
  deleteBlockedWindowAction,
  saveSettingsAction,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user, mode, missing, settings } = await requireSession();
  const [blockedWindows, tasks] = await Promise.all([
    listBlockedWindows(user.id),
    listTasks(user.id, { status: 'done' }),
  ]);

  // 実測が溜まっていれば、そこから割り出した係数を提案する（PLAN.md 8章 Phase 4）
  const suggestion = suggestEstimateFactor(tasks);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          一日をどう組むかの土台になる値。変更すると次の生成から反映される。
        </p>
      </header>

      {mode === 'mock' && <ModeBanner missing={missing} />}

      <form action={saveSettingsAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">稼働時間</CardTitle>
            <CardDescription>この範囲の外には何も置かない</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="開始" htmlFor="workStart">
              <Input id="workStart" name="workStart" type="time" defaultValue={settings.workStart} />
            </Field>
            <Field label="終了" htmlFor="workEnd">
              <Input id="workEnd" name="workEnd" type="time" defaultValue={settings.workEnd} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">予定の前後にあける時間</CardTitle>
            <CardDescription>移動や準備のためのバッファ。予定の直前直後を空けておく</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="予定の前（分）" htmlFor="bufferBeforeMinutes">
              <Input
                id="bufferBeforeMinutes"
                name="bufferBeforeMinutes"
                type="number"
                min={0}
                max={240}
                defaultValue={settings.bufferBeforeMinutes}
              />
            </Field>
            <Field label="予定の後（分）" htmlFor="bufferAfterMinutes">
              <Input
                id="bufferAfterMinutes"
                name="bufferAfterMinutes"
                type="number"
                min={0}
                max={240}
                defaultValue={settings.bufferAfterMinutes}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">休憩</CardTitle>
            <CardDescription>
              連続作業がこの長さを超えたら、直後の空きに休憩を差し込む。長さを0にすると無効
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="連続作業の上限（分）" htmlFor="breakAfterMinutes">
              <Input
                id="breakAfterMinutes"
                name="breakAfterMinutes"
                type="number"
                min={1}
                defaultValue={settings.breakAfterMinutes}
              />
            </Field>
            <Field label="休憩の長さ（分）" htmlFor="breakDurationMinutes">
              <Input
                id="breakDurationMinutes"
                name="breakDurationMinutes"
                type="number"
                min={0}
                max={240}
                defaultValue={settings.breakDurationMinutes}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">その他</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              name="includeAllDay"
              label="終日予定を埋まっている時間として扱う"
              description="オフなら終日予定は上部の帯に出すだけで、時間は占有しない"
              defaultChecked={settings.includeAllDay}
            />
            <ToggleRow
              name="askCarryover"
              label="その日最初のアクセスで繰り越しを確認する"
              description="前日までの未完了タスクを今日やるかどうか尋ねる"
              defaultChecked={settings.askCarryover}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="見積の補正係数" htmlFor="estimateFactor">
                <Input
                  id="estimateFactor"
                  name="estimateFactor"
                  type="number"
                  // 提案される係数は小数第2位まで（例 0.92）。step を 0.1 にすると
                  // それが「不正な値」になり、保存が黙って止まる
                  step="0.01"
                  min={0.1}
                  max={3}
                  defaultValue={settings.estimateFactor}
                />
                <p className="text-xs text-muted-foreground">
                  見積時間にこれを掛けた長さで場所を取る。いつも押すなら 1.2 などにする
                </p>
              </Field>
              <Field label="カレンダー ID" htmlFor="calendarId">
                <Input id="calendarId" name="calendarId" defaultValue={settings.calendarId} />
                <p className="text-xs text-muted-foreground">
                  通常は primary のまま。別のカレンダーを見るときだけ変える
                </p>
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">設定を保存</Button>
        </div>
      </form>

      <EstimateSuggestion current={settings.estimateFactor} suggestion={suggestion} />

      <BlockedWindowSection windows={blockedWindows} />
    </main>
  );
}

/**
 * 実測から割り出した補正係数の提案（PLAN.md 8章 Phase 4）。
 * 自動では当てない。押されたときだけ反映する。
 * 配置結果が黙って変わるのが、この手の補正で一番困る事故なので。
 */
function EstimateSuggestion({
  current,
  suggestion,
}: {
  current: number;
  suggestion: ReturnType<typeof suggestEstimateFactor>;
}) {
  if (!suggestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">見積の補正</CardTitle>
          <CardDescription>
            タスクを完了するときに実測を入れておくと、{MIN_SAMPLES}件たまった時点で
            あなたに合った補正係数をここに提案します。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const same = Math.abs(suggestion.factor - current) < 0.01;

  return (
    <Card className={same ? undefined : 'border-primary/40'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" aria-hidden />
          見積の補正
        </CardTitle>
        <CardDescription>
          完了した {suggestion.sampleCount} 件の実測から計算した値です（中央値）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          実測は見積の <span className="font-semibold">{suggestion.factor} 倍</span> でした。
          {same ? (
            <span className="text-muted-foreground">現在の設定と同じです。</span>
          ) : (
            <span className="text-muted-foreground">
              　現在の設定は {current} 倍です。
            </span>
          )}
        </p>

        {!same && (
          <form action={applyEstimateFactorAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="estimateFactor" value={suggestion.factor} />
            <Button type="submit" variant="secondary" size="sm">
              {suggestion.factor} を使う
            </Button>
            <span className="text-xs text-muted-foreground">
              押すまで反映しません。押すと明日以降の配置が変わります
            </span>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function BlockedWindowSection({ windows }: { windows: BlockedWindow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">予定を入れない時間帯</CardTitle>
        <CardDescription>
          睡眠・入浴・通勤など、絶対に空けておきたい時間。ここにはルーティンもタスクも置かない
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {windows.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ登録されていません</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {windows.map((window) => (
              <li key={window.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-28 shrink-0 font-mono text-sm tabular-nums">
                  {window.startTime}–{window.endTime}
                </span>
                <span className="flex-1 text-sm">{window.label}</span>
                <span className="text-xs text-muted-foreground">
                  {window.specificDate ?? describeDays(window.daysOfWeek)}
                </span>
                <form action={deleteBlockedWindowAction}>
                  <input type="hidden" name="id" value={window.id} />
                  <Button type="submit" variant="ghost" size="icon" aria-label={`${window.label}を削除`}>
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addBlockedWindowAction} className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">追加する</p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="名前" htmlFor="label">
              <Input id="label" name="label" placeholder="睡眠" required />
            </Field>
            <Field label="開始" htmlFor="startTime">
              <Input id="startTime" name="startTime" type="time" defaultValue="23:00" required />
            </Field>
            <Field label="終了" htmlFor="endTime">
              <Input id="endTime" name="endTime" type="time" defaultValue="07:00" required />
            </Field>
          </div>

          <Field label="曜日">
            <WeekdayPicker name="daysOfWeek" selected={ALL_DAYS_OF_WEEK} />
          </Field>

          <Field label="特定の日だけ（任意）" htmlFor="specificDate">
            <Input id="specificDate" name="specificDate" type="date" />
            <p className="text-xs text-muted-foreground">入れるとその日だけ有効になり、曜日は無視される</p>
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="secondary">
              ブロックを追加
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <Checkbox name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span className="space-y-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function describeDays(days: readonly number[]): string {
  if (days.length === 7) return '毎日';
  if (days.length === 0) return '—';

  return days.map((day) => WEEKDAY_LABELS[day]).join('');
}
