#!/usr/bin/env node
/**
 * 内部リンクの実在確認（Node 標準ライブラリのみ / 依存ゼロ）。
 *
 *   node tools/check-links.mjs
 *
 * なぜ要るのか
 *   相対パスかどうか（形式）は tools/check-paths.sh が見ているが、
 *   その先に本当にファイルがあるかは誰も見ていなかった。
 *   GitHub Pages は index.html の無いディレクトリを 404 にするため、
 *   ローカルのディレクトリ一覧表示に助けられて気づけない失敗形になる。
 *
 * 走査対象（tools/check-design.sh と同じ「外殻」の定義に揃える）
 *   - リポジトリ直下の生成ページ
 *   - components/{カテゴリ}/index.html（生成されるカテゴリ一覧）
 *   掲載デモ（components/{カテゴリ}/{パーツ}/ ・ utils/）と素材（media/）は対象外。
 *   デモは自分の中で完結しており、外殻のリンク規則を当てる相手ではない。
 *
 * 判定
 *   - 未生成のカテゴリ一覧ページへのリンク = 保留（カテゴリ一覧の生成は後続工程）
 *   - それ以外の到達不能なリンク           = 違反
 *   - 末尾スラッシュの無いディレクトリ参照 = 違反
 *
 * ⚠️ 末尾スラッシュの有無で判定を変えない。
 *    `./components/accordion` のような書き方はローカルの簡易サーバでは 301 でディレクトリ一覧が
 *    返って「動いて見える」が、公開先では 301 が挟まり、index.html が無ければ 404 になる。
 *    書き方を1文字変えるだけで検査が素通りしては、この検出器を置いた意味が消える。
 *
 * ⚠️ 保留を許すのは「カテゴリ一覧ページが1枚も生成されていない間」だけである。
 *    1枚でも生成されたら、残りの未生成も違反として落ちる（自動で厳しくなる）。
 *    保留を残したまま公開すると、リンクが 404 になるページを配ることになる。
 *
 * 終了コード: 0 = 違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
 */

