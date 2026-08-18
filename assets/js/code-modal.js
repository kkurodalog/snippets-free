/**
 * コードモーダル（`<dialog>` / カテゴリ一覧に1つだけ）。
 *
 * カード上の [HTML][CSS][JS] を押すと、そのファイルを読んで
 * 掲載範囲マーカーの内側だけを見せ、その場でコピーさせる。
 *
 * 決めていること
 * - ★コードの写しをカタログ側に持たない。**開いたときに実ファイルを取得する**。
 *   「デモを直したのにコピーされるコードが古い」が構造的に起きない。
 * - ★表示範囲とコピー範囲は同じ値から作る（assets/js/snippet-marker.js の戻り値1本）。
 *   見えているものがそのままコピーされる状態を崩さない。
 * - ★`<dialog>` の `showModal()` で開く。フォーカストラップと Esc 閉じは標準機能に任せる。
 *   ⚠️ 自前でトラップを書かない。書くと標準の挙動と二重になる。
 * - 閉じたら呼び出し元のボタンへフォーカスを戻す（どのカードから開いたか分からなくなるため）。
 * - 開いている間は背面のスクロールを止める。閉じたら位置はそのまま残る。
 *
 * プログレッシブエンハンスメント
 * - 初期 DOM ではコードボタンは**そのファイルへの素のリンク**である。
 *   ここで初めてモーダルへ格上げする。⚠️ 格上げできない環境（`showModal` が無い等）では
 *   `preventDefault()` を呼ばず、リンクとしての動きをそのまま残す。
 * - ⚠️ JS 無効ではモーダルの操作要素を画面に出さない（style.css の `.no-js`）。
 *
 * 取得に失敗したとき
 * - ★空のモーダルを出さない。失敗した旨と**デモページへの導線**を出す。
 *   モーダルに GitHub リンクを置かない決定により、出口はデモページ1本である。
 */

import { extractSnippet, MARKER_STATUS } from './snippet-marker.js';
import { highlight } from './code-highlight.js';

/** 種別 → 画面のラベル。カードのボタンの文字をそのまま使うので、ここは読み上げ名だけに使う。 */
const KIND_LABELS = { html: 'HTML', css: 'CSS', js: 'JS' };

/** 取得結果を保持する（同じファイルを2度取りに行かない）。キーは解決済みの URL。 */
const cache = new Map();

/**
 * トーストの滞留時間。
 * ⚠️ 結果の通知（「コピーしました」）と**手順の指示**（手でコピーする案内）を同じ長さにしない。
 *    指示のほうは読み終える前に消えると、案内した操作にたどり着けない。
 */
const TOAST_MS = { short: 2400, long: 6000 };

/**
 * ファイルを取得してマーカー間を取り出す。
 * @returns {Promise<{ok: true, code: string} | {ok: false, reason: 'fetch'|'none'|'marker'}>}
 */
async function loadSnippet(url) {
  if (cache.has(url)) return cache.get(url);

  let result;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const text = await response.text();
    const snippet = extractSnippet(text);
    if (snippet.status === MARKER_STATUS.OK) result = { ok: true, code: snippet.code };
    else if (snippet.status === MARKER_STATUS.NONE) result = { ok: false, reason: 'none' };
    else result = { ok: false, reason: 'marker' };
  } catch {
    // ⚠️ file:// で直接開くと取得が拒否される。ローカル確認は必ずローカル配信で行う。
    result = { ok: false, reason: 'fetch' };
  }

  // ★保持するのは成功した結果だけである。
  //   ⚠️ 失敗まで保持すると、通信が一時的に落ちていただけでも
  //      ページを読み直すまで「コードを取得できなかった。」が固定される。
  //      保持の目的は「同じものを2度取りに行かない」であって、失敗の記憶ではない。
  if (result.ok) cache.set(url, result);
  return result;
}

