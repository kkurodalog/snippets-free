#!/bin/bash
# =============================================================================
# 配色・ブレークポイントの機械確認（対象 = カタログ外殻）
#
#   使い方: ./tools/check-design.sh {走査対象ディレクトリ}
#   例:     ./tools/check-design.sh ./
#
#   終了コード: 0 = 機械判定で違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
#
#   ⚠️ exit 0 が保証するのは (1)(2)(2b)(4) の機械判定だけ。(3)(5)(6) は出力の目視が要る。
#
# ★走査対象は「カタログ外殻」に限る（外殻 = 外殻CSS ＋ 生成ページ）
#   掲載デモ（components/{カテゴリ}/{パーツ}/ 配下・utils/ 配下）と素材（media/）は対象外。
#   デモは白背景前提で作られた別物であり、外殻の配色規範を当てる相手ではない。
#   ⚠️ 対象を絞ったぶん、絞り方が正しいことをここに書き残す。
#     - 残す : assets/**、リポジトリ直下の生成ページ、components/{カテゴリ}/index.html
#     - 外す : components/{カテゴリ}/{パーツ}/**、utils/**、media/**、node_modules/**、.git/**
# =============================================================================
set -u
TARGET="${1:?走査対象のディレクトリを指定する}"
FAIL=0

collect() { # $1 = 拡張子パターン
  find "$TARGET" -name "$1" \
    -not -path '*/node_modules/*' \
    -not -path '*/.git/*' \
    -not -path '*/components/*/*/*' \
    -not -path '*/utils/*' \
    -not -path '*/media/*'
}

# (0) 先に対象があることを確かめる。0件なら以降の「0件」は合格ではなく未走査である
#     ★CSS が0件のときも未走査として落とす（配色もBPも CSS にしか無い）
FILES=$({ collect '*.css'; collect '*.html'; } | grep -c .)
CSSFILES=$(collect '*.css' | grep -c .)
echo "走査対象（外殻）: ${FILES} ファイル（うち CSS ${CSSFILES} ファイル）"
{ collect '*.css'; collect '*.html'; } | sed 's/^/  - /'
[ "$FILES" -ge 1 ] || { echo "NG: 走査対象が0件。パスが違う"; exit 2; }
[ "$CSSFILES" -ge 1 ] || { echo "NG: 走査対象の CSS が0件。パスが違う"; exit 2; }

SHELL_FILES=()
SHELL_CSS=()
while IFS= read -r line; do [ -n "$line" ] && SHELL_FILES+=("$line"); done < <(collect '*.css'; collect '*.html')
while IFS= read -r line; do [ -n "$line" ] && SHELL_CSS+=("$line"); done < <(collect '*.css')

# (1) ライトモードの混入がないこと（ヒット0件が合格）
#     ★`color-scheme: dark` は許容。`light` を含むものだけを検出する
if grep -niE "prefers-color-scheme|color-scheme:[[:space:]]*light|data-theme" "${SHELL_FILES[@]}"; then
  echo "NG(R-6): ライト用の指定を検出した"; FAIL=1
fi

# (1b) color-scheme: dark が宣言されていること（フォームコントロールの UA スタイルを黒に揃える）
if ! grep -qiE "color-scheme:[[:space:]]*dark" "${SHELL_CSS[@]}"; then
  echo "NG(R-6): color-scheme: dark の宣言が無い"; FAIL=1
fi

# 走査用の前処理。
#   - ページ内アンカー（href="#…" / aria-controls="#…" / url(#…)）を落とす。
#     これらは色ではなく参照であり、色として読むと誤検出になる
#   - 各行の末尾に空白を1つ足す。行末に置かれた色にも「後ろの境界」を作るため
prepared() {
  cat "${SHELL_FILES[@]}" \
    | sed -E 's/(href|xlink:href|aria-controls|aria-labelledby|aria-describedby)[[:space:]]*=[[:space:]]*"#[^"]*"/ /g' \
    | sed -E "s/(href|xlink:href|aria-controls|aria-labelledby|aria-describedby)[[:space:]]*=[[:space:]]*'#[^']*'/ /g" \
    | sed -E 's/url\([[:space:]]*["'"'"']?#[^)]*\)/ /g' \
    | sed 's/$/ /'
}

