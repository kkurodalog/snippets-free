/**
 * コードモーダル（`<dialog>` / カテゴリ一覧に1つだけ置く）。
 *
 * 役割は1つ — 押されたコードボタンのファイルを開いた時点で読み、
 * 掲載範囲マーカーの内側だけを見せて、その場でコピーさせる。
 *
 * ★1ページに1つ。カードごとに持たない（DOM がパーツ数ぶん増える）。
 *   開くときにパーツの情報を差し替える。
 *
 * ★コードの写しをこの HTML に持たない。
 *   カタログ側に写しを置くと「デモを直したのにコピーされるコードが古い」が起きる。
 *   中身は開いたときに実ファイルを取得して入れる（assets/js/code-modal.js）。
 *
 * ★中身の器だけをここで作り、値は入れない。
 *   タブの本数はパーツごとに違い（持つ言語だけ出す）、記事リンクは記事があるパーツにだけ出る。
 *   ⚠️ 記事が無いパーツで**非活性にしない**。非活性は「あるのに押せない」というシグナルで
 *      疑問を生む。カードの [HTML][CSS][JS] が既に「持つものだけ出す」であり、原則を揃える。
 *
 * ⚠️ 「全文を表示」ボタンと GitHub リンクを置かない（廃止済み）。
 *    モーダルの出口はデモページ1本である。取得に失敗したときの導線もそこへ揃える。
 *
 * ⚠️ `<dialog>` を選ぶ理由はフォーカストラップと Esc 閉じを標準機能で得るためである。
 *    自前でトラップを書かない。`<div>` で作り直さない。
 *
 * ★タブが指す面（`role="tabpanel"`）は、コード枠と失敗メッセージの**両方を包む器**である。
 *   ⚠️ コード枠そのものを面にすると、取得に失敗したときとマーカー未埋め込みのときに
 *      枠が `display: none` になり、**タブだけが残って指す先が消える**。
 *      読み上げで辿る利用者には、操作できるタブが行き先の無い状態で残る。
 *   ⚠️ スクロールする枠（`.c-code__scroll`）は面とは別に `tabindex="0"` を持つ。
 *      キーボードでコードを送る手段であり、面と一緒にしない。
 *
 * ★パス行は2行で組む（★代表判断 / 2026-08-18）。
 *   **1行目 = パスだけ ／ 2行目 = 左端に GitHub リンク・右端に Copy。**
 *   ⚠️ 3つを1行に並べていた形から変えた。**戻さない。**
 *      1行に並べていたときは、既定フォントを大きくした利用者（32px）の 320px 幅で
 *      **縮まないリンクが行から 18px はみ出していた**（余裕 14.2px しか無かった）。
 *
 * ★パス行の2行目に「GitHubで全ソースを見る ↗」を置く（★代表指示 / 2026-08-18）。
 *   ⚠️ **これは合意事項16 を覆した変更である。「是正」ではなく「前提の変更」として扱う。**
 *      当時「モーダルに GitHub リンクを置かない」と決めた前提は、
 *      **カードのコードボタンが素のファイルリンクで、押せばソースがそのまま見えた**ことだった。
 *      4b-2 でモーダルへ格上げした結果、**その到達手段が消えた**。前提のほうが変わっている。
 *   ⚠️ 「デモを別タブで開く」はレンダリング結果であってソースではない。代わりにならない。
 *   ⚠️ 行き先は**パーツのディレクトリ**（ファイル単位にしない）。
 *      範囲外まで見たい人が欲しいのは「このパーツの全ファイル」だからである。
 *   ⚠️ **「全ソース」は外部リンクのラベルであって、廃止した「全文を表示」ボタンとは別物である。**
 *      あちらは**モーダルの中でコードを伸ばす操作**であり、**廃止は覆っていない**。
 *      こちらは**モーダルの外（GitHub）へ出る導線**である。**同じ語に見えても役割が違う。**
 *   ⚠️ URL は組み立てず、生成側（site.json の repoUrl / repoBranch）から配られた
 *      基点にカードの slug を足すだけにする。**ブランチ名をここに書かない。**
 *
 * ★`Copy` / `Copied!` には `lang="en"` を付ける（WCAG 3.1.2 Language of Parts / AA）。
 *   ⚠️ 文書は `lang="ja"` である。**英単語をそのまま置くと日本語音声で読まれる。**
 *   ⚠️ タブの `HTML` / `CSS` / `JS` は略語であり 3.1.2 の例外に当たるので付けない。
 *   ⚠️ 「GitHubで全ソースを見る」は日本語なので対象外。
 *   ⚠️ **読み上げの通知（role="status"）は日本語のままにする。** ラベルを英字にしたのは
 *      **幅の制約があったから**であり、通知に幅の制約は無い。**英字に揃えない。**
 *
 * ★コピーの成否は「ボタン自身のラベル」で見せる（★代表指示 / 2026-08-18）。
 *   ⚠️ 成功を最下部のトーストで出すと、真下の「デモを別タブで開く」を覆う。
 *      覆われたのは**そこにしか無い導線**である。**戻さない。**
 *   ⚠️ 2つのラベルを同じマス目に重ねて置き、見え方だけを切り替える（`.c-copy__label`）。
 *      ボタンの幅は常に長いほうで決まるため、押しても行が動かない。
 *   ⚠️ 読み上げへは `role="status"` の面（`data-modal-announce`）が通知する。
 *      ラベルの差し替えだけに任せない。
 *
 * ★トーストは**失敗のときだけ**出す。
 *   ⚠️ 失敗の文言は結果の報告ではなく**手順の指示**であり、読み終える前に消えると
 *      案内した操作にたどり着けない（滞留6秒）。**成功でここを使わない。**
 *   ⚠️ `role="status"` をトースト自身に置かない。可視のトーストと読み上げの通知を別の要素に分け、
 *      成功（ラベルだけ）と失敗（トーストあり）のどちらでも**1回だけ**読ませる。
 *
 * ⚠️ **この説明を HTML コメントで書かない。** 生成された HTML はそのまま公開され、
 *    社内の記法（`★`）と内部の議論が公開物に載る。説明はこの JSDoc に置く。
 *
 * ★可視ラベルの `<span>` に `data-*` の目印を付けてある（`data-modal-source-label` /
 *   `data-modal-demo-label`）。⚠️ **読み上げ名（`aria-label`）は、この可視テキストを
 *   JavaScript が読み取って組み立てる**（`code-modal.js`）。**文字列を2箇所に書かない。**
 *   ⚠️ **目印を外さない。** 外すと読み上げ名が組めず、名前と見える文字が食い違う経路が戻る
 *      （2026-08-18 に実際に起きた。本案件で3回目の同型）。
 *
 * ★注記の `<ul>` に `role="list"` を明示する。
 *   ⚠️ `list-style: none` を当てると、環境によってはリストとして読まれなくなる。
 *      見た目のために意味を落とさない。
 */
