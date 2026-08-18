#!/usr/bin/env node
/**
 * 生成スクリプト（Node 標準ライブラリのみ / 依存ゼロ）。
 *
 *   node tools/build.mjs
 *
 * 入力  : site/ 配下（データ・共通部分・ページ雛形）
 * 出力  : index.html / components/{カテゴリ}/index.html / sitemap.xml
 *
 * 守っていること
 * - 掲載物（components/** ・ utils/** ・ media/**）へは README.md というファイル名以外
 *   書き込まない。ホワイトリストをコードで持つ。パスを1文字間違えてもデモを上書きできない。
 *   例外は components/{カテゴリ}/index.html（カタログ側の生成ページであり掲載物ではない）。
 * - ルート絶対パス（`/` 始まり）を検出したら生成を止める。
 *   入力側は site/ 配下を走査する（assets/ は tools/check-paths.sh が見る）。出力側は全ページを見る。
 * - 生成ページに charset / viewport / 本体CSS が入っていることを検査する。
 * - カード定義（files[]）と実ファイルが食い違ったら生成を止める。
 * - 収録シナリオの欠落を報告する（撮り忘れを機械で拾う）。
 * - 生成ページの内部リンクが実在するかを確認する（tools/check-links.mjs）。
 * - 全ページを検証してから書き出す。途中で落ちて一部だけ書き換わる状態を作らない。
 * - 整形・lint・バンドル・画像最適化を一切行わない。
 *
 * ★テンプレート記法を1つも定義していない。雛形は文字列を返す関数で、
 *   繰り返しは .map().join('')、分岐は三項演算子で書く。パーサを書かない。
 *
 * 終了コード: 0 = 成功 / 1 = 違反を検出して中止
 */

import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkLinks, reportLinks } from './check-links.mjs';
import {
  loadSite,
  loadCategory,
  publishedCategories,
  partDir,
  partFile,
  scenarioFile,
  mediaFiles,
  topMediaFiles,
  PART_FILES,
  TAGS,
  PREVIEWS,
  PREVIEW_ASPECTS,
} from './site-data.mjs';

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

