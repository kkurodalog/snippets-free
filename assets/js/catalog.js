/**
 * カタログ外殻のスクリプト。バンドルしない（ES modules をそのまま配信する）。
 *
 * 持っている機能は4つ。
 * - 開閉する面（ヘッダーの「カテゴリ ▾」／ハンバーガーのドロワー）
 * - タグフィルタ（カテゴリ一覧）
 * - 動画プレビューの再生制御（ビューポート内だけ再生 / 全停止トグル / 動きを減らす設定では止める）
 * - コードモーダルの起動（assets/js/code-modal.js / カード上の [HTML][CSS][JS] を格上げする）
 *
 * 決めていること
 * - ホバーで開かない。開閉は「押す」操作で行う（タップ / Enter / Space）。
 *   タッチデバイスに hover は無く、キーボードにも hover は来ない。
 * - 状態は aria-expanded と記号の向きで示す。色に依存させない。
 * - 閉じるのは Esc・パネル外の操作・項目の選択・フォーカスが外へ出たとき。
 * - 矢印キー・Home・End で項目を移動できる。
 *
 * 〜599px のハンバーガーはドロワー型（下の Drawer）。暗幕と閉じるボタンが増えるだけで、
 * 上の決めごとはそのまま効く。
 */

import { CodeModal } from './code-modal.js';

/* ナビの導線が切り替わる幅。600px 以上はドロップダウン、〜599px はハンバーガー。
   ⚠️ style.css 側の .l-header__nav / .c-nav-toggle・.c-nav-overlay・.c-nav-drawer と
      同じ値にする。ずれると、導線が切り替わったのに開いたままの面が残る。
   ⚠️ 900px はカード3列などに使い続ける別の境界であり、ここでは使わない。 */
const BREAKPOINT_NAV = '(min-width: 600px)';

/** パネルの中でフォーカスを移せる要素。 */
function focusables(panel) {
  return Array.from(panel.querySelectorAll('a[href], button:not([disabled])'));
}

class Disclosure {
  constructor(toggle) {
    this.toggle = toggle;
    this.panel = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!this.panel) return;

    // 外側クリック・フォーカス外れの判定に使う範囲。
    this.scope = toggle.closest('[data-disclosure]') || toggle.closest('header') || document.body;

    this.panel.removeAttribute('hidden');
    this.close();

