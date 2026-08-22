'use client';

import { ClipboardPaste, Loader2, Sparkles, X } from 'lucide-react';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { decomposeAction, saveDraftsAction } from '@/app/tasks/actions';
import { INITIAL_DECOMPOSE_STATE } from '@/app/tasks/decompose-state';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * 「まとめて貼り付け」→ AI 分解 → 確認画面（PLAN.md 7.3）。
 *
 * 分解した結果は**そのまま保存されない**。必ず編集できる確認画面を挟む。
 * AI が落ちても、この下にある手入力フォームは常に動く。
 */
export function TaskPaste({ configured }: { configured: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(decomposeAction, INITIAL_DECOMPOSE_STATE);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <ClipboardPaste className="size-4" />
        まとめて貼り付け
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" aria-hidden />
          まとめて貼り付け
        </CardTitle>
        <CardDescription>
          メモや議事録を貼ると、着手できる大きさのタスクに分けます。
          {configured
            ? '保存する前に、必ず内容を確認して直せます。'
            : 'いまは AI キーが未設定のため使えません。'}
        </CardDescription>
        <CardAction>
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}>
            <X className="size-4" />
            <span className="sr-only">閉じる</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-3">
          <Textarea
            name="input"
            rows={6}
            defaultValue={state.input}
            placeholder={'例:\n来週の提案書。骨子を決めて、競合を3社調べて、スライドに起こす。\n請求書の処理も残ってる。'}
          />
          <DecomposeButton disabled={!configured} />
        </form>

        {state.error && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            {state.error}
          </p>
        )}

        {state.drafts.length > 0 && (
          <DraftReview key={state.drafts.map((d) => d.title).join('|')} drafts={state.drafts} />
        )}
      </CardContent>
    </Card>
  );
}

function DecomposeButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={disabled || pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {pending ? '分解しています…' : 'タスクに分ける'}
      </Button>
      {disabled && (
        <span className="text-xs text-muted-foreground">
          .env.local に ANTHROPIC_API_KEY を設定すると使えます
        </span>
      )}
    </div>
  );
}

/** 保存前の確認画面。ここで直せるし、外せる */
function DraftReview({ drafts }: { drafts: { title: string; estimatedMinutes: number; priority: number }[] }) {
  const [kept, setKept] = useState<number[]>(() => drafts.map((_, index) => index));

  function toggle(index: number) {
    setKept((current) =>
      current.includes(index) ? current.filter((value) => value !== index) : [...current, index],
    );
  }

  return (
    <form action={saveDraftsAction} className="space-y-3 rounded-md border p-3">
      <p className="text-sm font-medium">保存する前に確認してください</p>

      <ul className="space-y-2">
        {drafts.map((draft, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <Checkbox
              name="keep"
              value={String(index)}
              checked={kept.includes(index)}
              onCheckedChange={() => toggle(index)}
              aria-label={`${draft.title} を保存する`}
            />
            <Input
              name={`title-${index}`}
              defaultValue={draft.title}
              className="min-w-40 flex-1"
              aria-label="タイトル"
            />
            <Input
              name={`estimatedMinutes-${index}`}
              type="number"
              min={1}
              // step を刻むと min との組み合わせで中間の値が「不正」になり、
              // ブラウザが submit を黙って止める。分は1分刻みで自由に入れさせる
              step={1}
              defaultValue={draft.estimatedMinutes}
              className="w-20"
              aria-label="見積（分）"
            />
            <select
              name={`priority-${index}`}
              defaultValue={draft.priority}
              aria-label="優先度"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value={1}>高</option>
              <option value={2}>中</option>
              <option value={3}>低</option>
            </select>
          </li>
        ))}
      </ul>

      <SaveDraftsButton count={kept.length} />
    </form>
  );
}

function SaveDraftsButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={count === 0 || pending}>
        {count} 件を保存
      </Button>
      <span className="text-xs text-muted-foreground">
        チェックを外したものは保存されません
      </span>
    </div>
  );
}
