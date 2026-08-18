#!/bin/bash
# =============================================================================
# 配色・ブレークポイントの機械確認（対象 = カタログ外殻）
#
#   使い方: ./tools/check-design.sh {走査対象ディレクトリ}
#   例:     ./tools/check-design.sh ./
#
#   終了コード: 0 = 機械判定で違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
#
#   ⚠️ exit 0 が保証するのは (1)(2)(2b)(2c)(2d)(2e)(4) の機械判定だけ。(3)(5)(6) は出力の目視が要る。
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
#      ★カスタムプロパティの宣言（`--x: lime`）も見る。
#        ⚠️ プロパティ名で絞るだけだと、`--x: lime` を書いて `color: var(--x)` で参照する形が
#           素通りしていた。`#hex` と `rgb()` は (2) が名前を見ずに拾うため捕まるが、
#           色名リテラルだけが抜けており、差し色を持ち込める唯一の経路になっていた。
#        ★見るのは参照側（`var(…)`）ではなく定義側である。理由は2つ。
#           (1) 画面に出る色は、必ずどこかでリテラルとして定義される。多段（`--a: lime` →
#               `--b: var(--a)` → `color: var(--b)`）でも、鎖の根元にリテラルが現れる。
#               定義側を見れば、参照の深さに関係なく1回の抽出で届く。
#           (2) 参照側を追うには var の連鎖を解く必要があり、シェルでは解ける保証がない。
#               解ける保証のない仕掛けを置くと、素通りしたのか解決に失敗したのかを読み手が
#               区別できなくなる。区別できない検査は、通っても根拠にならない。
#        ⚠️ 届かない範囲 = 定義が走査対象の外にある場合。外殻CSS は自分のトークンを自分で
#           定義しており現時点で該当は無いが、外部の CSS から色を受け取る形にしたら当てにならない。
#        ⚠️ `--code-*` はここでは落とさない。(2c) が別枠（緩い上限88）で見るためである。
#           両方で落とすと、同じ違反が2つの規則名で出て、どちらの上限に当たったのかが読めなくなる。
R1KW=$(prepared \
       | grep -oiE \
           -e "(color|background|border|outline|fill|stroke|shadow)[a-z-]*:[^;{}]*" \
           -e "--[a-z0-9-]+:[^;{}]*" \
           -e "(fill|stroke|color|bgcolor|stop-color|flood-color|lighting-color)[a-z-]*[[:space:]]*=[[:space:]]*\"[^\"]*\"" \
           -e "(fill|stroke|color|bgcolor|stop-color|flood-color|lighting-color)[a-z-]*[[:space:]]*=[[:space:]]*'[^']*'" \
       | grep -viE "^--code-" \
       | grep -oiE "(^|[^a-z-])(red|blue|green|yellow|orange|purple|pink|cyan|magenta|teal|lime|navy|olive|maroon|aqua|fuchsia|gold|crimson|indigo|violet|turquoise|salmon|tomato|coral|khaki|orchid|lavender)([^a-z-]|$)" \
       | sort -u)
[ -z "$R1KW" ] || { echo "NG(R-1): 有彩の色名リテラルを検出した"; echo "$R1KW"; FAIL=1; }

