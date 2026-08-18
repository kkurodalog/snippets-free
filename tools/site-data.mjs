/**
 * サイトデータの読み込み（生成スクリプトと検出器の共通の入口）。
 *
 * データは2層に分かれている。
 *   site/data/site.json        … サイト共通（カテゴリの一覧・外部リンク・オリジン）
 *   site/data/{カテゴリ}.json  … そのカテゴリのカード定義
 *
 * ⚠️ カテゴリ別に分けているのは、実装をカテゴリ単位で回すためである。
 *    1ファイルに集めると、1カテゴリ触るたびに全件の差分が出る。
 *
 * ⚠️ プレビュー方式（実DOM再生 / 動画）は**カテゴリ側**に持たせている。
 *    パーツ側に持たせるとカテゴリ内で混在させられてしまう（混在させないことが確定事項）。
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PART_FILES } from '../site/partials/parts.mjs';

export { PART_FILES, PART_FILE_LABELS, TAGS, PREVIEWS, PREVIEW_ASPECTS } from '../site/partials/parts.mjs';

/**
 * ⚠️ `publishedCategories()` はここで定義せず、画面側と同じ1本を再輸出する。
 *    2箇所に置くと、片方だけ直したときに「画面のナビに出るカテゴリ」と
 *    「生成・検査の対象カテゴリ」がずれる（出ているのに生成されない／その逆）。
 */
export { publishedCategories } from '../site/partials/html.mjs';

export async function loadSite(root) {
  return JSON.parse(await readFile(join(root, 'site/data/site.json'), 'utf8'));
}

/**
 * カテゴリのカード定義を読む。
 * ⚠️ 中身が0件のカテゴリもファイルは置く（「準備中」の一覧ページを生成するため）。
 */
export async function loadCategory(root, slug) {
  const data = JSON.parse(await readFile(join(root, `site/data/${slug}.json`), 'utf8'));
  return { parts: [], ...data, slug };
}

/** パーツのディレクトリ（リポジトリ相対）。 */
export function partDir(categorySlug, partSlug) {
  return `components/${categorySlug}/${partSlug}`;
}

/** パーツの1ファイル（リポジトリ相対）。存在確認もリンク生成もこの関数を通す。 */
export function partFile(categorySlug, partSlug, kind) {
  const tail = PART_FILES[kind];
  if (!tail) throw new Error(`未定義のファイル種別: ${kind}`);
  return `${partDir(categorySlug, partSlug)}/${tail}`;
}

/** 収録シナリオ（動画プレビューの撮影手順）のパス。 */
export function scenarioFile(categorySlug, partSlug) {
  return `tools/capture/scenarios/${categorySlug}/${partSlug}.mjs`;
}

/** プレビュー素材（カード用の動画と poster）のパス。 */
export function mediaFiles(categorySlug, partSlug) {
  return {
    video: `media/${categorySlug}/${partSlug}/card.webm`,
    poster: `media/${categorySlug}/${partSlug}/card.jpg`,
  };
}

/** トップのショーケース用の素材（3:2 に揃えたもの）。 */
export function topMediaFiles(categorySlug, partSlug) {
  return {
    video: `media/${categorySlug}/${partSlug}/top.webm`,
    poster: `media/${categorySlug}/${partSlug}/top.jpg`,
  };
}
