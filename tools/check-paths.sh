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
# サイト内リンクは相対パスで書く。絶対 URL を書いてよいのは次の3つだけ。
#   - sitemap.xml の <loc>
#   - canonical / og:url / og:image
#   - 外部サイト（GitHub / ポートフォリオ / ブログ / X）へのリンク
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

# (a-2) 公開オリジン付きの絶対 URL は、許した3つの文脈にだけ現れてよい
#       許した文脈 = sitemap の <loc> / canonical / og:url / og:image /
#                    site.json の siteOrigin（絶対 URL の唯一の起点）/ package.json の homepage
#       ★除外を先に列挙しておかないと、canonical と og:url が毎回ヒットして
#         「ヒットするのが正常」と運用され、やがて見られなくなる（破れる検出器は無いのと同じ）
A2=$(grep "${GREP_OPTS[@]}" -e "$ORIGIN" "$TARGET" \
     | grep -vE '<loc>|rel="canonical"|property="og:url"|property="og:image"|"siteOrigin"|siteOrigin \+|site\.siteOrigin|"homepage"')
if [ -n "$A2" ]; then
  echo "NG(a-2): 許した文脈の外で公開オリジンの絶対 URL を検出した"
  echo "$A2"
  FAIL=1
fi

# 除外した行は件数を出す（黙って消さない）
A2X=$(grep "${GREP_OPTS[@]}" -e "$ORIGIN" "$TARGET" \
      | grep -cE '<loc>|rel="canonical"|property="og:url"|property="og:image"|"siteOrigin"|siteOrigin \+|site\.siteOrigin|"homepage"')
echo "許容した絶対 URL（canonical / og / sitemap / データの起点）: ${A2X} 行"

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
