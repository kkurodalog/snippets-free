#!/bin/bash
# =============================================================================
# 相対パス検証（2本立て）
#
#   使い方: ./tools/check-paths.sh {走査対象ディレクトリ}
#   例:     ./tools/check-paths.sh ./
#
#   終了コード: 0 = 違反0件 / 1 = 違反あり / 2 = 走査対象が0件（未走査）
#
# なぜ2本立てなのか
#   (a) と (b) は捕捉する失敗形が違う。片方だけでは通り抜ける。
#   (b) が拾う `href="/…"` は文字列に "/snippets-free/" を含まないため、(a) を素通りする。
#   しかもこの形は**ローカルのルート配信では正しく動き、本番配信でだけ壊れる**。
#
# サイト内リンクは相対パスで書く。絶対 URL を書いてよいのは次の4つだけ。
#   - sitemap.xml の <loc>
#   - canonical / og:url / og:image
#   - 構造化データ（BreadcrumbList）の "item"
#     ★schema.org は item に絶対 URL を要求する（相対では要件を満たさない）。
#       許す文脈をここに書き足すのは検査を緩めることになるため、キー名まで絞って列挙する。
#     ⚠️ この除外は**出力の字面**（キー名 "item" の直後に値が来ること）に依存している。
#       JSON-LD の整形を変えると除外が外れ、正しい実装が NG(a-2) で落ちる（＝落ちる方向の
#       誤りなので見逃しにはならないが、原因が分からないと検査を緩めたくなる）。
#       コロンの後ろの空白だけは 0個以上を許してあるが、キーと値の間に改行を挟む形にすると外れる。
#   - 外部サイト（GitHub / ポートフォリオ / ブログ / X）へのリンク
#   - ★リポジトリのツリー URL（`{repoUrl}/tree/{repoBranch}/components/{カテゴリ}`）
#     モーダルのパス行（2行目）に置いた「GitHubで全ソースを見る ↗」の行き先である（2026-08-18 / ★代表指示）。
#     ⚠️ 起点は site/data/site.json の repoUrl / repoBranch であり、**画面側は組み立てない**。
#        ⚠️ ★**ただし repoUrl は、この直下の REPO にもハードコードしてある。変える場所は2箇所である。**
#           ⚠️ 「site.json の2つだけ」と書くと、9行下の自分自身を否定することになる。
#           ⚠️ 片方だけ直すと (a-1) が落ちるため、**失敗は静かではない**。
#           ⚠️ ここから site.json を読みに行かない — シェルであり JSON を読むには依存（jq 等）が要る。
#              **依存ゼロを崩す代わりに、ずれたら落ちる形で受けている**（理由の正本 =
#              site/templates/category.mjs の partsMeta() の注記）。
#     ⚠️ (a-1) はリポジトリ URL を消してから /snippets-free/ を探すため、この形は元から通る。
#        **通ることと、通してよいと決めたことは別である。** 下で件数を出し、
#        「列挙して却下した」のか「見ていないだけ」なのかを読み手が区別できるようにする。
# =============================================================================
set -u
TARGET="${1:?走査対象のディレクトリを指定する}"
FAIL=0
ORIGIN="https://kkurodalog.github.io/snippets-free/"
REPO="https://github.com/kkurodalog/snippets-free"

GREP_OPTS=(-rn
  --include='*.html' --include='*.css' --include='*.js' --include='*.mjs'
  --include='*.json' --include='*.xml'
  --exclude-dir='.git' --exclude-dir='node_modules')

