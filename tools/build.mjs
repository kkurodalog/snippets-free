#!/usr/bin/env node
/**
 * 生成スクリプト（Node 標準ライブラリのみ / 依存ゼロ）。
 *
 *   node tools/build.mjs
 *
 * 入力  : site/ 配下（データ・共通部分・ページ雛形）
 * 出力  : index.html ほか、リポジトリ直下の生成ページ
 *
 * 守っていること
 * - 掲載物（components/** ・ utils/** ・ media/**）へは README.md というファイル名以外
 *   書き込まない。ホワイトリストをコードで持つ。パスを1文字間違えてもデモを上書きできない。
 * - ルート絶対パス（`/` 始まり）を検出したら生成を止める。
 *   入力側は site/ 配下を走査する（assets/ は tools/check-paths.sh が見る）。出力側は全ページを見る。
 * - 生成ページに charset / viewport / 本体CSS が入っていることを検査する。
 * - 生成ページの内部リンクが実在するかを確認する（tools/check-links.mjs）。
 * - 全ページを検証してから書き出す。途中で落ちて一部だけ書き換わる状態を作らない。
 * - 整形・lint・バンドル・画像最適化を一切行わない。
 *
 * 終了コード: 0 = 成功 / 1 = 違反を検出して中止
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkLinks, reportLinks } from './check-links.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* ── 掲載物の保護 ───────────────────────────────────────────── */

/** 掲載物ディレクトリ。ここへの書き込みはファイル名ホワイトリストで縛る。
 *  ⚠️ utils/ にも掲載デモの実体がある（解体は後続工程）。それまでは保護対象である。
 *     tools/check-design.sh も utils/ を掲載デモとして走査から外しており、位置づけを揃えてある。 */
const PROTECTED_DIRS = ['components', 'media', 'utils'];
/** 掲載物ディレクトリ内で書き込みを許すファイル名。これ以外は拒否する。 */
const PROTECTED_ALLOW_BASENAMES = ['README.md'];

/**
 * 書き込んでよい場所かを判定する。許可した形だけを列挙し、それ以外は拒否する。
 *
 * 許可する形
 *   - 掲載物ディレクトリの外（リポジトリ直下の生成ページ・assets/ など）
 *   - components/{カテゴリ}/index.html … 生成するカテゴリ一覧ページ
 *   - components/{カテゴリ}/{パーツ}/README.md … 生成するパーツ README
 *   - media/**\/README.md
 *
 * 拒否する形
 *   - デモ本体（components/{カテゴリ}/{パーツ}/index.html ・ assets/**）
 *   - utils/** のすべて（掲載デモの実体。README.md 以外は書き込めない）
 *   - 素材（media/ 配下の動画・静止画）
 *   - リポジトリの外
 *
 * ⚠️ パスの組み立てを1文字間違えても、デモを上書きできない形にしておくためのもの。
 */
function assertWritable(outPath) {
  const rel = relative(ROOT, outPath);
  if (rel.startsWith('..')) {
    throw new Error(`リポジトリ外への書き込みを拒否した: ${outPath}`);
  }
  const segments = rel.split(sep);
  if (!PROTECTED_DIRS.includes(segments[0])) return;

  // components/{カテゴリ}/index.html はカタログ側の生成ページであり掲載物ではない
  if (segments[0] === 'components' && segments.length === 3 && segments[2] === 'index.html') return;

  const basename = segments[segments.length - 1];
  if (!PROTECTED_ALLOW_BASENAMES.includes(basename)) {
    throw new Error(
      `掲載物への書き込みを拒否した: ${rel}\n` +
        `  ${PROTECTED_DIRS.join(' / ')} 配下で書き込めるのは ` +
        `${PROTECTED_ALLOW_BASENAMES.join(' / ')} と components/{カテゴリ}/index.html だけ`
    );
  }
}

