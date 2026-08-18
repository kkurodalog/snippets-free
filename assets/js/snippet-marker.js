/**
 * 掲載範囲マーカーの解釈（ブラウザと Node の両方から使う唯一の実装）。
 *
 * 掲載デモの中で「コピーしてそのまま貼れる範囲」を囲む印である。
 * 規約そのものは CODING-RULES.md「掲載範囲マーカー」に書いてある。ここはその実装。
 *
 *   HTML     <!-- snippet:start -->  …  <!-- snippet:end -->
 *   CSS / JS ブロックコメントで同じトークンを囲む（開始と終了の記号だけが変わる）
 *
 * 決めたこと
 * - トークンは3言語とも `snippet:start` / `snippet:end` の同一文字列。
 *   違うのはコメントの囲みだけであり、下の正規表現1本ですべて読める。
 * - 行の中身はマーカーだけにする。同じ行に他の記述を混ぜない。
 *   （混ざると「どこまでがマーカーか」を字面で判定できなくなる）
 * - JS でも行コメント（//）を使わず block コメントに揃える。
 *   形を1つに絞ることで、正規表現の分岐と「どちらで書くか」の迷いを同時に消す。
 * - 1ファイルに1組だけ。入れ子・複数組・片側だけは、いずれも異常として区別して返す。
 *
 * ⚠️ 表示範囲とコピー範囲は必ずこの関数の戻り値で揃える。
 *    片方だけ別の経路で作ると「見えているものと違うものがコピーされる」状態になる。
 */

/**
 * マーカー1行に一致する唯一の正規表現。
 * 捕捉グループ1 が "start" / "end" を返す。
 */
export const SNIPPET_MARKER = /^[ \t]*(?:<!--|\/\*)[ \t]*snippet:(start|end)[ \t]*(?:-->|\*\/)[ \t]*$/;

/** 抽出結果の状態。呼び出し側はこの文字列で分岐する。 */
export const MARKER_STATUS = {
  OK: 'ok', // 正常な1組
  NONE: 'none', // マーカーが1つも無い（未埋め込み）
  UNPAIRED: 'unpaired', // 片側だけ / 終了が開始より前
  NESTED: 'nested', // 開始の内側にもう1つ開始がある
  MULTIPLE: 'multiple', // 組が2つ以上ある
};

/**
 * 行頭がコメントで始まる行かどうか。
 * ⚠️ 厳密なパーサではない。行の先頭がコメント開始である場合だけを見る。
 *    コードの末尾に付いた行内コメントは対象外である（規約側で「マーカー内に解説を書かない」と定める）。
 */
const COMMENT_LINE = /^[ \t]*(?:<!--|\/\*|\/\/|\*)/;

/** 日本語（かな・カナ・漢字・半角カナ）を含むか。 */
const CJK = /[ぁ-ゟ゠-ヿ一-鿿ｦ-ﾝ]/;

/**
 * マーカーの位置を数える。
 * @param {string[]} lines
 * @returns {{index: number, kind: 'start' | 'end'}[]}
 */
function findMarkers(lines) {
  const found = [];
  lines.forEach((line, index) => {
    const m = SNIPPET_MARKER.exec(line);
    if (m) found.push({ index, kind: m[1] });
  });
  return found;
}

/**
 * 共通の字下げを外す。マーカーが深い位置にあっても、貼ったときに先頭が揃う。
 * ⚠️ 実ファイルは書き換えない。表示側の処理である。
 */
function dedent(lines) {
  let min = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.length - line.replace(/^[ \t]*/, '').length;
    if (indent < min) min = indent;
  }
  if (!Number.isFinite(min) || min === 0) return lines;
  return lines.map((line) => (line.trim() === '' ? line : line.slice(min)));
}

/**
 * マーカー間を取り出す。
 *
 * @param {string} text ファイルの中身
 * @returns {{status: string, code: string, startLine: number, endLine: number,
 *            commentLines: {line: number, text: string}[]}}
 *   - status = 'ok' のときだけ code が意味を持つ
 *   - startLine / endLine は1始まり。異常時は 0
 *   - commentLines は範囲内にある「行頭コメント」で日本語を含むもの（規約違反の候補）
 */
export function extractSnippet(text) {
  const empty = { code: '', startLine: 0, endLine: 0, commentLines: [] };
  const lines = String(text).split('\n');
  const markers = findMarkers(lines);

  if (markers.length === 0) return { status: MARKER_STATUS.NONE, ...empty };

  // 開始と終了が交互に並んでいるかを前から見る。
  let depth = 0;
  let pairs = 0;
  let openAt = -1;
  let closeAt = -1;
  for (const marker of markers) {
    if (marker.kind === 'start') {
      if (depth > 0) return { status: MARKER_STATUS.NESTED, ...empty };
      depth = 1;
      if (openAt === -1) openAt = marker.index;
    } else {
      if (depth === 0) return { status: MARKER_STATUS.UNPAIRED, ...empty };
      depth = 0;
      pairs += 1;
      if (closeAt === -1) closeAt = marker.index;
    }
  }
  if (depth !== 0) return { status: MARKER_STATUS.UNPAIRED, ...empty };
  if (pairs > 1) return { status: MARKER_STATUS.MULTIPLE, ...empty };

  const inner = lines.slice(openAt + 1, closeAt);
  const commentLines = [];
  inner.forEach((line, i) => {
    if (COMMENT_LINE.test(line) && CJK.test(line)) {
      commentLines.push({ line: openAt + 2 + i, text: line.trim() });
    }
  });

  // 前後の空行は落とす（マーカーの直後・直前の改行はコピー範囲に含めない）
  const trimmed = [...inner];
  while (trimmed.length > 0 && trimmed[0].trim() === '') trimmed.shift();
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') trimmed.pop();

  return {
    status: MARKER_STATUS.OK,
    code: dedent(trimmed).join('\n'),
    startLine: openAt + 1,
    endLine: closeAt + 1,
    commentLines,
  };
}

/** マーカーが1つでも入っているか（未埋め込みの判定に使う）。 */
export function hasMarker(text) {
  return String(text)
    .split('\n')
    .some((line) => SNIPPET_MARKER.test(line));
}