async function exists(rel) {
  try {
    await access(join(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

/* ── カード定義の検査 ───────────────────────────────────────── */

/**
 * カード定義（site/data/{カテゴリ}.json）と実ファイルを突き合わせる。
 *
 * ★食い違いは警告ではなく違反として扱う（生成を止める）。
 *   files[] はカードのボタン構成を決める唯一の入力であり、実ファイルとずれると
 *   「押したら空」または「あるのにボタンが出ない」が直接起きる。
 *   どちらも保留にする理由が無い（後続工程を待って解決する類の食い違いではない）。
 */
async function checkCategoryData(category) {
  const errors = [];
  const where = `site/data/${category.slug}.json`;

  if (!PREVIEWS.includes(category.preview)) {
    errors.push(`${where}: preview は ${PREVIEWS.join(' / ')} のいずれか（${category.preview}）`);
  }
  if (!PREVIEW_ASPECTS.includes(category.previewAspect)) {
    errors.push(`${where}: previewAspect は ${PREVIEW_ASPECTS.join(' / ')} のいずれか`);
  }
  if (!category.name || !category.description) {
    errors.push(`${where}: name と description は必須`);
  }

  const featured = category.parts.filter((p) => p.featured);
  if (featured.length > 1) {
    errors.push(`${where}: featured はカテゴリに1件まで（${featured.length}件）`);
  }

  const seen = new Set();
  for (const part of category.parts) {
    const id = `${where} / ${part.slug}`;
    if (seen.has(part.slug)) errors.push(`${id}: slug が重複している`);
    seen.add(part.slug);

    if (!part.name) errors.push(`${id}: name が無い`);
    if (!(await exists(partDir(category.slug, part.slug)))) {
      errors.push(`${id}: パーツのディレクトリが実在しない`);
      continue;
    }

    for (const tag of part.tags ?? []) {
      if (!TAGS.includes(tag)) errors.push(`${id}: 未定義のタグ「${tag}」`);
    }
    if (part.article && !/^https:\/\//.test(part.article)) {
      errors.push(`${id}: article は https:// で始まる絶対 URL にする`);
    }

    // files[] と実ファイルを両方向で突き合わせる。
    // 片方向だけだと「宣言したのに無い」か「あるのに出していない」のどちらかを見逃す。
    const declared = new Set(part.files ?? []);
    for (const kind of declared) {
      if (!PART_FILES[kind]) {
        errors.push(`${id}: 未定義のファイル種別「${kind}」`);
        continue;
      }
      if (!(await exists(partFile(category.slug, part.slug, kind)))) {
        errors.push(`${id}: files に ${kind} があるが実ファイルが無い（押したら空になる）`);
      }
    }
    for (const kind of Object.keys(PART_FILES)) {
      if (declared.has(kind)) continue;
      if (await exists(partFile(category.slug, part.slug, kind))) {
        errors.push(`${id}: ${kind} の実ファイルがあるのに files に入っていない`);
      }
    }
    if (declared.size === 0) errors.push(`${id}: files が空`);
  }

  return errors;
}

/**
 * 収録シナリオの欠落を見る。
 *
 * 対象
 *   - 動画カテゴリの全パーツ（カード用の card.webm）
 *   - トップに出る代表パーツ（featured / トップ用の top.webm）
 *
 * ⚠️ シナリオが1本も無いあいだは保留にする（収録は後続工程の作業）。
 *    ★保留が消える条件を先に書く — **1本でもシナリオが現れたら、残りの欠落は違反**にする。
 *    収録はカテゴリ単位で進むため、1本置かれた時点で残りは取りこぼしである。
 */
async function checkScenarios(categories) {
  const required = [];
  for (const category of categories) {
    for (const part of category.parts) {
      const needsCard = category.preview === 'video';
      const needsTop = Boolean(part.featured);
      if (needsCard || needsTop) required.push(scenarioFile(category.slug, part.slug));
    }
  }
  const missing = [];
  let present = 0;
  for (const rel of required) {
    if (await exists(rel)) present += 1;
    else missing.push(rel);
  }
  return { missing, present, started: present > 0 };
}

/* ── 本体 ─────────────────────────────────────────────────── */

/** sitemap.xml。絶対 URL を書いてよい数少ない場所の1つ。 */
function sitemap(site, paths) {
  const urls = paths
    .map((p) => `  <url><loc>${site.siteOrigin}${p}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

async function main() {
  const errors = [];

  // (1) 入力の検査（site/ 配下にルート絶対パスが無いこと）
  const inputFiles = await walk(join(ROOT, 'site'));
  for (const file of inputFiles) {
    const text = await readFile(file, 'utf8');
    errors.push(...findRootAbsolute(relative(ROOT, file), text));
  }

  const site = await loadSite(ROOT);
  const categories = [];
  for (const meta of publishedCategories(site)) {
    const data = await loadCategory(ROOT, meta.slug);
    categories.push({ ...meta, ...data });
  }

  // ★公開カテゴリが0件なら、以降の「違反0件」は合格ではなく未走査である。
  if (categories.length === 0) {
    errors.push('site/data/site.json: 公開カテゴリが0件。データが違う');
  }

  // (2) カード定義と実ファイルの突合
  for (const category of categories) errors.push(...(await checkCategoryData(category)));

  // (3) 収録シナリオの欠落
  const scenarios = await checkScenarios(categories);
  if (scenarios.started) {
    for (const rel of scenarios.missing) errors.push(`収録シナリオが無い: ${rel}`);
  }

  // (4) プレビュー素材の有無を先に調べる。無いパーツは「準備中」の窓で組む。
  const mediaMissing = [];
  const mediaMap = new Map();
  for (const category of categories) {
    for (const part of category.parts) {
      const card = mediaFiles(category.slug, part.slug);
      const top = topMediaFiles(category.slug, part.slug);
      const hasCard = (await exists(card.video)) && (await exists(card.poster));
      const hasTop = (await exists(top.video)) && (await exists(top.poster));
      mediaMap.set(`${category.slug}/${part.slug}`, { hasCard, hasTop, card, top });
      if (category.preview === 'video' && !hasCard) mediaMissing.push(card.video);
      if (part.featured && !hasTop) mediaMissing.push(top.video);
    }
  }

  // (5) ページを組み立てる
  const { topPage } = await import('../site/templates/top.mjs');
  const { categoryPage } = await import('../site/templates/category.mjs');

  /** カテゴリ一覧のカード用。素材が無ければ undefined を返し、テンプレートが準備中の窓に落とす。 */
  const mediaForOf = (category, root) => (part) => {
    const m = mediaMap.get(`${category.slug}/${part.slug}`);
    if (!m || !m.hasCard) return {};
    return { video: root + m.card.video, poster: root + m.card.poster };
  };

  /** トップのショーケース用。代表パーツの 3:2 素材を使う。 */
  const topMediaFor = (root) => (category) => {
    const featured = category.parts.find((p) => p.featured);
    if (!featured) return {};
    const m = mediaMap.get(`${category.slug}/${featured.slug}`);
    if (!m || !m.hasTop) return {};
    return { video: root + m.top.video, poster: root + m.top.poster };
  };

  const specs = [
    {
      path: 'index.html',
      render: (root) => topPage({ site, categories, root, pagePath: '', topMediaFor: topMediaFor(root) }),
    },
    ...categories.map((category) => ({
      path: `components/${category.slug}/index.html`,
      render: (root) =>
        categoryPage({
          site,
          category,
          root,
          pagePath: `components/${category.slug}/`,
          mediaFor: mediaForOf(category, root),
        }),
    })),
  ];

  // (6) 全ページを組み立てて検証する。★書き出しはこの後にまとめて行う。
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

  // (7) 書き出す
  const written = [];
  for (const p of pages) written.push(await emit(p.path, p.html));
  written.push(
    await emit('sitemap.xml', sitemap(site, ['', ...categories.map((c) => `components/${c.slug}/`)]))
  );

  console.log(`生成: ${written.length} ファイル`);
  for (const w of written) console.log(`  - ${w}`);

  // (8) 素材とシナリオの残りを報告する。黙って通さない。
  if (scenarios.missing.length > 0) {
    console.warn('');
    console.warn(`⚠️ 収録シナリオ未作成 ${scenarios.missing.length} 件（収録は後続工程）`);
    console.warn('  ★1本でも作られた時点で、残りは違反として生成が止まる。');
  }
  if (mediaMissing.length > 0) {
    console.warn(`⚠️ プレビュー素材未投入 ${mediaMissing.length} 件（該当の窓は「準備中」で組んだ）`);
    console.warn('  素材を所定のパスへ置いて生成し直せば、そのまま <video> に切り替わる。');
  }

  // (9) 書き出したページの内部リンクが実在するかを見る。
  //     ⚠️ 落とす判定は tools/check-links.mjs 側が持つ。ここは報告だけである。
  //        したがって **build 単体では死にリンクがあっても exit 0 になる**。
  //        そのことを出力にも1行出す — 書かないと「build が通ったから大丈夫」と読まれ、
  //        公開ゲートが `npm run check` を必ず通すことに依存している事実が見えなくなる。
  console.log('');
  reportLinks(await checkLinks(pages));
  console.log('※ 内部リンクの合否は npm run check:links が持つ（build はここで止めない）');
}

// import しただけでは走らせない（テスト目的の読み込みでファイルが書き換わるのを防ぐ）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

export { assertWritable, findRootAbsolute, checkHead, rootFor, main };
