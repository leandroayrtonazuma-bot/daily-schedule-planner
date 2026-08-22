/**
 * 重なり合う項目を横に並べるための列割り当て（PLAN.md 7.1）。
 *
 * 重なりが連鎖している塊ごとに列数を数え、塊の中で最も左の空き列に置く。
 * 描画側は column / columns を幅と左位置に変換するだけでよい。
 */
export type LayoutInput = {
  key: string;
  start: number;
  end: number;
};

export type LayoutResult<T extends LayoutInput> = T & {
  /** 0始まり。左からの位置 */
  column: number;
  /** その項目が属する塊の列数 */
  columns: number;
};

export function layoutTimeline<T extends LayoutInput>(items: readonly T[]): LayoutResult<T>[] {
  const sorted = [...items].sort(
    (a, b) => a.start - b.start || a.end - b.end || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

  const result: LayoutResult<T>[] = [];

  // 塊（重なりが連鎖している範囲）ごとに処理する
  let cluster: LayoutResult<T>[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = cluster.reduce((max, item) => Math.max(max, item.column + 1), 1);
    for (const item of cluster) item.columns = columns;

    result.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  // 各列が最後に埋まっている時刻
  let columnEnds: number[] = [];

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      columnEnds = [];
    }

    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }

    cluster.push({ ...item, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }

  flush();

  return result;
}