export class CodeModal {
  /**
   * @param {HTMLDialogElement} dialog
   * @param {{onOpen?: () => void, onClose?: () => void}} [hooks] 開閉に合わせて外側が止めたいもの（動画など）
   */
  constructor(dialog, hooks = {}) {
    this.dialog = dialog;
    this.hooks = hooks;
    this.supported = typeof dialog.showModal === 'function';
    if (!this.supported) return;

    const $ = (name) => dialog.querySelector(`[data-modal-${name}]`);
    this.el = {
      title: $('title'),
      close: $('close'),
      tabs: $('tabs'),
      path: $('path'),
      copy: $('copy'),
      panel: $('panel'),
      codeframe: $('codeframe'),
      scroll: $('scroll'),
      code: $('code'),
      fade: $('fade'),
      message: $('message'),
      notes: $('notes'),
      verify: $('verify'),
      article: $('article'),
      demo: $('demo'),
      toast: $('toast'),
    };

    this.meta = readPartsMeta();
    this.opener = null;
    this.current = null; // { slug, name, dir, files: [{kind, url}], activeKind }
    this.toastTimer = 0;
    // 取得の前後で開き直しが起きたことを判定する連番（render() が使う）。
    this.renderToken = 0;
    this.pressedBackdrop = false;

    // ★格上げした時点で「押すとダイアログが開く」ことを読み上げ側にも出す。
    //   ⚠️ 属性を初期 DOM に書かない。JS が無効・格上げできない環境ではリンクのままであり、
    //      そこで「ダイアログが開く」と読ませると、読み上げ名と実挙動が食い違う。
    for (const button of document.querySelectorAll('[data-code-kind]')) {
      button.setAttribute('aria-haspopup', 'dialog');
    }

    // カード上のコードボタンを1本の委譲で受ける（カードが増えてもリスナーは増えない）。
    document.addEventListener('click', (e) => this.onDocumentClick(e));

    this.el.close.addEventListener('click', () => this.dialog.close());
    this.el.copy.addEventListener('click', () => this.copy());
    this.el.tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) this.selectKind(tab.dataset.kind, { focus: true });
    });
    this.el.tabs.addEventListener('keydown', (e) => this.onTabsKeydown(e));
    this.el.scroll.addEventListener('scroll', () => this.updateFade());

    // 背景（バックドロップ）を押したら閉じる。
    // ⚠️ 余白を押したときに閉じないよう、`<dialog>` 自身の内側余白は 0 にしてある
    //    （余白は .c-modal__inner が持つ）。したがって target が dialog なのは背景のときだけである。
    // ★閉じる判定は「押し始めた場所」で行う。click だけを見ると、コードをドラッグで選んで
    //   枠の外で離したときに click の target が <dialog> になり、**モーダルが閉じて選択も消える**。
    //   ⚠️ それはコピーに失敗したときこちらが案内している操作そのものである
    //      （「コードを選択した。キーボード操作でコピーする」）。案内した操作で画面を壊さない。
    this.dialog.addEventListener('pointerdown', (e) => {
      this.pressedBackdrop = e.target === this.dialog;
    });
    this.dialog.addEventListener('click', (e) => {
      const fromBackdrop = this.pressedBackdrop;
      this.pressedBackdrop = false;
      if (e.target === this.dialog && fromBackdrop) this.dialog.close();
    });

    // Esc・閉じるボタン・背景クリックのすべてがここへ集まる（後始末を1箇所にする）。
    this.dialog.addEventListener('close', () => this.afterClose());
  }

  onDocumentClick(e) {
    // ⚠️ 修飾キー付きのクリック・主ボタン以外のクリックを飲み込まない。
    //    「新しいタブで開く」は**ソースへ到達する別経路**であり、格上げできない環境で
    //    リンクの動きを残すという方針と同じ話である。ここで潰すと方針の適用漏れになる。
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    const button = e.target.closest('[data-code-kind]');
    if (!button) return;
    const card = button.closest('.c-card');
    if (!card) return;
    e.preventDefault();
    this.open({ card, kind: button.dataset.codeKind, opener: button });
  }

  /** カードの DOM から、そのパーツの情報を読む（同じ値をページに2度書かないため）。 */
  readCard(card) {
    const buttons = Array.from(card.querySelectorAll('[data-code-kind]'));
    const demo = card.querySelector('.c-btn-demo');
    return {
      slug: buttons[0]?.dataset.part || '',
      name: card.querySelector('.c-card__title')?.textContent.trim() || '',
      demoHref: demo ? demo.getAttribute('href') : '',
      files: buttons.map((b) => ({
        kind: b.dataset.codeKind,
        href: b.getAttribute('href'),
        url: b.href,
      })),
    };
  }

  open({ card, kind, opener }) {
    this.opener = opener;
    this.current = { ...this.readCard(card), activeKind: kind };

    this.el.title.textContent = this.current.name;
    this.el.demo.href = this.current.demoHref;
    this.el.demo.setAttribute('aria-label', `デモを別タブで開く: ${this.current.name}`);

    this.renderTabs();
    this.renderMeta();
    this.selectKind(kind, { focus: false });

    this.dialog.showModal();
    document.documentElement.classList.add('is-modal-open');
    if (this.hooks.onOpen) this.hooks.onOpen();
  }

  afterClose() {
    document.documentElement.classList.remove('is-modal-open');
    this.clearToast();
    if (this.hooks.onClose) this.hooks.onClose();
    // ★呼び出し元のボタンへ戻す。どのカードから開いたか分からなくなるのを防ぐ。
    if (this.opener && this.opener.isConnected) this.opener.focus();
    this.opener = null;
  }

  /** タブは「そのパーツが持つ言語だけ」出す。カードのボタン構成と必ず一致する。 */
  renderTabs() {
    this.el.tabs.replaceChildren();
    for (const file of this.current.files) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'c-modal__tab';
      tab.id = `code-modal-tab-${file.kind}`;
      tab.dataset.kind = file.kind;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'code-modal-panel');
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;
      tab.textContent = KIND_LABELS[file.kind] || file.kind;
      this.el.tabs.append(tab);
    }
  }

  /** 注記・検証行・記事リンク。データが無い項目は出さない（空の枠を残さない）。 */
  renderMeta() {
    const info = this.meta.parts[this.current.slug] || {};

    // 注記（最大3項目・言い切り）
    this.el.notes.replaceChildren();
    const notes = Array.isArray(info.notes) ? info.notes : [];
    this.el.notes.hidden = notes.length === 0;
    for (const note of notes) {
      const li = document.createElement('li');
      li.className = 'c-modal__note';
      li.textContent = note;
      this.el.notes.append(li);
    }

    // ★検証行 — 述べるのは掲載基準4項目の充足と、その実測日である。
    //   ⚠️ ブラウザの動作確認に置き換えない。掲載基準を表明する面はこの1行しかない。
    //   ⚠️ 満たしていない項目は黙って落とさず、明示する。
    this.el.verify.replaceChildren();
    const items = this.meta.verificationItems;
    if (!info.verification || !info.verifiedOn) {
      this.el.verify.append(document.createTextNode('検証情報は準備中'));
    } else {
      const met = items.filter((i) => info.verification[i.key] === true);
      const unmet = items.filter((i) => info.verification[i.key] !== true);
      // ⚠️ 実測日は「いつ測ったか」であって「何を満たしたか」ではない。
      //    充足0件のときこそ日付が要る（古い判定を新しい判定と読み違えないため）。
      //    ⚠️ 以前は「検証済み」の分岐の中でだけ日付を足しており、
      //       4項目すべて未達のパーツで日付が画面から消えていた。
      const date = document.createElement('span');
      date.className = 'c-modal__date';
      date.textContent = info.verifiedOn;

      if (met.length > 0) {
        this.el.verify.append(
          document.createTextNode(`検証済み: ${met.map((i) => i.label).join(' / ')}`)
        );
        // ⚠️ 余白を margin だけで作らない。読み上げでは「実挙動の実測2026-08-18」と
        //    1語につながって読まれる。区切りは文字として持たせる。
        this.el.verify.append(document.createTextNode(' '), date);
      }
      if (unmet.length > 0) {
        const note = document.createElement('span');
        note.className = 'c-modal__unmet';
        note.append(document.createTextNode(`未達: ${unmet.map((i) => i.label).join(' / ')}`));
        // 充足が1件も無いときは、未達の行の末尾へ日付を付ける（行を1本増やさない）。
        if (met.length === 0) note.append(document.createTextNode(' '), date);
        this.el.verify.append(note);
      }
    }

    // ★記事が無いパーツでは記事リンクを出さない。非活性にしない。
    if (info.article) {
      this.el.article.href = info.article;
      this.el.article.target = '_blank';
      this.el.article.rel = 'noopener';
      this.el.article.hidden = false;
    } else {
      this.el.article.removeAttribute('href');
      this.el.article.hidden = true;
    }
  }

  selectKind(kind, { focus }) {
    const file = this.current.files.find((f) => f.kind === kind) || this.current.files[0];
    if (!file) return;
    this.current.activeKind = file.kind;

    for (const tab of this.el.tabs.children) {
      const active = tab.dataset.kind === file.kind;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    this.el.panel.setAttribute('aria-labelledby', `code-modal-tab-${file.kind}`);
    this.el.path.textContent = stripLeadingDot(file.href);

    this.render(file);
  }

  async render(file) {
    // ★取得を待ちに入る前に、前のファイルの中身を画面から落とす。
    //   ⚠️ 落とさないと、切り替えた直後に「タブとパスは新しいファイル・コード枠とコピーボタンは
    //      前のファイル」という窓ができる。その窓でコピーを押すと、**画面に見えているものと
    //      違うコードがクリップボードへ入る**。しかも**誤りが画面から分からない**。
    //      表示範囲とコピー範囲を一致させるという、このモーダルの前提そのものが崩れる。
    //   ⚠️ 下の連番ガードは**取得が終わったあと**の判定であり、この窓は塞げない。両方が要る。
    const token = ++this.renderToken;
    this.code = '';
    // 中身も空にする。隠すだけだと、前のファイルの文字列が DOM に残ったままになる。
    this.el.code.replaceChildren();
    this.el.panel.hidden = true;
    this.el.codeframe.hidden = true;
    this.el.fade.hidden = true;
    this.el.message.hidden = true;
    this.el.copy.hidden = true;

    const result = await loadSnippet(file.url);
    // ★取得の前後で別のものを開き直していたら、この結果は捨てる。
    //   ⚠️ 種類（kind）だけを見ると、**別のパーツの同じ種類**を開き直したときに素通りし、
    //      前のパーツのコードが新しいパーツの名前とパスの下に出る。連番で判定する。
    if (token !== this.renderToken) return;

    if (result.ok) {
      this.code = result.code;
      this.el.code.replaceChildren(highlight(result.code, file.kind));
      this.el.panel.hidden = false;
      this.el.codeframe.hidden = false;
      this.el.message.hidden = true;
      this.el.copy.hidden = false;
      this.el.scroll.scrollTop = 0;
      this.updateFade();
      return;
    }

    // ★失敗しても空のモーダルにしない。何が起きたかと、デモページへの導線を出す。
    this.code = '';
    this.el.panel.hidden = false;
    this.el.codeframe.hidden = true;
    this.el.copy.hidden = true;
    this.el.fade.hidden = true;
    this.el.message.hidden = false;
    this.el.message.replaceChildren();
    this.el.message.append(document.createTextNode(MESSAGES[result.reason]));
    const link = document.createElement('a');
    link.className = 'c-modal__link';
    link.href = this.current.demoHref;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(document.createTextNode('デモを別タブで開く'));
    const glyph = document.createElement('span');
    glyph.className = 'c-ext';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = '↗';
    link.append(glyph);
    this.el.message.append(link);
  }

  /**
   * コード枠の下端のフェード帯。
   * 「まだ下に続く」ことを示す唯一の手がかりであり、続きが無いときは出さない。
   */
  updateFade() {
    const el = this.el.scroll;
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    this.el.fade.hidden = remaining <= 1;
  }

  async copy() {
    if (!this.code) return;
    try {
      await navigator.clipboard.writeText(this.code);
      this.toast('コピーしました');
    } catch {
      // ★失敗を隠さない。コードを選択状態にして、手で（キーボードで）コピーさせる。
      selectContents(this.el.code);
      // ⚠️ 失敗のトーストは**手順の指示**である。読み終える前に消さない。
      this.toast('コピーできなかった。コードを選択した。キーボード操作でコピーする', TOAST_MS.long);
    }
  }

  toast(text, duration = TOAST_MS.short) {
    this.clearToast();
    this.el.toast.textContent = text;
    this.el.toast.classList.add('is-visible');
    this.toastTimer = window.setTimeout(() => this.clearToast(), duration);
  }

  clearToast() {
    window.clearTimeout(this.toastTimer);
    this.el.toast.classList.remove('is-visible');
    this.el.toast.textContent = '';
  }

  onTabsKeydown(e) {
    const tabs = Array.from(this.el.tabs.children);
    const index = tabs.indexOf(document.activeElement);
    if (index === -1) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    this.selectKind(tabs[next].dataset.kind, { focus: true });
  }
}

