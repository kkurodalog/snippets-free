#!/usr/bin/env node
/**
 * 掲載範囲マーカーの検査（Node 標準ライブラリのみ / 依存ゼロ）。
 *
 *   node tools/check-markers.mjs
 *
 * 何を見るか
 *   カード定義（site/data/{カテゴリ}.json）の files[] が指す実ファイルを1本ずつ開き、
 *   CODING-RULES.md「掲載範囲マーカー」の規約どおりに1組だけ入っているかを見る。
 *   判定の実装は assets/js/snippet-marker.js（ブラウザ側と同じ1本）。
 *
 * 判定
 *   - 1組そろっている                     = 合格
 *   - 片側だけ / 入れ子 / 2組以上         = 違反
 *   - マーカー範囲の中に日本語の行コメント = 違反（コピーした人に解説文が付いてくるため）
 *   - マーカーが1つも無い                 = 保留（埋め込みは後続工程の作業）
 *
 * ⚠️ 保留は逃げ道になりうる。そこで**保留が消える条件を先に書き、そこで違反へ自動格上げする**。
 *    条件 = そのカテゴリの中に1本でもマーカー入りのファイルが現れること。
 *    埋め込みはカテゴリ単位で進むため、1本入った時点で「そのカテゴリは作業中」であり、
 *    残りが未埋め込みなら取りこぼしである。
 *    ⚠️ ただしこの自動格上げは**カテゴリの中でしか閉じない**。カテゴリが丸ごと未着手だと
 *       保留のまま合格になる。埋め込みはカテゴリ単位で進むため、
 *       「3カテゴリ完了・1カテゴリ未着手」は必ずこの形になる。
 *
 * ★公開ゲート（--require-embedded）
 *    公開してよいかの判定では、保留を1件も許さない。
 *      node tools/check-markers.mjs . --require-embedded
 *    このモードでは未埋め込みを違反として数え、1件でもあれば exit 1 になる。
 *    ⚠️ 既定（引数なし）は保留のままにする。**埋め込み作業の最中に常時 exit 1 にすると、
 *       検査そのものが無視されるようになる。** 日常の検査と公開ゲートを分ける理由はこれである。
 *
 * ⚠️ 「行頭コメントの日本語」は厳密なパーサではなく字面の判定である。
 *    デモの表示文言（日本語の本文）は対象にならない。対象はコメント行だけ。
 *
 * 終了コード: 0 = 違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
 *
 * ★走査の起点はコマンドライン引数で差し替えられる（既定はリポジトリ直下）。
 *   tools/check-paths.sh ・ tools/check-design.sh が走査対象を引数で受け取るのと同じ形にしてある。
 *   この検出器が「違反で落ちること」「対象0件で落ちること」を確かめるとき、
 *   掲載デモを一時的に書き換えずに済ませるための口である。
 */

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractSnippet, hasMarker, MARKER_STATUS } from '../assets/js/snippet-marker.js';
import { loadSite, loadCategory, publishedCategories, partFile } from './site-data.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('..', import.meta.url));

const REASON = {
  [MARKER_STATUS.UNPAIRED]: '開始と終了が対になっていない',
  [MARKER_STATUS.NESTED]: 'マーカーが入れ子になっている',
  [MARKER_STATUS.MULTIPLE]: 'マーカーの組が2つ以上ある',
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function checkMarkers(root = DEFAULT_ROOT) {
  const ROOT = root;
  const site = await loadSite(ROOT);
  const violations = [];
  const pending = [];
  let scanned = 0;

  for (const category of publishedCategories(site)) {
    const data = await loadCategory(ROOT, category.slug);

    // このカテゴリで1本でもマーカーが入っていたら、残りの未埋め込みは取りこぼしとして落とす。
    const targets = [];
    for (const part of data.parts) {
      for (const kind of part.files) {
        const rel = partFile(category.slug, part.slug, kind);
        if (!(await exists(join(ROOT, rel)))) continue; // 実ファイルの有無は build 側が見る
        targets.push({ rel, text: await readFile(join(ROOT, rel), 'utf8') });
      }
    }
    const embedded = targets.some((t) => hasMarker(t.text));

    for (const target of targets) {
      scanned += 1;
      const result = extractSnippet(target.text);
      if (result.status === MARKER_STATUS.NONE) {
        if (embedded) violations.push(`${target.rel}: マーカーが無い（同じカテゴリの他ファイルには入っている）`);
        else pending.push(target.rel);
        continue;
      }
      if (result.status !== MARKER_STATUS.OK) {
        violations.push(`${target.rel}: ${REASON[result.status]}`);
        continue;
      }
      for (const c of result.commentLines) {
        violations.push(`${target.rel}:${c.line}: マーカー範囲に日本語のコメントがある — ${c.text}`);
      }
    }
  }

  return { violations, pending, scanned };
}

export function reportMarkers({ violations, pending, scanned }, { requireEmbedded = false } = {}) {
  console.log(
    `掲載範囲マーカー検査: ${scanned} ファイル${requireEmbedded ? '（公開ゲート / 未埋め込みを違反として扱う）' : ''}`
  );
  if (pending.length > 0) {
    if (requireEmbedded) {
      console.error(`NG: マーカー未埋め込み ${pending.length} ファイル`);
      for (const p of pending) console.error(`  - ${p}`);
      console.error('  ★未埋め込みのファイルは、公開してもコードを表示できずコピーもできない。');
    } else {
      console.warn(`⚠️ マーカー未埋め込み ${pending.length} ファイル（埋め込みは後続工程）`);
      for (const p of pending) console.warn(`  - ${p}`);
      console.warn('  ★同じカテゴリに1本でも埋め込んだ時点で、残りは違反として落ちる。');
      console.warn('  ★公開してよいかは `node tools/check-markers.mjs . --require-embedded` で判定する。');
    }
  }
  if (violations.length > 0) {
    console.error(`マーカーの規約違反 ${violations.length} 件`);
    for (const v of violations) console.error(`  - ${v}`);
  }
  // ⚠️ 未埋め込みを一覧に出しながら「OK」と言わない。
  //    公開ゲートでは未埋め込みも不合格の理由である。
  const failed = violations.length > 0 || (requireEmbedded && pending.length > 0);
  if (!failed) console.log('OK: マーカーの規約違反は0件');
  return failed;
}

async function main() {
  // 引数は順不同。`--` で始まらない最初のものを走査の起点として読む。
  const args = process.argv.slice(2);
  const requireEmbedded = args.includes('--require-embedded');
  const target = args.find((a) => !a.startsWith('--'));

  const result = await checkMarkers(target ? resolve(target) : DEFAULT_ROOT);
  if (result.scanned === 0) {
    console.error('NG: 走査対象のファイルが0件。データかパスが違う');
    process.exitCode = 2;
    return;
  }
  const failed = reportMarkers(result, { requireEmbedded });
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
