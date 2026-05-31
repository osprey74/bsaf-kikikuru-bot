/**
 * tests/warningState.test.ts
 * 重複抑制ステートの検証
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  isAlreadyPosted,
  markPosted,
  clearExpired,
  _resetForTest,
  size,
} from "../src/state/warningState";

describe("warningState", () => {
  beforeEach(() => {
    _resetForTest();
  });

  test("初期状態は空", () => {
    expect(size()).toBe(0);
    expect(isAlreadyPosted("any-key")).toBe(false);
  });

  test("markPosted した key は isAlreadyPosted=true", () => {
    markPosted("wind:jp-tokyo:advisory");
    expect(isAlreadyPosted("wind:jp-tokyo:advisory")).toBe(true);
    expect(isAlreadyPosted("wind:jp-tokyo:warning")).toBe(false);
  });

  test("clearExpired は 30 分以内は残す", () => {
    markPosted("k1");
    clearExpired();
    expect(isAlreadyPosted("k1")).toBe(true);
  });
});