    this.toggle.addEventListener('click', () => this.togglePanel());
    this.toggle.addEventListener('keydown', (e) => this.onToggleKeydown(e));
    this.panel.addEventListener('keydown', (e) => this.onPanelKeydown(e));
    this.panel.addEventListener('click', (e) => {
      if (e.target.closest('a')) this.close();
    });
    this.scope.addEventListener('focusout', (e) => {
      if (!this.isOpen()) return;
      // ⚠️ フォーカスが「どこへも移らずに」抜けた場合は閉じない。
      //    ここが受け持つのは Tab で外へ出た場合だけであり、外側を押して閉じるのは
      //    下の pointerdown が受け持つ。両方で閉じにいくと、押下の途中で面が閉じて
      //    pointer-events が外れ、離した先が別の要素になって click が届かなくなる
      //    （暗幕を押して閉じたときにフォーカスが戻らない形で実際に出た）。
      if (!e.relatedTarget) return;
      if (this.scope.contains(e.relatedTarget)) return;
      this.close();
    });
  }

  isOpen() {
    return this.toggle.getAttribute('aria-expanded') === 'true';
  }

  open() {
    this.toggle.setAttribute('aria-expanded', 'true');
    this.panel.classList.add('is-open');
    this.alignPanel();
  }

  close() {
    this.toggle.setAttribute('aria-expanded', 'false');
    this.panel.classList.remove('is-open');
    this.panel.classList.remove('is-align-end');
  }

  closeAndFocus() {
    if (!this.isOpen()) return;
    this.close();
    this.toggle.focus();
  }

  togglePanel() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  /** パネルがコンテナ右端からはみ出す場合だけ右端揃えに切り替える（横スクロールを出さないため）。 */
  alignPanel() {
    if (this.panel.classList.contains('c-dropdown__panel') !== true) return;
    this.panel.classList.remove('is-align-end');
    const rect = this.panel.getBoundingClientRect();
    if (rect.right > document.documentElement.clientWidth) {
      this.panel.classList.add('is-align-end');
    }
  }

  moveFocus(index) {
    const items = focusables(this.panel);
    if (items.length === 0) return;
    const i = (index + items.length) % items.length;
    items[i].focus();
  }

  onToggleKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.isOpen()) this.open();
      this.moveFocus(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.isOpen()) this.open();
      this.moveFocus(-1);
    } else if (e.key === 'Escape') {
      this.closeAndFocus();
    }
  }

  onPanelKeydown(e) {
    const items = focusables(this.panel);
    const current = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeAndFocus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.moveFocus(current + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.moveFocus(current - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.moveFocus(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.moveFocus(-1);
    }
  }
}

/**
 * ドロワー型の開閉。〜599px のヘッダーで使う。
 * 方式は掲載パーツ components/navigation/004_hamburger-overlay から採っている
 * （右から入る面 ＋ 背面の暗幕 ＋ 面の中の独立した閉じるボタン）。
 *
 * 上の Disclosure との差は3つだけ。
 * - 暗幕の表示を面と一緒に切り替える。暗幕を押したら閉じる。
 * - 面の中の閉じるボタンで閉じる。
 * - 開いている間は背面のスクロールを止める。
 *
 * 変わらないもの — Esc・外側の操作・フォーカスが外へ出たとき・幅が変わったときに閉じる。
 * ⚠️ トリガーの3本線を × に変形させない。閉じる手段は面の中の閉じるボタンが持つ。
 *
 * フォーカスの行き先
 * - 開いたとき: 面の中の閉じるボタン（面の中で最初に押せるもの）。
 * - 閉じたとき: トリガー（ハンバーガー）。ただし項目を選んで遷移する場合と、
 *   フォーカスが外へ出て閉じた場合は動かさない（利用者が移した先を奪わない）。
 */
class Drawer extends Disclosure {
  constructor(toggle) {
    super(toggle);
    if (!this.panel) return;

    this.overlay = document.getElementById(toggle.dataset.disclosureOverlay || '');
    // ⚠️ closeAndFocus() を使わない。暗幕を押した時点でフォーカスがどこへも移らず抜けるため、
    //    先に focusout 側が閉じてしまい、「閉じていたら何もしない」の判定に弾かれる。
    //    暗幕は閉じている間 pointer-events: none なので、閉じた状態で押されることはない。
    if (this.overlay) {
      this.overlay.addEventListener('click', () => {
        this.close();
        this.toggle.focus();
      });
    }

    this.closeButton = this.panel.querySelector('[data-disclosure-close]');
    if (this.closeButton) this.closeButton.addEventListener('click', () => this.closeAndFocus());

    // 上の super() の中で一度 close() を通っているが、その時点ではまだ暗幕を掴んでいない。
    // 掴んだ後にもう一度、閉じた状態へ揃える。
    this.close();
  }

  open() {
    super.open();
    if (this.overlay) this.overlay.classList.add('is-open');
    document.documentElement.classList.add('is-nav-open');
    if (this.closeButton) this.closeButton.focus();
  }

  close() {
    super.close();
    if (this.overlay) this.overlay.classList.remove('is-open');
    document.documentElement.classList.remove('is-nav-open');
  }
}

/**
 * タグフィルタ（カテゴリ一覧）。
 *
 * 決めていること
 * - 単一選択。複数選択は件数規模で利得がなく、状態管理と読み上げのコストだけ増える。
 * - 状態は `aria-pressed` が持つ。見た目（塗りの反転・太字・✓）は CSS が引き受ける。
 * - URL を書き換えない（フィルタ状態を URL に持たない）。
 * - JS 無効時は UI ごと出さない（CSS の .no-js で下げる）。全件がそのまま並ぶ。
 *
 * ⚠️ カードのタグはカンマ区切りで持つ。タグ名に空白を含むものがあるため、
 *    空白区切りにすると1つのタグが2つに割れる。
 */
class TagFilter {
  constructor(root) {
    this.buttons = Array.from(root.querySelectorAll('[data-tag]'));
    const list = document.querySelector('[data-cards]');
    this.cards = list ? Array.from(list.children) : [];
    if (this.buttons.length === 0 || this.cards.length === 0) return;

    root.addEventListener('click', (e) => {
      const button = e.target.closest('[data-tag]');
      if (button) this.select(button);
    });

    const initial = this.buttons.find((b) => b.getAttribute('aria-pressed') === 'true');
    this.select(initial || this.buttons[0]);
  }

  select(button) {
    const tag = button.dataset.tag;
    for (const b of this.buttons) b.setAttribute('aria-pressed', b === button ? 'true' : 'false');
    for (const card of this.cards) {
      const tags = (card.dataset.tags || '').split(',');
      card.hidden = tag !== '' && !tags.includes(tag);
    }
  }
}

/**
 * 動画プレビュー。
 *
 * - `autoplay` を使わない。ビューポートに入ったときだけ再生し、外れたら止める。
 * - `preload="none"` と合わせて、初期表示では1本も読み込まない。
 * - ⚠️ 自動で動き続けるものには、ページの中に止める手段が要る（WCAG 2.2.2 / Level A）。
 *   `loop` が付いており5秒を超えて動き続けるため、**一覧に全停止トグルを1つ置く**。
 *   ⚠️ 「ビューポート内だけ再生する」方式そのものは変えない。止める手段を足しただけである。
 * - ⚠️ 動きを減らす設定では自動再生しない。poster を出したまま「再生」を1つ置き、
 *   利用者が押したときだけ再生する。押せる形を残すのは、動きを見たい人の出口を塞がないため。
 * - JS 無効時は poster が静止画として出るだけで壊れない。
 *
 * ★停止中の状態は1つに統合してある。
 *   利用者が全停止トグルを押した状態と、動きを減らす設定の状態は**同じ状態**であり、
 *   どちらも「全件停止 ＋ 各カードに『▶ 再生』チップ」で表す。UI を二重に持たない。
 *
 * ★トグルを出す条件と押した状態は、**画面でいま動いているもの**から決める。
 *   ⚠️ 当初は「動きを減らす設定のときは出さない」という固定の条件で組んでいたが、
 *      その理由（押しても状態が変わらないボタンになる）は**最初に再生チップを押すまでしか
 *      成り立たない**。押せば動画は動き出し、その設定の利用者にだけ止める手段が無くなる。
 *      `loop` が付いているので、止めなければ動き続ける。
 *   そこで条件を2つとも「実際に再生中のものがあるか」で決める形に変えた。
 *     - 出す条件   … 動きを減らす設定のときは、**再生中のものが1つでもある間だけ**出す
 *                    （何も動いていないのに「止める」ボタンを置かない、は保つ）
 *     - 押した状態 … 「止まっていること」を表す。停止中でも個別再生が残っていれば押していない状態
 *   ⚠️ この形にすると、停止中に再生チップで動かしたものも**トグル1回で止まる**。
 *      以前は「解除 → 全部動き出す → もう一度止める」の2回押しになっていた。
 *
 * ★停止の選択はページの中だけで保つ（ページをまたいで覚えない）。
 *   理由は3つ。(1) 覚えると、次に開いた利用者に「動かない理由が画面から分からない」
 *   状態を渡すことになる (2) 「常に動きを減らしたい」という恒久的な意思は
 *   `prefers-reduced-motion` が受け持つ層であり、その層と役割が二重になる
 *   (3) 保存領域は同一オリジンの掲載デモとも共有され、影響範囲がこの一覧を越える。
 */
function initPreviewVideos() {
  const videos = Array.from(document.querySelectorAll('[data-preview-video]'));
  const toggle = document.querySelector('[data-stop-videos]');
  // ⚠️ 動画が1本も無いときはトグルを出さない（hidden のまま残す）。
  //    収録素材が入るまでの間、押しても何も起きないボタンを画面に置かないため。
  if (videos.length === 0) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** 利用者が全停止トグルを押しているか。動きを減らす設定とは別に持つ。 */
  let stoppedByUser = false;
  const isStopped = () => reduce.matches || stoppedByUser;

  /**
   * ⚠️ `play()` の返す Promise を受け取らないと、自動再生がブロックされたときや
   *    素材の取得に失敗したときに未処理の拒否がコンソールへ出る。
   *    握りつぶす代わりに、失敗したら「▶ 再生」チップを出して利用者の出口を残す。
   */
  /** いま1本でも再生中か。トグルの出す条件と押した状態は、どちらもこれで決まる。 */
  const anyPlaying = () => videos.some((video) => !video.paused);

  /**
   * トグルの見え方を、いまの再生状況に合わせる。
   * - 出す条件   … 動きを減らす設定のときは、再生中のものがある間だけ出す
   * - 押した状態 … 「止まっている」ことを表す（利用者が押したかどうかではない）
   */
  const syncToggle = () => {
    if (!toggle) return;
    const playing = anyPlaying();
    toggle.hidden = reduce.matches && !playing;
    toggle.setAttribute('aria-pressed', isStopped() && !playing ? 'true' : 'false');
  };

  const play = (video) => {
    const started = video.play();
    // ⚠️ play() は paused を同期で false にする。押した直後の状態でトグルを合わせられる。
    syncToggle();
    if (started && typeof started.catch === 'function') {
      started.catch(() => {
        addPlayButton(video);
        syncToggle();
      });
    }
  };

  function addPlayButton(video) {
    const frame = video.parentElement;
    if (!frame || frame.querySelector('.c-preview__play')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'c-preview__play';
    const glyph = document.createElement('span');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = '▶';
    const label = document.createElement('span');
    label.textContent = '再生';
    button.append(glyph, label);
    button.setAttribute('aria-label', `再生: ${video.getAttribute('aria-label') || ''}`.trim());
    button.addEventListener('click', () => {
      button.remove();
      play(video);
    });
    frame.append(button);
  }

  const removePlayButton = (video) => {
    const frame = video.parentElement;
    const button = frame && frame.querySelector('.c-preview__play');
    if (button) button.remove();
  };

  let observer = null;

  const apply = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (isStopped()) {
      for (const video of videos) {
        video.pause();
        addPlayButton(video);
      }
      syncToggle();
      return;
    }

    syncToggle();

    for (const video of videos) removePlayButton(video);
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) play(entry.target);
          else entry.target.pause();
        }
      },
      { threshold: 0.25 }
    );
    for (const video of videos) observer.observe(video);
  };

  if (toggle) {
    toggle.addEventListener('click', () => {
      // ⚠️ 反転させない。「止まっているなら再生へ、そうでなければ停止へ」で決める。
      //    停止中に再生チップで動かしたものが残っている場合、反転させると
      //    いったん全部動き出してしまう（止めたいのに動く）。
      const allStopped = isStopped() && !anyPlaying();
      // 動きを減らす設定では「全部再生する」を用意しない（その層の意思を上書きしない）。
      stoppedByUser = allStopped ? false : true;
      apply();
    });
  }

  reduce.addEventListener('change', apply);
  apply();

  /**
   * モーダルが開いている間だけ動画を止めるための口。
   *
   * ★止めるのは「利用者が止めた」のとは別の事情である。
   *   したがって stoppedByUser もトグルの押した状態も動かさない。
   *   ⚠️ 背面は暗幕（78% 不透明）越しに薄く見える。動き続けると読む面の邪魔になる。
   * ★閉じたら元の状態へ戻す。停止中に個別再生していたものは、その1本だけを戻す
   *   （apply() を通すと停止中の判定に吸い込まれ、利用者が動かしていたものまで止まる）。
   */
  let suspended = [];
  return {
    suspend() {
      suspended = videos.filter((video) => !video.paused);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      for (const video of videos) video.pause();
    },
    resume() {
      if (isStopped()) for (const video of suspended) play(video);
      else apply();
      suspended = [];
    },
  };
}