import { readFile, readdir, access, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 外部・ページ内・スキームつきは対象外。 */
const SKIP = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * href / src / poster / srcset の値を抜き出す。
 *
 * ★プレビュー素材（動画と poster）が入る前に広げてある。
 *   入ってから広げると、既に死んでいるリンクの棚卸しから始まることになる。
 *   引用符は二重・単の両方を見る（片方だけだと書き方1つで検査が素通りする）。
 *
 * ⚠️ srcset は「URL 記述子」をカンマ区切りで並べる形式のため、
 *    値をそのまま1本のパスとして扱うと必ず外れる。カンマで割って先頭の URL だけを見る。
 */
function extractLinks(html) {
  const out = [];
  const re = /(href|src|poster|srcset)\s*=\s*(["'])([^"']*)\2/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attr = m[1].toLowerCase();
    const value = m[3];
    if (attr !== 'srcset') {
      out.push(value);
      continue;
    }
    for (const candidate of value.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) out.push(url);
    }
  }
  return out;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 1本のリンクが指すファイルの実パスを返す。
 * ★解決先がディレクトリなら、末尾スラッシュの有無にかかわらず index.html を要求する。
 *   末尾スラッシュが無い場合は、それ自体を違反として呼び出し側へ知らせる（`slashless`）。
 *
 * @returns {Promise<null | {target: string, slashless: boolean}>}
 */
async function resolveTarget(pagePath, href) {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '') return null;
  const base = dirname(join(ROOT, pagePath));
  const abs = resolve(base, clean);
  if (clean.endsWith('/')) return { target: join(abs, 'index.html'), slashless: false };
  const st = await stat(abs).catch(() => null);
  if (st?.isDirectory()) return { target: join(abs, 'index.html'), slashless: true };
  return { target: abs, slashless: false };
}

/** 走査対象の生成ページを集める。 */
async function collectPages() {
  const pages = [];
  for (const entry of await readdir(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) pages.push(entry.name);
  }
  if (await exists(join(ROOT, 'components'))) {
    for (const cat of await readdir(join(ROOT, 'components'), { withFileTypes: true })) {
      if (!cat.isDirectory()) continue;
      const rel = `components/${cat.name}/index.html`;
      if (await exists(join(ROOT, rel))) pages.push(rel);
    }
  }
  return pages.sort();
}

/**
 * @param {{path: string, html: string}[]} [given] 生成直後の HTML（省略時はディスクから読む）
 * @returns {Promise<{dead: string[], slashless: string[], pending: string[], scanned: number}>}
 */
export async function checkLinks(given) {
  const site = JSON.parse(await readFile(join(ROOT, 'site/data/site.json'), 'utf8'));
  const publishedSlugs = site.categories.filter((c) => c.status === 'published').map((c) => c.slug);

  // カテゴリ一覧ページが1枚でも実在したら、未生成を保留として見逃さない。
  let generatedCategoryPages = 0;
  for (const slug of publishedSlugs) {
    if (await exists(join(ROOT, 'components', slug, 'index.html'))) generatedCategoryPages += 1;
  }
  const pendingAllowed = generatedCategoryPages === 0;

  const pages = given ?? [];
  if (pages.length === 0) {
    for (const p of await collectPages()) pages.push({ path: p, html: await readFile(join(ROOT, p), 'utf8') });
  }

  const dead = [];
  const slashless = [];
  const pending = [];
  for (const page of pages) {
    for (const href of extractLinks(page.html)) {
      if (SKIP.test(href)) continue;
      const resolved = await resolveTarget(page.path, href);
      if (resolved === null) continue;

      const rel = relative(ROOT, resolved.target).split(sep).join('/');
      const label = `${page.path} → ${href}（実体 ${rel}）`;
      // ★末尾スラッシュ無しのディレクトリ参照は、実在の有無にかかわらず違反として落とす。
      //   保留（未生成のカテゴリ一覧）へ逃がさない — ここが唯一の抜け道になるため。
      if (resolved.slashless) {
        slashless.push(label);
        continue;
      }
      if (await exists(resolved.target)) continue;

      const m = /^components\/([^/]+)\/index\.html$/.exec(rel);
      if (m && publishedSlugs.includes(m[1]) && pendingAllowed) pending.push(label);
      else dead.push(label);
    }
  }
  return { dead, slashless, pending, scanned: pages.length };
}

/** 結果を人が読める形で出す。build と CLI の両方から使う。 */
export function reportLinks({ dead, slashless = [], pending, scanned }) {
  console.log(`内部リンク検査: 生成ページ ${scanned} 枚`);
  if (pending.length > 0) {
    console.warn(`⚠️ 未生成のカテゴリ一覧ページへのリンク ${pending.length} 本（現時点では 404 になる）`);
    for (const p of pending) console.warn(`  - ${p}`);
    console.warn('  ★この状態のまま公開ブランチへマージしない。カテゴリ一覧ページを生成してから公開する。');
  }
  if (slashless.length > 0) {
    console.error(`末尾スラッシュの無いディレクトリ参照 ${slashless.length} 本（公開先で 301 が挟まり、index.html が無ければ 404）`);
    for (const s of slashless) console.error(`  - ${s}`);
  }
  if (dead.length > 0) {
    console.error(`到達できない内部リンク ${dead.length} 本`);
    for (const d of dead) console.error(`  - ${d}`);
  }
  if (dead.length === 0 && slashless.length === 0 && pending.length === 0) {
    console.log('OK: 到達できない内部リンクは0件');
  }
}

async function main() {
  const result = await checkLinks();
  if (result.scanned === 0) {
    console.error('NG: 走査対象の生成ページが0件。パスが違う');
    process.exitCode = 2;
    return;
  }
  reportLinks(result);
  if (result.dead.length > 0 || result.slashless.length > 0) process.exitCode = 1;
}

// import しただけでは走らせない（テスト目的の読み込みで副作用を出さない）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
