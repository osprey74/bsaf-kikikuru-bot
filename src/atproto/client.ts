/**
 * src/atproto/client.ts
 * BskyAgent ラッパー
 *
 * 起動時にログインし、セッションを保持する。
 * トークン期限切れ時は自動再ログインする。
 *
 * BSAFタグは AT Protocol の `tags` フィールド（string[]）に格納する。
 * 仕様: bsaf-protocol/docs/bsaf-spec-ja.md 「タグの使用量制限」
 */

import { AtpAgent, RichText } from "@atproto/api";

const BSKY_SERVICE = "https://bsky.social";

let _agent: AtpAgent | null = null;

async function getAgent(): Promise<AtpAgent> {
  if (_agent) return _agent;

  const identifier = process.env["BSKY_IDENTIFIER"];
  const password   = process.env["BSKY_PASSWORD"];

  if (!identifier || !password) {
    throw new Error("BSKY_IDENTIFIER / BSKY_PASSWORD が未設定です");
  }

  const agent = new AtpAgent({ service: BSKY_SERVICE });
  await agent.login({ identifier, password });
  console.info(`[ATP] ログイン完了: ${identifier}`);

  _agent = agent;
  return agent;
}

/**
 * テキストと BSAF tags 配列を含む投稿を送信する。
 *
 * @param text - 投稿テキスト（300文字以内推奨）
 * @param tags - BSAFタグ文字列配列（最大8個、合計640バイト）
 */
export async function post(text: string, tags: string[]): Promise<void> {
  let agent: AtpAgent;
  try {
    agent = await getAgent();
  } catch (e) {
    // 初回取得時のエラーはそのまま伝播
    throw e;
  }

  // セッション切れ時のリトライ準備
  const doPost = async () => {
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    await agent.post({
      text:      rt.text,
      facets:    rt.facets,
      tags,
      langs:     ["ja"],
      createdAt: new Date().toISOString(),
    });
  };

  try {
    await doPost();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ExpiredToken") || msg.includes("InvalidToken")) {
      console.warn("[ATP] セッション期限切れ、再ログインして再送");
      _agent = null;
      agent = await getAgent();
      await doPost();
    } else {
      throw e;
    }
  }
}

/** 接続テスト（ヘルスチェック用） */
export async function ping(): Promise<boolean> {
  try {
    await getAgent();
    return true;
  } catch {
    return false;
  }
}