# (2c) --code-* の彩度上限（コードのハイライト8色だけに許した彩度に、機械の歯止めを置く）
#     ⚠️ (2) は --code-* を**名前ごと**除外している。除外だけを置くと、
#        `--code-` で始まる名前を付けるだけで**値が何であれ振れ幅判定に載らなくなる**。
#        --code-* を参照するものが1件も無いあいだ除外は空振りしていたが、
#        コードの着色8色が実際に画面へ出た時点で、この除外が唯一の彩度ゲートの穴になった。
#        「名前を1つ増やすと塗りが検査から静かに消える」型が、同じ検査のより広い場所に残っていた。
#     ★除外の代わりに**別枠の上限**を課す。UI 側の上限（振れ幅24）はコードには狭すぎるため、
#       コード用に緩い上限を持たせる。
#     ★上限88 の根拠 = 現行8色の最大が --code-attr #d8b78d の 75。そこへ余裕を1段乗せた値である。
#       ネオン系（例: #00ff88 = 振れ幅255）は通らない。
#       ⚠️ 上限に近い色を足したくなったら、**上限を上げるのではなく色のほうを落とす**。
#          上限を上げるとこの検査は「現行を追認するだけの数字」になる。
#     ⚠️ 色ではない --code-* トークン（--code-fade-height 等の長さ）は対象外。
#        ただし機械判定できない色表記（rgb() 等）と有彩の色名は要判定として落とす
#        （素通りさせると、書き方を変えるだけで上限を回避できてしまう）。
R1C=$(prepared | grep -oE -- "--code-[a-z-]+:[^;]*;" | sort -u \
      | while read -r decl; do
          val=${decl#*:}
          hex=$(printf '%s' "$val" | grep -oE "#[0-9a-fA-F]{6}([^0-9a-fA-F]|$)" | head -1 | grep -oE "#[0-9a-fA-F]{6}")
          if [ -n "$hex" ]; then
            h=${hex#\#}
            r=$((16#${h:0:2})); g=$((16#${h:2:2})); b=$((16#${h:4:2}))
            mx=$r; [ "$g" -gt "$mx" ] && mx=$g; [ "$b" -gt "$mx" ] && mx=$b
            mn=$r; [ "$g" -lt "$mn" ] && mn=$g; [ "$b" -lt "$mn" ] && mn=$b
            [ $((mx-mn)) -gt 88 ] && echo "NG(R-1c): $hex --code-* の振れ幅 $((mx-mn)) が上限88 を超える"
            continue
          fi
          if printf '%s' "$val" | grep -qiE "#[0-9a-fA-F]+|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(" ; then
            echo "要判定(R-1c): $decl 色として機械判定できない表記。6桁 HEX で書く"; continue
          fi
          if printf '%s' "$val" | grep -qiE "(^|[^a-z-])(red|blue|green|yellow|orange|purple|pink|cyan|magenta|teal|lime|navy|olive|maroon|aqua|fuchsia|gold|crimson|indigo|violet|turquoise|salmon|tomato|coral|khaki|orchid|lavender)([^a-z-]|$)"; then
            echo "NG(R-1c): $decl --code-* に有彩の色名リテラルを検出した"; continue
          fi
        done)
[ -z "$R1C" ] || { echo "$R1C"; FAIL=1; }

# (2d) ホバーで「内容の出し入れ」をしていないこと（B-34 の規則2 の機械化）
#     ★これは規則3（`@media (any-hover: hover)` で囲わない）の前提そのものである。
#       ホバーでしか出ない導線・ホバーでしか押せないボタンが1つも無いからこそ、
#       タッチ端末にホバー状態が残っても到達できなくなるものが無い、と言える。
#       ⚠️ その前提はこれまで **CSS のコメントでしか守られていなかった**。
#          規則を手順に置くと、その手順を通らない経路が素通りする。機械の層へ移す。
#     ⚠️ 判定はコメントを除いた宣言だけに当てる（注意書きの中の語を拾わない）。
#     ★落とす対象は下の4群であり、**この列挙が守備範囲そのもの**である。
#       ⚠️ これより広い言い方（「位置・大きさ・影を動かす宣言も禁じている」等）をここに書かない。
#          注記が仕掛けより広いと、読み手は「ホバーで何も動かない」と受け取るが、
#          実際に保証しているのは列挙したぶんだけになる。主張は仕掛けと同じ幅で書く。
#         - 内容の出し入れ: display / visibility / opacity / content / content-visibility / clip-path
#         - 位置          : position / top / right / bottom / left / inset* /
#                           transform* / translate / rotate / scale / perspective / order
#         - 大きさ        : width / height / block-size / inline-size（min- / max- 付きを含む）/
#                           margin* / padding* / gap / row-gap / column-gap / flex* / grid* /
#                           border*width / font-size / font-weight / letter-spacing /
#                           word-spacing / line-height / zoom
#         - 影            : box-shadow / text-shadow / filter / backdrop-filter
#       ⚠️ 面色（background*）・罫線色（border*color）・下線（text-decoration*）・記号の明度（color）は
#          B-34 が許した変化である。ここでは落とさない（落とすと規範どおりの実装が弾かれる）。
#       ⚠️ ベンダー接頭辞（-webkit- / -moz- / -ms-）付きも同じ扱いにする。
#     ★例外は1つだけある = ロゴのホバー `.c-logo:hover { opacity: 0.7 }`（★代表指示 / 2026-08-18）。
#       ⚠️ 例外はセレクタと宣言の**両方を一致させて**外す。`.c-logo:hover` なら何でも通す形にしない
#          （それだと後から transform や display をロゴへ足したときに素通りする）。
#       ⚠️ ホバーで内容を出し入れしていないことは、この1件でも崩れていない。
#          0.7 は「消す」ではなく「弱める」であり、導線もボタンもホバー前と同じだけ到達できる
#          （規則3 の前提＝ホバーでしか出ないものが無い、は保たれている）。
#       ⚠️ 例外を増やすときは★代表判断。ここに1行足すだけで通ってしまうため、
#          「通せる」ことと「通してよい」ことを混ぜない。
#     ★入れ子は1段まで見る（`.a:hover { color: …; .child { display: block } }` の内側まで届く）。
#       ⚠️ 正規表現では { } の対応を数えられないため、2段以上の入れ子には届かない。
#          届かないままにせず、(2e) で**ネスト記法そのもの**を機械で禁じている。
HOVERPROPS='(-webkit-|-moz-|-ms-)?(display|visibility|opacity|content|content-visibility|clip-path|position|top|right|bottom|left|inset[a-z-]*|transform[a-z-]*|translate|rotate|scale|perspective|(min-|max-)?(width|height|block-size|inline-size)|margin[a-z-]*|padding[a-z-]*|gap|(row|column)-gap|flex[a-z-]*|grid[a-z-]*|order|font-size|font-weight|letter-spacing|word-spacing|line-height|border[a-z-]*width|(box|text)-shadow|(backdrop-)?filter|zoom)'
HOVER=$(cat "${SHELL_CSS[@]}" \
        | tr '\n' ' ' \
        | sed -E 's:/\*[^*]*\*+([^/*][^*]*\*+)*/: :g' \
        | grep -oE "[^{}]*:hover[^{}]*\{[^{}]*(\{[^{}]*\}[^{}]*)*\}" \
        | grep -vE "^[[:space:]]*\.c-logo:hover[[:space:]]*\{[[:space:]]*opacity:[[:space:]]*0\.7;[[:space:]]*\}$" \
        | sed -E 's/^[^{]*//' \
        | grep -oiE "(^|[;{])[[:space:]]*${HOVERPROPS}[[:space:]]*:" \
        | sort -u)
[ -z "$HOVER" ] || { echo "NG(B-34): :hover が面色・罫線・下線・記号の明度以外を動かしている"; echo "$HOVER"; FAIL=1; }

# (2e) CSS のネスト記法を使っていないこと（(2d) が宣言に届くための前提）
#     ⚠️ (2d) は正規表現で { } を数えており、入れ子は1段までしか追えない。
#        「ネストは使わないことにしている」と注記に書くだけでは、書いた本人にしか効かない。
#        前提のほうを機械で確かめる。
#     ★判定 = 規則ブロック（プレリュードが @ で始まらないブロック）の中で、さらにブロックが
#       開いたらネストとみなす。@media / @layer / @supports / @container の入れ子は正当なので
#       対象外である。文字列とコメントは先に落とす（`content: "{"` を数えないため）。
NEST=$(cat "${SHELL_CSS[@]}" \
       | tr '\n' ' ' \
       | sed -E 's:/\*[^*]*\*+([^/*][^*]*\*+)*/: :g' \
       | sed -E 's/"[^"]*"/ /g' \
       | sed -E "s/'[^']*'/ /g" \
       | awk '{
           buf = ""; rule = 0; d = 0; n = length($0);
           for (i = 1; i <= n; i++) {
             c = substr($0, i, 1);
             if (c == "{") {
               p = buf; gsub(/^[ \t]+|[ \t]+$/, "", p);
               if (rule > 0) print substr(p, 1, 60);
               if (p ~ /^@/) { stack[++d] = "at" } else { stack[++d] = "rule"; rule++ }
               buf = "";
             } else if (c == "}") {
               if (d > 0) { if (stack[d] == "rule") rule--; d-- }
               buf = "";
             } else { buf = buf c }
           }
         }')
[ -z "$NEST" ] || { echo "NG(B-34): CSS のネスト記法を検出した（(2d) が宣言に届かなくなる）"; echo "$NEST"; FAIL=1; }

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
#     ★除外規定 — 次の2つは「3箇所目の白い塗り」ではない。出てきても違反ではない
#         - プレビュー窓の面色（#ffffff / 掲載デモの地色と一致させるため落とさない）
#         - ハンバーガーの3本線（ink / 2px の矩形。塗りの面ではなく線を引いているだけ）
#       ⚠️ 除外を書いておかないと「3箇所目の白い塗りだ」と誤読され、検査が信用されなくなる
#       ★2026-08-18 に「ドロップダウンの現在地を示す左端 2px の縦バー（ink）」を除外の列から外した。
#         ⚠️ 部品そのものを廃止したためである（現在地は control の面で示す）。
#         ⚠️ 実体を消したのに除外規定へ残すと、**実在しない部品を1つ数えた表**で人が照合することになる。
#            これは下の注記が述べている「列挙して却下したのか、見ていないだけなのか区別できない」と同じ穴である。
#       ★除外規定の正本は DESIGN.md の R-3 である。ここはその写しであり、**R-3 を直したら必ずここも直す**。
#         ⚠️ 機械で突き合わせない理由は下の「※ 2箇所に書いていることについて」に書いた。
#       ⚠️ 除外対象を**検出したうえで却下する**形にする。
#          白い値を持つカスタムプロパティ（--preview-canvas / --ring）を検出パターンから
#          落としてしまうと、除外規定に列挙した当の面が**そもそも出力に現れず**、
#          「列挙して却下した」のか「見ていないだけ」なのかを読み手が区別できない。
#          その経路で3箇所目が入っても目視項目に現れない。
#       ⚠️ 白い値を持つカスタムプロパティを増やしたら、**この抽出パターンにも並べる**。
#          名前を1つ増やすだけで、その塗りは目視項目から静かに消える
#
#     ※ 2箇所に書いていることについて（2026-08-18 の判断）
#       R-3 の除外規定は DESIGN.md（正本）と、この目視項目の注記（写し）の2箇所にある。
#       ★判断 = **現状維持。正本を1つに決め、写しの側にそう明記する**（上の★の行）。
#       ⚠️ 機械で突き合わせない — DESIGN.md は公開リポの**外**（社内の 05_design/）にある。
#          公開リポ内の検査から参照すると「clone しただけで通る」という前提が崩れ、常に落ちる検査になる。
#          社内側に照合を置いても、社内側に検査を走らせる仕組みが無く、走らない検査が1本増えるだけである。
#       ⚠️ 写しを消して参照だけにもしない — この注記は**目視で照合する人の手元の表**であり、
#          別ファイルを開かせると照合そのものが行われなくなる。
#       ⚠️ 効き目は「気づけば直る」程度である。**同じ取り残しは再び起こりうる**
#          （実際に 2026-08-18 の1回目で、DESIGN.md だけ直してここが取り残された）。
#          06_implementation/README.md の scripts 逸脱表・PLAN.md §7 表と §10 で出したのと同じ判断である。
#          （--copy-hover = コピーボタンのホバー。#ffffff を意味の名前で持ったもの）。
#       ⚠️ -B の行数は「セレクタ行まで届く」ことを条件に決める。-B3 では新設した .c-copy の
#          セレクタ行が出力から落ち、どの部品の塗りなのかを読み手が区別できなかった。
echo "--- (5) 白い塗りのセレクタ（目視 / 上記の除外規定を当てる） ---"
grep -n -B4 -iE "background(-color)?:[[:space:]]*(var\(--(ink|preview-canvas|ring|copy-hover)\)|#f2f4f6|#ffffff|#fff[^0-9a-fA-F]|white)" "${SHELL_CSS[@]}"

# (6) 影を持つ面がモーダル1つだけであること
#     ★目視項目（終了コードに反映しない）
#     ★`0 0 0 1px` の縁取り代用も含めて検出する（ドロップダウンパネルの二重罫線は罫線で描く）
echo "--- (6) 影の宣言（目視 / モーダル以外が出たら二重罫線の方針が崩れている） ---"
grep -n -e "box-shadow" -e "text-shadow" -e "drop-shadow" "${SHELL_FILES[@]}"

# ★終了コード — 違反を出しながら成功終了しないこと
[ "$FAIL" -eq 0 ] || { echo "NG: 機械判定で違反を検出した（(3)(5)(6) の目視は別途）"; exit 1; }
echo "OK: (1)(1b)(2)(2b)(2c)(2d)(2e)(4) は違反0件。(3)(5)(6) の出力は目視すること"
exit 0
