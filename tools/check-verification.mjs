#!/usr/bin/env node
/**
 * 検証データ（モーダルの検証行）の検査（Node 標準ライブラリのみ / 依存ゼロ）。
 *
 *   node tools/check-verification.mjs
 *   node tools/check-verification.mjs . --require-verified
 *
 * 何を見るか
 *   モーダルの検証行は「掲載基準4項目のどれを満たしたか」を画面で述べる唯一の面である。
 *   述べる根拠は実測であり、実測の記録は site/data/verification-clearance.json にある。
 *   ★カード定義（site/data/{カテゴリ}.json）の verification / verifiedOn が、
 *     記録と一字一句そろっていることを見る。
 *
 * なぜ2ファイルに分けるか
 *   1ファイルに置くと「画面に出したい」と「実測して確かめた」が1回の編集で同時に動く。
 *   分けたうえで一致を機械で見れば、確かめずに表示だけ足すことができない。
 *   ⚠️ 注意書きで縛らないのは、注意書きを読まない経路（別の作業ついでの編集）が素通りするためである。
 *
 * 判定
 *   - 記録があり、verification が記録と完全一致           = 合格
 *   - 記録が無いのに verification / verifiedOn がある      = 違反（実測していないことを画面で述べる）
 *   - 記録と値・日付が食い違う                             = 違反
 *   - 記録があるのに実在しないパーツを指している           = 違反（古い記録の置き去り）
 *     ⚠️ ★**この1件だけは生成（tools/build.mjs）では落ちない。** 生成と共有しているのは
 *        verificationErrors()（パーツ単位）であり、置き去りの判定は下の checkVerification()
 *        の走査側にしかない。**生成はパーツを回るため、どのパーツにも属さない記録が見えない。**
 *        ⚠️ 落ちるのは `npm run check`（および `check:release`）である。
 *        ⚠️ 実害は小さい（置き去りの記録だけでは画面に何も出ない）が、**主張を仕掛けより広く書かない**
 *           ため明記する。「生成と検査が同じ1本を呼ぶ」のは**5種の判定のうち4種**である。
 *   - verification がまったく無い                          = 保留（実測は後続工程）
 *
 * ★公開ゲート（--require-verified）
 *    公開の判定では保留を1件も許さない。掲載基準を述べない状態（「検証情報は準備中」）で
 *    公開しないためである。既定では保留のままにして、日常の検査を赤くしない。
 *
 * 終了コード: 0 = 違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
 *
 * ★走査の起点は引数で差し替えられる（tools/check-markers.mjs と同じ形）。
 *   「違反で落ちること」を確かめるとき、掲載デモを書き換えずに済ませるための口である。
 */

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  loadSite,
  loadCategory,
  loadClearance,
  publishedCategories,
  VERIFICATION_ITEMS,
  VERIFIED_ON,
} from './site-data.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 記録の引き当てキー。カテゴリを跨いで同じ slug が使えるため、カテゴリ名を含める。 */
export function clearanceKey(categorySlug, partSlug) {
  return `${categorySlug}/${partSlug}`;
}

/**
 * 1パーツ分の突き合わせ。生成（tools/build.mjs）と検査の両方がこの1本を呼ぶ。
 * ⚠️ 2箇所に書くと、片方だけ直したときに「生成は通るが検査は落ちる」が起きる。
 *
 * @returns {string[]} 違反の説明（0件なら合格）
 */
