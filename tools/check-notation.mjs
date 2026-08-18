#!/usr/bin/env node
/**
 * 社内記法（`★`）が公開物へ漏れていないかの検査（Node 標準ライブラリのみ / 依存ゼロ）。
 *
 *   node tools/check-notation.mjs
 *
 * なぜ機械に載せるか
 *   ★2026-08-18 に実際に漏れた。設計意図を site/partials/modal.mjs の **HTML コメント**に
 *     書いたところ、生成された components/{3カテゴリ}/index.html に `★` が各3件載った。
 *   ⚠️ 見つけたのは毎回の手動 grep である。**手順に置いた統制がたまたま働いただけ**であり、
 *      その手順を通らない経路（別の作業ついでの partial 編集）は素通りする。
 *      再発防止は機械的に通る層へ置く。
 *
 * ★何を対象にするか（対象を絞る理由まで書く）
 *   対象 = 「利用者がそのまま読む面」と「コピーされて配られる面」である。
 *     - README.md / CODING-RULES.md / LICENSE … 公開リポの説明。GitHub でそのまま読まれる
 *     - sitemap.xml                          … 配信物
 *     - 生成HTML（index.html ＋ カテゴリ一覧） … 画面。HTML コメントも配信される
 *     - 掲載デモのファイル                     … コピーされて利用者のページへ入る
 *
 * ★何を対象にしないか（⚠️ 書かないと「見ていないだけ」と区別できない / R-3 の除外規定と同じ理由）
 *   対象外 = 実装ソース（assets/css/style.css ・ assets/js/*.js ・ site/** ・ tools/**）。
 *     ⚠️ ここでの `★` は「この判断は動かすな」という**来歴の印**であり、意図して書いている。
 *        公開リポで配信されるファイルではあるが、**読み手は実装者**であって利用者ではない。
 *     ⚠️ 対象に含めると現状で落ちる（`★` は 899f7ba 以前からの書き方である）。
 *        ⚠️ **落ちるから外したのではなく、面の性質が違うから外している。**
 *           来歴の印を消すと、次に読む人が★代表判断を「ただの実装」と読んで戻す。
 *     ⚠️ この線引きを変えるときは★代表判断。
 *
 * ★`⚠️` は対象にしない。README.md / CODING-RULES.md は本文としての注意喚起に使っており、
 *   社内記号ではない（公開文書の日本語として妥当である）。
 *
 * 判定 : 対象ファイルに `★` が1文字でもあれば違反
 * 終了コード: 0 = 違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
 *
 * ★走査の起点は引数で差し替えられる（tools/check-markers.mjs ・ check-verification.mjs と同じ形）。
 */

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSite, loadCategory, publishedCategories, partFile } from './site-data.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 社内記法。1文字でも公開物にあれば違反とする。 */
const MARK = '★';

/** 固定の公開物。⚠️ ここに実装ソースを足さない（上の線引きを参照）。 */
const FIXED = ['README.md', 'CODING-RULES.md', 'LICENSE', 'sitemap.xml', 'index.html'];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 走査対象を作る。
 * ⚠️ カテゴリ一覧と掲載デモの一覧を**ここで手書きしない**。site.json とカード定義から導く。
 *    手書きすると、カテゴリやパーツを足したときに検査の対象だけが取り残される。
 */
export async function notationTargets(root) {
  const site = await loadSite(root);
  const targets = [];
  for (const rel of FIXED) if (await exists(join(root, rel))) targets.push(rel);
  for (const category of publishedCategories(site)) {
    const page = `components/${category.slug}/index.html`;
    if (await exists(join(root, page))) targets.push(page);
    const data = await loadCategory(root, category.slug);
    for (const part of data.parts) {
      for (const kind of part.files) {
        const rel = partFile(category.slug, part.slug, kind);
        if (await exists(join(root, rel))) targets.push(rel);
      }
    }
  }
  return targets;
}

export async function checkNotation(root = DEFAULT_ROOT) {
  const targets = await notationTargets(root);
  const violations = [];
  for (const rel of targets) {
    const text = await readFile(join(root, rel), 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (line.includes(MARK)) violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  return { violations, scanned: targets.length };
}

export function reportNotation({ violations, scanned }) {
  console.log(`社内記法の検査: ${scanned} ファイル`);
  if (violations.length > 0) {
    console.error(`NG: 公開物に「${MARK}」が ${violations.length} 行`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error('  ★HTML コメントに書いた説明はそのまま配信される。説明は JSDoc 側へ置く。');
    return true;
  }
  console.log(`OK: 公開物に「${MARK}」は0件`);
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const result = await checkNotation(target ? resolve(target) : DEFAULT_ROOT);
  if (result.scanned === 0) {
    console.error('NG: 走査対象のファイルが0件。データかパスが違う');
    process.exitCode = 2;
    return;
  }
  if (reportNotation(result)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
