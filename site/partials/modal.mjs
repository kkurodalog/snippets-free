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
 * ★注記の `<ul>` に `role="list"` を明示する。
 *   ⚠️ `list-style: none` を当てると、環境によってはリストとして読まれなくなる。
 *      見た目のために意味を落とさない。
 */
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
          <button type="button" class="c-copy" data-modal-copy hidden>コピー</button>
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
          <a class="c-modal__link c-modal__link--demo" target="_blank" rel="noopener" data-modal-demo>デモを別タブで開く<span class="c-ext" aria-hidden="true">↗</span></a>
        </div>
      </div>
      <p class="c-modal__toast" role="status" data-modal-toast></p>
    </dialog>`;
}