function init() {
  const instances = Array.from(document.querySelectorAll('[data-disclosure-toggle]')).map((toggle) =>
    toggle.hasAttribute('data-disclosure-overlay') ? new Drawer(toggle) : new Disclosure(toggle)
  );

  for (const root of document.querySelectorAll('[data-tagfilter]')) new TagFilter(root);
  const previews = initPreviewVideos();

  // カード上の [HTML][CSS][JS] をモーダルへ格上げする。
  // ⚠️ 格上げできない環境では素のリンクのままにする（code-modal.js 側で判定する）。
  const modal = document.querySelector('[data-code-modal]');
  if (modal) {
    new CodeModal(modal, {
      onOpen: () => previews?.suspend(),
      onClose: () => previews?.resume(),
    });
  }

  document.addEventListener('pointerdown', (e) => {
    for (const d of instances) {
      if (!d.panel || !d.isOpen()) continue;
      if (d.scope.contains(e.target)) continue;
      d.close();
    }
  });

  // 幅が変わって導線ごと切り替わったときに、開いたままの面を残さない。
  const nav = window.matchMedia(BREAKPOINT_NAV);
  const closeAll = () => instances.forEach((d) => d.panel && d.close());
  nav.addEventListener('change', closeAll);

  // ここまで到達したことを <html> に記録する。
  // これが付かないまま読み込みが終わったら、<head> のインラインが no-js へ戻し、
  // 押しても何も起きない操作要素を画面から下げる（取得失敗・解析エラーへの備え）。
  document.documentElement.classList.add('js-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