import { icon } from './icons.mjs';

export function codeModal() {
  return `    <dialog class="c-modal" aria-labelledby="code-modal-title" data-code-modal>
      <div class="c-modal__inner">
        <div class="c-modal__head">
          <h2 class="c-modal__title" id="code-modal-title" data-modal-title></h2>
          <button type="button" class="c-modal__close" data-modal-close>
            <span aria-hidden="true">✕</span><span class="u-sr-only">閉じる</span>
          </button>
        </div>

        <div class="c-modal__tabs" role="tablist" aria-label="ファイルの種類" data-modal-tabs></div>

        <div class="c-modal__filerow">
          <span class="c-modal__path" data-modal-path></span>
          <div class="c-modal__fileactions">
            <a class="c-modal__source" target="_blank" rel="noopener" data-modal-source hidden>${icon(
              'github'
            )}<span data-modal-source-label>GitHubで全ソースを見る</span><span class="c-ext" aria-hidden="true">↗</span></a>
            <button type="button" class="c-copy" data-modal-copy hidden>
              <span class="c-copy__label c-copy__label--idle" lang="en" data-copy-idle>Copy</span>
              <span class="c-copy__label c-copy__label--done" lang="en" data-copy-done>Copied!</span>
            </button>
          </div>
        </div>

        <div class="c-modal__panel" id="code-modal-panel" role="tabpanel" data-modal-panel hidden>
          <div class="c-code" data-modal-codeframe hidden>
            <div class="c-code__scroll" tabindex="0" data-modal-scroll>
              <pre class="c-code__pre"><code data-modal-code></code></pre>
            </div>
            <span class="c-code__fade" aria-hidden="true" data-modal-fade hidden></span>
          </div>
          <p class="c-modal__message" data-modal-message hidden></p>
        </div>

        <ul class="c-modal__notes" role="list" data-modal-notes hidden></ul>

        <p class="c-modal__verify" data-modal-verify></p>

        <div class="c-modal__foot">
          <a class="c-modal__link" data-modal-article hidden>解説記事へ<span class="c-arrow" aria-hidden="true">→</span></a>
          <a class="c-modal__link c-modal__link--demo" target="_blank" rel="noopener" data-modal-demo><span data-modal-demo-label>デモを別タブで開く</span><span class="c-ext" aria-hidden="true">↗</span></a>
        </div>
      </div>
      <p class="c-modal__toast" data-modal-toast></p>
      <p class="u-sr-only" role="status" data-modal-announce></p>
    </dialog>`;
}
