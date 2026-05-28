/**
 * tests/warningState.test.ts
 * 重複抑制ステートのユニットテスト
 */

import { describe, expect, test, beforeEach } from "bun:test";
import {
  isAlreadyPosted,
  markPosted,
  clearExpired,
  size,
  _resetForTest,
} from "../src/state/warningState";

describe("warningState", () => {
  beforeEach(() => _resetForTest());

  test("未投稿のキーは false", () => {
    expect(isAlreadyPosted("heavy-rain:jp-tokyo:level4")).toBe(false);
  });

  test("markPosted 後は true", () => {
    markPosted("heavy-rain:jp-tokyo:level4");
    expect(isAlreadyPosted("heavy-rain:jp-tokyo:level4")).toBe(true);
  });

  test("size はエントリ数を返す", () => {
    expect(size()).toBe(0);
    markPosted("a");
    markPosted("b");
    expect(size()).toBe(2);
  });

  test("clearExpired はウィンドウ内エントリを消さない", () => {
    markPosted("recent");
    clearExpired();
    expect(isAlreadyPosted("recent")).toBe(true);
  });
});
