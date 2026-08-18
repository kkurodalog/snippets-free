#!/usr/bin/env node
/**
 * 読み上げ名に可視テキストが含まれているかの検査（WCAG 2.5.3 Label in Name / Level A）。
 *
 *   node tools/check-label-in-name.mjs
 *
 * なぜ機械に載せるか
 *   ★本案件で**3回**、読み上げ名と実物が食い違った。
 *     (1) コードボタンの aria-label が「HTML を表示」なのに、押すとデモの描画ページが開いた
 *     (2) コピーボタンの可視ラベルとアクセシブル名
 *     (3) ソースリンクの可視ラベルを変えたのに aria-label が追随しなかった（2026-08-18）
 *   ⚠️ **(3) の直接原因は「同じ文字列を2箇所に書き、片方だけ直した」ことである。**
 *
 * ★捕らえられる範囲 — **生成物の静的な HTML に書かれた `aria-label`**。
 *   `<a>` / `<button>` に `aria-label` があり、かつ可視テキストを持つものを突き合わせる。
 *   ⚠️ `aria-hidden="true"` の子（`↗` 等）は可視テキストから外す。読み上げ名にも入らないためである。
 *   ⚠️ 可視テキストを持たない操作要素（アイコンだけのボタン等）は 2.5.3 の対象外なので飛ばす。
 *   ⚠️ landmark（`<nav aria-label>`）・`role="tablist"` 等の**容器は対象外**。
 *      子孫のテキストはその要素のラベルではない。**対象を操作要素に絞るのはこのためである。**
 *
 * ★捕らえられない範囲（**書いておかないと「見ていないだけ」と区別できない**）
 *   ⚠️ **見るのは `<a>` と `<button>` の `aria-label` だけである。** 次の4つは**対象外**であり、
 *      **現在の生成物には1件も無い**が、テンプレートが変われば静かに素通りする。
 *        - `<summary>` / `<input>` / `[role="button"]` 等、`<a>` `<button>` 以外の操作要素
 *        - `title` 属性で名前を与えている要素
 *        - `aria-labelledby` で名前を与えている要素
 *        - `<a>` / `<button>` が同じタグで入れ子になっている形（これは違反として落とす）
 *      ⚠️ **対象を広げると偽陽性の切り分けをやり直すことになる。広げる判断は★代表判断。**
 *      ⚠️ **実装記録の実 DOM 走査（12種の操作要素 × aria-label / aria-labelledby / title）と
 *         この常設の検査は範囲が違う。** 広いほうを常設と読み違えないこと。
 *   ⚠️ **JavaScript が実行時に設定する名前**（`setAttribute('aria-label', …)`）。
 *      **今回壊れたのはまさにここである。** 静的な生成物には現れない。
 *   ★そちらは**検査ではなく構造で閉じてある** — `assets/js/code-modal.js` の `applyLabel()` が
 *     **可視ラベルの `<span>` からテキストを読み取って名前を組み立てる**。
 *     **同じ文字列を2箇所に書かないので、食い違いが起こりようがない。**
 *     ⚠️ 実行時の名前を目で確かめたいときは、実 DOM を走査する（フェーズごとの実測でやっている）。
 *
 * 判定 : 可視テキストが読み上げ名に含まれていなければ違反
 * 終了コード: 0 = 違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
 *
 * ★走査の起点は引数で差し替えられる（他の check-* と同じ形）。
 */

import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSite, publishedCategories } from './site-data.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 空白と実体参照をならす。比較は「詰めた文字列」で行う（改行や字下げで割れないため）。 */
function normalize(text) {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, '');
}

/** aria-hidden の子を落としてからタグを剥がす。 */
function visibleText(inner) {
  const withoutHidden = inner.replace(/<([a-z]+)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  return normalize(withoutHidden.replace(/<[^>]*>/g, ' '));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 生成物の一覧。⚠️ 手書きしない（site.json から導く）。 */
export async function generatedPages(root) {
  const site = await loadSite(root);
  const pages = [];
  if (await exists(join(root, 'index.html'))) pages.push('index.html');
  for (const category of publishedCategories(site)) {
    const rel = `components/${category.slug}/index.html`;
    if (await exists(join(root, rel))) pages.push(rel);
  }
  return pages;
}

export async function checkLabelInName(root = DEFAULT_ROOT) {
  const pages = await generatedPages(root);
  const violations = [];
  let scanned = 0;
  let checked = 0;

  for (const rel of pages) {
    const html = await readFile(join(root, rel), 'utf8');
    scanned += 1;
    for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      const [, tag, attrs, inner] = m;
      // ⚠️ 同じタグが入れ子になっていたら、非貪欲の切り出しが誤る。黙って通さず違反にする。
      if (new RegExp(`<${tag}\\b`, 'i').test(inner)) {
        violations.push(`${rel}: <${tag}> が入れ子になっており読み取れない（検査を通さない形にする）`);
        continue;
      }
      // ⚠️ 引用符は両方受ける。二重引用符に固定していたため、**自分が宣言した範囲の内側で**
      //    `aria-label='…'` を黙って通していた（2026-08-18 に是正）。
      const label = /aria-label=(?:"([^"]*)"|'([^']*)')/.exec(attrs);
      if (!label) continue;
      const labelText = label[1] !== undefined ? label[1] : label[2];
      const visible = visibleText(inner);
      if (!visible) continue; // 可視テキストが無ければ 2.5.3 の対象外
      checked += 1;
      if (!normalize(labelText).includes(visible)) {
        violations.push(
          `${rel}: 可視テキスト「${visible}」が読み上げ名「${labelText}」に含まれていない`
        );
      }
    }
  }
  return { violations, scanned, checked };
}

export function reportLabelInName({ violations, scanned, checked }) {
  console.log(`読み上げ名の検査: 生成ページ ${scanned} 枚 / 可視ラベルを持つ操作要素 ${checked} 件`);
  if (violations.length > 0) {
    console.error(`NG: 可視テキストが読み上げ名に含まれていない ${violations.length} 件`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error('  ★可視テキストを別の言い回しで置き換えない。**含める**（WCAG 2.5.3）。');
    return true;
  }
  console.log('OK: 読み上げ名の違反は0件');
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const result = await checkLabelInName(target ? resolve(target) : DEFAULT_ROOT);
  if (result.scanned === 0) {
    console.error('NG: 走査対象の生成ページが0件。データかパスが違う');
    process.exitCode = 2;
    return;
  }
  if (reportLabelInName(result)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
