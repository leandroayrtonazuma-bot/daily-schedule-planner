import { PageSkeleton } from '@/components/page-skeleton';

export default function Loading() {
  return <PageSkeleton title="読み込み中" rows={6} />;
}
