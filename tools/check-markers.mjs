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

export function reportMarkers({ violations, pending, scanned }) {
  console.log(`掲載範囲マーカー検査: ${scanned} ファイル`);
  if (pending.length > 0) {
    console.warn(`⚠️ マーカー未埋め込み ${pending.length} ファイル（埋め込みは後続工程）`);
    for (const p of pending) console.warn(`  - ${p}`);
    console.warn('  ★同じカテゴリに1本でも埋め込んだ時点で、残りは違反として落ちる。');
  }
  if (violations.length > 0) {
    console.error(`マーカーの規約違反 ${violations.length} 件`);
    for (const v of violations) console.error(`  - ${v}`);
  }
  if (violations.length === 0) console.log('OK: マーカーの規約違反は0件');
}

async function main() {
  const result = await checkMarkers(process.argv[2] ? resolve(process.argv[2]) : DEFAULT_ROOT);
  if (result.scanned === 0) {
    console.error('NG: 走査対象のファイルが0件。データかパスが違う');
    process.exitCode = 2;
    return;
  }
  reportMarkers(result);
  if (result.violations.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