export function verificationErrors(categorySlug, part, clearance, id = `${categorySlug} / ${part.slug}`) {
  const errors = [];
  const keys = VERIFICATION_ITEMS.map((i) => i.key);
  const record = (clearance?.cleared ?? {})[clearanceKey(categorySlug, part.slug)];

  if (!record) {
    if (part.verification !== undefined || part.verifiedOn !== undefined) {
      errors.push(
        `${id}: 掲載基準の確認済み記録が無いのに verification がある` +
          `（site/data/verification-clearance.json に実測の記録を先に置く）`
      );
    }
    return errors;
  }

  // 記録そのものの形。記録が壊れていると、突き合わせが素通りする。
  if (!VERIFIED_ON.test(record.on ?? '')) {
    errors.push(`${id}: 確認済み記録の on は YYYY-MM-DD で書く`);
  }
  const items = record.items;
  if (typeof items !== 'object' || items === null || Array.isArray(items)) {
    errors.push(`${id}: 確認済み記録の items はオブジェクトにする`);
    return errors;
  }
  for (const key of Object.keys(items)) {
    if (!keys.includes(key)) errors.push(`${id}: 確認済み記録に未定義の項目「${key}」`);
  }
  for (const key of keys) {
    if (typeof items[key] !== 'boolean') {
      errors.push(`${id}: 確認済み記録の items.${key} を true / false で書く（4項目すべて必要）`);
    }
  }
  if (errors.length > 0) return errors;

  // カード定義との一致。★満たさなかった項目も記録どおりに出す（黙って落とさない）。
  if (part.verification === undefined) {
    errors.push(`${id}: 確認済み記録があるのに verification が無い（記録した結果を画面に出していない）`);
    return errors;
  }
  if (typeof part.verification !== 'object' || part.verification === null) {
    return errors; // 形の誤りは tools/build.mjs の既存の検査が述べる
  }
  for (const key of keys) {
    if (part.verification[key] !== items[key]) {
      errors.push(
        `${id}: verification.${key} が確認済み記録と違う（記録 ${items[key]} / カード定義 ${part.verification[key]}）`
      );
    }
  }
  if (part.verifiedOn !== record.on) {
    errors.push(`${id}: verifiedOn が確認済み記録の実測日と違う（記録 ${record.on} / カード定義 ${part.verifiedOn}）`);
  }
  return errors;
}

export async function checkVerification(root = DEFAULT_ROOT) {
  const site = await loadSite(root);
  const clearance = await loadClearance(root);
  const violations = [];
  const pending = [];
  const seenKeys = new Set();
  let scanned = 0;

  for (const category of publishedCategories(site)) {
    const data = await loadCategory(root, category.slug);
    for (const part of data.parts) {
      scanned += 1;
      seenKeys.add(clearanceKey(category.slug, part.slug));
      violations.push(...verificationErrors(category.slug, part, clearance));
      if (part.verification === undefined) pending.push(clearanceKey(category.slug, part.slug));
    }
  }

  // 置き去りの記録。実在しないパーツの記録が残ると、件数だけが実態より多く見える。
  for (const key of Object.keys(clearance.cleared ?? {})) {
    if (!seenKeys.has(key)) violations.push(`${key}: 確認済み記録があるが、そのパーツがカード定義に無い`);
  }

  return { violations, pending, scanned };
}

export function reportVerification({ violations, pending, scanned }, { requireVerified = false } = {}) {
  console.log(
    `検証データ検査: ${scanned} パーツ${requireVerified ? '（公開ゲート / 未実測を違反として扱う）' : ''}`
  );
  if (pending.length > 0) {
    if (requireVerified) {
      console.error(`NG: 掲載基準の実測が済んでいない ${pending.length} パーツ`);
      for (const p of pending) console.error(`  - ${p}`);
      console.error('  ★モーダルの検証行は「検証情報は準備中」と出る。掲載基準を述べないまま公開しない。');
    } else {
      console.warn(`⚠️ 掲載基準の実測が未了 ${pending.length} パーツ（実測は後続工程）`);
      console.warn('  ★公開してよいかは `node tools/check-verification.mjs . --require-verified` で判定する。');
    }
  }
  if (violations.length > 0) {
    console.error(`検証データの違反 ${violations.length} 件`);
    for (const v of violations) console.error(`  - ${v}`);
  }
  const failed = violations.length > 0 || (requireVerified && pending.length > 0);
  if (!failed) console.log('OK: 検証データの違反は0件');
  return failed;
}

async function main() {
  const args = process.argv.slice(2);
  const requireVerified = args.includes('--require-verified');
  const target = args.find((a) => !a.startsWith('--'));

  const result = await checkVerification(target ? resolve(target) : DEFAULT_ROOT);
  if (result.scanned === 0) {
    console.error('NG: 走査対象のパーツが0件。データかパスが違う');
    process.exitCode = 2;
    return;
  }
  const failed = reportVerification(result, { requireVerified });
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
