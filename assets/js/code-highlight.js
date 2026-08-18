/**
 * コードの着色（外部ライブラリを入れない / 実行時依存ゼロ）。
 *
 * 使う色は8つだけで、いずれも「コード表示のためだけの色」である。
 * UI 側の色をここへ持ち込まない。ここの色を UI へ流用しない。
 *
 *   plain / punct / comment / keyword / name / attr / string / number
 *
 * ★着色は付加価値であって前提ではない。
 *   分解に失敗したら plain 一色へ落とす（それでも読めるし、コピーは何も損なわれない）。
 *   ⚠️ コピーする文字列は**元のテキスト**であり、この分解の結果ではない。
 *      分解が誤っても、コピーされる中身は1バイトも変わらない。
 *
 * ★DOM は textContent だけで組み立てる。
 *   HTML 文字列を作らないので、エスケープの取りこぼしという失敗形が最初から無い。
 *
 * ⚠️ 厳密なパーサではない。字面の分解である。
 *    行番号を出さない設計（コピー時の混入事故を発生源で断つ）とも整合している。
 */

const CLASS = 'c-code__tok';

/** 分解の種類。CSS 側のクラス名と1対1で対応する。 */
const TOKEN_TYPES = ['punct', 'comment', 'keyword', 'name', 'attr', 'string', 'number'];

/* ── JavaScript ─────────────────────────────────────────────── */

const JS_KEYWORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import',
  'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'super', 'switch', 'this',
  'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
]);

/**
 * JavaScript を分解する。
 * ⚠️ 正規表現リテラルと除算の区別はしない（字面では決まらない）。
 *    どちらも punct ＋ plain に落ちるだけで、読めなくはならない。
 */
function tokenizeJs(code) {
  const re =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|([{}()[\];:,.?!<>=+\-*/%&|^~]+)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push({ type: '', text: code.slice(last, m.index) });
    if (m[1]) out.push({ type: 'comment', text: m[1] });
    else if (m[2]) out.push({ type: 'string', text: m[2] });
    else if (m[3]) out.push({ type: 'number', text: m[3] });
    else if (m[4]) {
      const after = code.slice(re.lastIndex).match(/^\s*\(/);
      if (JS_KEYWORDS.has(m[4])) out.push({ type: 'keyword', text: m[4] });
      else if (after) out.push({ type: 'name', text: m[4] });
      else out.push({ type: '', text: m[4] });
    } else out.push({ type: 'punct', text: m[5] });
    last = re.lastIndex;
  }
  if (last < code.length) out.push({ type: '', text: code.slice(last) });
  return out;
}

/* ── CSS ────────────────────────────────────────────────────── */

/**
 * CSS を分解する。
 * ブロックの内側か外側かで、識別子の役割が変わる（外＝セレクタ / 内＝プロパティ名と値）。
 * その1点だけを状態として持つ。
 */
function tokenizeCss(code) {
  const re =
    /(\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b|\b\d[\d.]*(?:px|rem|em|%|s|ms|vh|vw|fr|deg|ch|ex|pt|vmin|vmax)?\b)|(--[\w-]+|[A-Za-z_-][\w-]*)|([{}()[\];:,>+~*.#$^|="'!])/g;
  const out = [];
  let last = 0;
  let depth = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push({ type: '', text: code.slice(last, m.index) });
    if (m[1]) out.push({ type: 'comment', text: m[1] });
    else if (m[2]) out.push({ type: 'string', text: m[2] });
    else if (m[3]) out.push({ type: 'keyword', text: m[3] });
    else if (m[4]) out.push({ type: 'number', text: m[4] });
    else if (m[5]) {
      const isProperty = depth > 0 && /^\s*:/.test(code.slice(re.lastIndex));
      if (isProperty) out.push({ type: 'attr', text: m[5] });
      else if (depth === 0) out.push({ type: 'name', text: m[5] });
      else out.push({ type: '', text: m[5] });
    } else {
      if (m[6] === '{') depth += 1;
      else if (m[6] === '}') depth = Math.max(0, depth - 1);
      out.push({ type: 'punct', text: m[6] });
    }
    last = re.lastIndex;
  }
  if (last < code.length) out.push({ type: '', text: code.slice(last) });
  return out;
}

/* ── HTML ───────────────────────────────────────────────────── */

/**
 * HTML を分解する。
 * タグの外にある文字（＝画面に出る本文）は plain のままにする。
 * ⚠️ タグの中だけを細かく見る。本文を色分けすると、コードではなく文章が模様になる。
 */
function tokenizeHtml(code) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[!/]?[A-Za-z][^>]*>|<!DOCTYPE[^>]*>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push({ type: '', text: code.slice(last, m.index) });
    const chunk = m[0];
    if (chunk.startsWith('<!--')) out.push({ type: 'comment', text: chunk });
    else if (/^<!/.test(chunk)) out.push({ type: 'keyword', text: chunk });
    else out.push(...tokenizeTag(chunk));
    last = re.lastIndex;
  }
  if (last < code.length) out.push({ type: '', text: code.slice(last) });
  return out;
}

/** 開始タグ・終了タグ1つぶんを分解する。 */
function tokenizeTag(tag) {
  const out = [];
  const re = /(^<\/?|\/?>$)|([A-Za-z_:][\w:.-]*)|("(?:[^"]*)"|'(?:[^']*)')|([=])/g;
  let last = 0;
  let seenName = false;
  let m;
  while ((m = re.exec(tag)) !== null) {
    if (m.index > last) out.push({ type: '', text: tag.slice(last, m.index) });
    if (m[1]) out.push({ type: 'punct', text: m[1] });
    else if (m[2]) {
      if (!seenName) {
        seenName = true;
        out.push({ type: 'name', text: m[2] });
      } else out.push({ type: 'attr', text: m[2] });
    } else if (m[3]) out.push({ type: 'string', text: m[3] });
    else out.push({ type: 'punct', text: m[4] });
    last = re.lastIndex;
  }
  if (last < tag.length) out.push({ type: '', text: tag.slice(last) });
  return out;
}

/* ── 入口 ───────────────────────────────────────────────────── */

const TOKENIZERS = { html: tokenizeHtml, css: tokenizeCss, js: tokenizeJs };

/**
 * コード文字列を、着色済みのノード列にして返す。
 *
 * @param {string} code   表示するコード（マーカー間を取り出したもの）
 * @param {'html'|'css'|'js'} kind
 * @returns {DocumentFragment}
 */
export function highlight(code, kind) {
  const fragment = document.createDocumentFragment();
  let tokens;
  try {
    const tokenize = TOKENIZERS[kind];
    tokens = tokenize ? tokenize(code) : [{ type: '', text: code }];
  } catch {
    // ★着色できないときは plain 一色に落とす。読めるしコピーもできる。
    fragment.append(document.createTextNode(code));
    return fragment;
  }

  for (const token of tokens) {
    if (token.text === '') continue;
    if (!token.type || !TOKEN_TYPES.includes(token.type)) {
      fragment.append(document.createTextNode(token.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = `${CLASS} ${CLASS}--${token.type}`;
    span.textContent = token.text;
    fragment.append(span);
  }
  return fragment;
}