# (2) 差し色の混入がないこと（--code-* 以外に彩度のある値がないこと）
#     ★--code-*: の宣言まるごとを先に食わせて除外し、残った色表記だけを判定する
#     ★CSS だけでなく HTML も見る（インライン style / SVG の fill を取りこぼさない）
#     ★HEX は「後ろが語の続きでないこと」を要求する。
#       ⚠️ 桁数だけで切り出すと、id やページ内アンカーの先頭が色に見える。
#          `#accordion` は先頭3文字 `acc` が3桁 HEX として切り出され、
#          規範どおりの実装が NG(R-1) で落ちていた（`accordion` はカテゴリの slug であり、
#          カテゴリ一覧・タグ・モーダルを作れば必ず登場する）。
#          偽の NG は「検査を無効化する」動機を作り、次に本物の違反が出たときに信用されない。
#       ★桁数の妥当性（3/4/6/8）は下の分岐で判定する。9桁以上は要判定として落とす
#     ⚠️ 残る曖昧さ: `#cafe` のように語全体が 4桁 HEX として成立する id は、字面では色と区別できない。
#        HTML 側は上の前処理でアンカー属性を落とすため出ないが、CSS の id セレクタに書くと色として拾う。
#        CODING-RULES.md §5 の id 規約（`{パーツ slug}-{用途}-{連番}`）に従えば起きない。
#        もし出たら、検査を緩めるのではなく id の名前を規約に合わせる。
R1=$(prepared \
     | grep -oE \
      -e "--code-[a-z-]+:[^;]*;" \
      -e "#[0-9a-fA-F]+[^0-9a-zA-Z_-]" \
      -e "(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)" \
     | sed -E 's/^(#[0-9a-fA-F]+).$/\1/' \
     | grep -v -e "--code-" | sort -u \
     | while read -r c; do
         if [ "${c:0:1}" = "#" ]; then
           h=${c:1}
           if [ ${#h} -eq 3 ] || [ ${#h} -eq 4 ]; then
             r=$((16#${h:0:1}${h:0:1})); g=$((16#${h:1:1}${h:1:1})); b=$((16#${h:2:1}${h:2:1}))
           elif [ ${#h} -eq 6 ] || [ ${#h} -eq 8 ]; then
             r=$((16#${h:0:2}));         g=$((16#${h:2:2}));         b=$((16#${h:4:2}))
           else
             echo "要判定(R-1): $c 色として桁数が不正"; continue
           fi
         elif [ "${c#rgb}" != "$c" ]; then
           set -- $(printf '%s' "$c" | sed -E 's/.*\(([^)]*)\).*/\1/' | tr ',/%' '   ')
           if [ $# -lt 3 ]; then echo "要判定(R-1): $c 値を読み取れない"; continue; fi
           r=${1%%.*}; g=${2%%.*}; b=${3%%.*}
         else
           echo "要判定(R-1): $c HEX / rgb() 以外は機械判定できない。中立であることを人が確かめる"; continue
         fi
         mx=$r; [ "$g" -gt "$mx" ] && mx=$g; [ "$b" -gt "$mx" ] && mx=$b
         mn=$r; [ "$g" -lt "$mn" ] && mn=$g; [ "$b" -lt "$mn" ] && mn=$b
         [ $((mx-mn)) -gt 24 ] && echo "NG(R-1): $c 振れ幅 $((mx-mn))"
       done)
[ -z "$R1" ] || { echo "$R1"; FAIL=1; }

# (2b) 有彩の色名リテラルが宣言値に混じっていないこと（HEX を見るだけでは素通りする）
#      ★コロン形式（CSS 宣言）と属性形式（SVG の fill="red" 等）の両方を見る。
#        ⚠️ コロン形式だけを見ていると、属性で書かれた色名を素通りする。
#           スクリプト冒頭の「HTML も見る」という主張は、その状態では色名について偽になる
R1KW=$(prepared \
       | grep -oiE \
           -e "(color|background|border|outline|fill|stroke|shadow)[a-z-]*:[^;{}]*" \
           -e "(fill|stroke|color|bgcolor|stop-color|flood-color|lighting-color)[a-z-]*[[:space:]]*=[[:space:]]*\"[^\"]*\"" \
           -e "(fill|stroke|color|bgcolor|stop-color|flood-color|lighting-color)[a-z-]*[[:space:]]*=[[:space:]]*'[^']*'" \
       | grep -oiE "(^|[^a-z-])(red|blue|green|yellow|orange|purple|pink|cyan|magenta|teal|lime|navy|olive|maroon|aqua|fuchsia|gold|crimson|indigo|violet|turquoise|salmon|tomato|coral|khaki|orchid|lavender)([^a-z-]|$)" \
       | sort -u)
[ -z "$R1KW" ] || { echo "NG(R-1): 有彩の色名リテラルを検出した"; echo "$R1KW"; FAIL=1; }

# (3) コードのハイライト色が UI に流用されていないこと
#     ★目視項目（終了コードに反映しない）。参照元がコード表示のセレクタだけであることを確認する
echo "--- (3) --code-* の参照元（目視） ---"
grep -n -e "--code-" "${SHELL_CSS[@]}"

# (4) ブレークポイントが 600px / 900px の2つだけであること
#     ★`@media` の条件式に現れる min-width だけを見る。
#       ⚠️ プロパティ宣言の min-width（パネルの 240px / ボタンの 40px）は BP ではない。
#          文脈を見ずに拾うと、規範どおりの実装が NG(BP) で落ちる。
#     ★改行を潰してから @media の条件式を切り出す（複数行に分けたメディアクエリを取りこぼさない）
BP=$(cat "${SHELL_CSS[@]}" \
     | tr '\n' ' ' \
     | grep -oE "@media[^{]*\{" \
     | grep -oE "min-width:[[:space:]]*[0-9]+px" | sort -u)
echo "--- (4) メディアクエリの min-width ---"
printf '%s\n' "$BP"
BPBAD=$(printf '%s\n' "$BP" | grep -vE "min-width:[[:space:]]*(600|900)px" | grep -v '^$')
[ -z "$BPBAD" ] || { echo "NG(BP): 600px / 900px 以外のブレークポイントを検出した"; echo "$BPBAD"; FAIL=1; }

# (5) 白い塗りが2箇所だけであること（件数ではなくセレクタの同一性で見る）
#     ★目視項目（終了コードに反映しない）
#     ★除外規定 — 次の3つは「3箇所目の白い塗り」ではない。出てきても違反ではない
#         - プレビュー窓の面色（#ffffff / 掲載デモの地色と一致させるため落とさない）
#         - ドロップダウンの現在地を示す左端 2px の縦バー（ink）
#           ※本実装ではこのバーを border-inline-start で描いており、背景色としては現れない
#         - ハンバーガーの3本線（ink / 2px の矩形。塗りの面ではなく線を引いているだけ）
#       ⚠️ 除外を書いておかないと「3箇所目の白い塗りだ」と誤読され、検査が信用されなくなる
#       ⚠️ 除外対象を**検出したうえで却下する**形にする。
#          白い値を持つカスタムプロパティ（--preview-canvas / --ring）を検出パターンから
#          落としてしまうと、除外規定に列挙した当の面が**そもそも出力に現れず**、
#          「列挙して却下した」のか「見ていないだけ」なのかを読み手が区別できない。
#          その経路で3箇所目が入っても目視項目に現れない。
echo "--- (5) 白い塗りのセレクタ（目視 / 上記の除外規定を当てる） ---"
grep -n -B3 -iE "background(-color)?:[[:space:]]*(var\(--(ink|preview-canvas|ring)\)|#f2f4f6|#ffffff|#fff[^0-9a-fA-F]|white)" "${SHELL_CSS[@]}"

# (6) 影を持つ面がモーダル1つだけであること
#     ★目視項目（終了コードに反映しない）
#     ★`0 0 0 1px` の縁取り代用も含めて検出する（ドロップダウンパネルの二重罫線は罫線で描く）
echo "--- (6) 影の宣言（目視 / モーダル以外が出たら二重罫線の方針が崩れている） ---"
grep -n -e "box-shadow" -e "text-shadow" -e "drop-shadow" "${SHELL_FILES[@]}"

# ★終了コード — 違反を出しながら成功終了しないこと
[ "$FAIL" -eq 0 ] || { echo "NG: 機械判定で違反を検出した（(3)(5)(6) の目視は別途）"; exit 1; }
echo "OK: (1)(1b)(2)(2b)(4) は違反0件。(3)(5)(6) の出力は目視すること"
exit 0
