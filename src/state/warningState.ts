/**
 * src/state/warningState.ts
 * 重複投稿抑制ステート（インメモリ）
 *
 * 同一 dedupeKey (type:target:level) を 30 分間再投稿しない。
 * Bot 再起動でリセットされる前提。永続化はしない。
 */

/** 重複抑制ウィンドウ（ミリ秒） */
const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

/** dedupeKey → 投稿時刻(ms) */
const _posted = new Map<string, number>();

/**
 * 既に同一キーで投稿済み（かつ 30 分以内）か判定する。
 */
export function isAlreadyPosted(dedupeKey: string): boolean {
  const ts = _posted.get(dedupeKey);
  if (ts === undefined) return false;
  return Date.now() - ts < DEDUPE_WINDOW_MS;
}

/** 投稿成功時に呼び、キーを記録する */
export function markPosted(dedupeKey: string): void {
  _posted.set(dedupeKey, Date.now());
}

/** ウィンドウを過ぎたエントリを掃除する（毎ポーリングサイクル先頭で呼ぶ） */
export function clearExpired(): void {
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  for (const [key, ts] of _posted) {
    if (ts < cutoff) _posted.delete(key);
  }
}

/** テスト用: 全状態をリセット */
export function _resetForTest(): void {
  _posted.clear();
}

/** デバッグ用: 現在のエントリ数 */
export function size(): number {
  return _posted.size;
}