FILES=$(find "$TARGET" \
  \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' -o -name '*.json' -o -name '*.xml' \) \
  -not -path '*/node_modules/*' -not -path '*/.git/*' | wc -l | tr -d ' ')

# (0) 先に対象があることを確かめる。0件なら以降の「0件」は合格ではなく未走査である
echo "走査対象: ${FILES} ファイル"
[ "$FILES" -ge 1 ] || { echo "NG: 走査対象が0件。パスが違う"; exit 2; }

# -----------------------------------------------------------------------------
# (a) /snippets-free/ を含む絶対パスがサイト内リンクとして残っていないこと
# -----------------------------------------------------------------------------
# (a-1) 公開オリジンにもリポジトリ URL にも属さない /snippets-free/ は、どこにあっても違反
#       ★行ごと除外せず、許した URL だけを消してから残りを見る。
#         行ごと除外すると、同じ行に書かれた2つ目の違反を取りこぼす
A1=$(grep "${GREP_OPTS[@]}" -e "/snippets-free/" "$TARGET" \
     | awk -v o="$ORIGIN" -v r="$REPO" '{
         s = $0;
         gsub(o, "", s);
         gsub(r, "", s);
         if (s ~ /\/snippets-free\//) print $0;
       }')
if [ -n "$A1" ]; then
  echo "NG(a-1): /snippets-free/ を含むパスを検出した"
  echo "$A1"
  FAIL=1
fi

# (a-2) 公開オリジン付きの絶対 URL は、許した文脈にだけ現れてよい
#       許した文脈 = sitemap の <loc> / canonical / og:url / og:image /
#                    構造化データの "item" / site.json の siteOrigin（絶対 URL の唯一の起点）/
#                    package.json の homepage
#       ★除外を先に列挙しておかないと、canonical と og:url が毎回ヒットして
#         「ヒットするのが正常」と運用され、やがて見られなくなる（破れる検出器は無いのと同じ）
A2=$(grep "${GREP_OPTS[@]}" -e "$ORIGIN" "$TARGET" \
     | grep -vE '<loc>|rel="canonical"|property="og:url"|property="og:image"|"item":[[:space:]]*"|"siteOrigin"|siteOrigin \+|site\.siteOrigin|"homepage"')
if [ -n "$A2" ]; then
  echo "NG(a-2): 許した文脈の外で公開オリジンの絶対 URL を検出した"
  echo "$A2"
  FAIL=1
fi

# 除外した行は件数を出す（黙って消さない）
A2X=$(grep "${GREP_OPTS[@]}" -e "$ORIGIN" "$TARGET" \
      | grep -cE '<loc>|rel="canonical"|property="og:url"|property="og:image"|"item":[[:space:]]*"|"siteOrigin"|siteOrigin \+|site\.siteOrigin|"homepage"')
echo "許容した絶対 URL（canonical / og / sitemap / 構造化データ / データの起点）: ${A2X} 行"

# 外部（リポジトリ）の絶対 URL も、黙って通さず件数を出す
#   ★ここは違反ではない。**見たうえで許した**ことを画面に残すための行である。
A3X=$(grep "${GREP_OPTS[@]}" -e "$REPO" "$TARGET" | grep -c .)
A3T=$(grep "${GREP_OPTS[@]}" -e "$REPO/tree/" "$TARGET" | grep -c .)
echo "許容した絶対 URL（リポジトリ）: ${A3X} 行（うちツリー URL = パス行のリンクの行き先: ${A3T} 行）"

# -----------------------------------------------------------------------------
# (b) ルート絶対パスが残っていないこと
#     ★(a) では捕捉できない失敗形。二重引用符・単引用符・CSS の url()・srcset を見る
# -----------------------------------------------------------------------------
B=$(grep "${GREP_OPTS[@]}" -E '(href|src|poster|srcset)=["'"'"']/[^/]|url\(["'"'"']?/[^/]' "$TARGET")
if [ -n "$B" ]; then
  echo "NG(b): ルート絶対パスを検出した"
  echo "$B"
  FAIL=1
fi

# -----------------------------------------------------------------------------
# (c) テンプレ由来の kiso.css の @import が写り込んでいないこと
#     ★消し忘れると本番で CSS が 404 になる。過去に2回起きている
# -----------------------------------------------------------------------------
C=$(grep "${GREP_OPTS[@]}" -i -e "kiso" "$TARGET")
if [ -n "$C" ]; then
  echo "NG(c): kiso への参照を検出した"
  echo "$C"
  FAIL=1
fi

[ "$FAIL" -eq 0 ] || { echo "NG: 違反を検出した"; exit 1; }
echo "OK: (a-1)(a-2)(b)(c) は違反0件"
exit 0
