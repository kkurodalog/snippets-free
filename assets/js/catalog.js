/**
 * カタログ外殻のスクリプト。バンドルしない（ES modules をそのまま配信する）。
 *
 * 今のところ持っている機能は開閉する面（ヘッダーの「カテゴリ ▾」／ハンバーガー）だけ。
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

function init() {
  const instances = Array.from(document.querySelectorAll('[data-disclosure-toggle]')).map((toggle) =>
    toggle.hasAttribute('data-disclosure-overlay') ? new Drawer(toggle) : new Disclosure(toggle)
  );

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
