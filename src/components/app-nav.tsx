'use client';

import { CalendarDays, ListTodo, Repeat, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: '今日', icon: CalendarDays },
  { href: '/tasks', label: 'タスク', icon: ListTodo },
  { href: '/routines', label: 'ルーティン', icon: Repeat },
  { href: '/settings', label: '設定', icon: Settings },
] as const;

export function AppNav() {
  const pathname = usePathname();

  // ログイン画面には出さない
  if (pathname === '/login') return null;

  return (
    <nav className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors',
                active
                  ? 'border-foreground font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