async function emit(relPath, content) {
  const outPath = join(ROOT, relPath);
  assertWritable(outPath);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, content, 'utf8');
  return relPath;
}

/* ── 検査 ─────────────────────────────────────────────────── */

/** ルート絶対パス（`/` 始まり。`//` は除く）。ローカルでは動き、本番配信でだけ壊れる形。 */
const ROOT_ABSOLUTE = /(?:href|src|poster|srcset)\s*=\s*["']\/(?!\/)|url\(\s*["']?\/(?!\/)/g;

function findRootAbsolute(label, text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    ROOT_ABSOLUTE.lastIndex = 0;
    if (ROOT_ABSOLUTE.test(line)) hits.push(`${label}:${i + 1}: ${line.trim()}`);
  });
  return hits;
}

const HEAD_REQUIRED = [
  { name: 'charset', re: /<meta\s+charset=/i },
  { name: 'viewport', re: /<meta\s+name="viewport"/i },
  { name: 'title', re: /<title>[^<]+<\/title>/i },
  { name: 'description', re: /<meta\s+name="description"\s+content="[^"]+"/i },
  { name: 'canonical', re: /<link\s+rel="canonical"/i },
  { name: 'og:title', re: /<meta\s+property="og:title"/i },
  { name: 'og:url', re: /<meta\s+property="og:url"/i },
  { name: 'favicon', re: /<link\s+rel="icon"/i },
  { name: '本体CSS', re: /<link\s+rel="stylesheet"\s+href="[^"]*assets\/css\/style\.css"/i },
];

function checkHead(label, html) {
  return HEAD_REQUIRED.filter((r) => !r.re.test(html)).map((r) => `${label}: <head> に ${r.name} が無い`);
}

/** 出力パスの深さから root を決める。手で相対階層を数える箇所をサイト内に作らないため。 */
function rootFor(relPath) {
  const depth = relPath.split('/').length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/* ── 本体 ─────────────────────────────────────────────────── */

async function main() {
  const errors = [];

  // (1) 入力の検査（site/ 配下にルート絶対パスが無いこと）
  const inputFiles = await walk(join(ROOT, 'site'));
  for (const file of inputFiles) {
    const text = await readFile(file, 'utf8');
    errors.push(...findRootAbsolute(relative(ROOT, file), text));
  }

  const site = JSON.parse(await readFile(join(ROOT, 'site/data/site.json'), 'utf8'));

  // (2) ページを組み立てる
  const { topPage } = await import('../site/templates/top.mjs');

  const specs = [{ path: 'index.html', render: (root) => topPage({ site, root, pagePath: '' }) }];

  // (3) 全ページを組み立てて検証する。★書き出しはこの後にまとめて行う。
  //     1枚書いてから次で落ちると、生成物が中途半端に混ざった状態になるため。
  /** @type {{path: string, html: string}[]} */
  const pages = [];
  for (const spec of specs) {
    const html = spec.render(rootFor(spec.path));
    errors.push(...findRootAbsolute(spec.path, html));
    errors.push(...checkHead(spec.path, html));
    pages.push({ path: spec.path, html });
  }

  if (errors.length > 0) {
    console.error('生成を中止した。以下を直すこと。\n');
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  // (4) 書き出す
  const written = [];
  for (const p of pages) written.push(await emit(p.path, p.html));

  console.log(`生成: ${written.length} ファイル`);
  for (const w of written) console.log(`  - ${w}`);

  // (5) 書き出したページの内部リンクが実在するかを見る。
  //     ここでは生成を止めない（未生成のカテゴリ一覧は後続工程の範囲）。
  //     ただし黙って通さない。落とす判定は tools/check-links.mjs 側が持つ。
  console.log('');
  reportLinks(await checkLinks(pages));
}

// import しただけでは走らせない（テスト目的の読み込みでファイルが書き換わるのを防ぐ）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

export { assertWritable, findRootAbsolute, checkHead, rootFor, main };