/**
 * コードを出せなかったときの文言。
 * ⚠️ 文だけで終わらせない。**必ずデモページへの導線を隣に置く**（render() が付ける）。
 *    モーダルから GitHub リンクを外したため、出口はデモページ1本しかない。
 * ⚠️ 空のモーダルにしない。「何も無い」のではなく「いま何が無いか」を出す。
 */
const MESSAGES = {
  fetch: 'コードを取得できなかった。',
  none: 'コードの掲載範囲は準備中。',
  marker: 'コードの掲載範囲の指定が正しくない。',
};

/** `./001_js-toggle/assets/css/style.css` → `001_js-toggle/assets/css/style.css` */
function stripLeadingDot(href) {
  return String(href).replace(/^\.\//, '');
}

/** 要素の中身を選択状態にする（コピー失敗時のフォールバック）。 */
function selectContents(element) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * 生成側が置いた「コードでは表せない情報」を読む。
 * ⚠️ 壊れていても画面を落とさない。空として扱い、検証行は「準備中」に落ちる。
 */
function readPartsMeta() {
  const script = document.querySelector('[data-parts-meta]');
  const empty = { verificationItems: [], parts: {} };
  if (!script) return empty;
  try {
    const data = JSON.parse(script.textContent);
    return { verificationItems: data.verificationItems || [], parts: data.parts || {} };
  } catch {
    return empty;
  }
}
