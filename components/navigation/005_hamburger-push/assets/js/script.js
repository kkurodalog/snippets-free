/**
 * 005_hamburger-push
 * ナビゲーションが右から出ると同時に、ページの内容が左へ押し出される形。
 *
 * 構造
 * - 押し出される側は c-push-wrapper である。ページの内容をこの中に置く
 * - ヘッダーは wrapper の外に置く。押し出しても動かない固定ヘッダーにするため
 * - c-push-cover は押し出されている間だけ前面に出る。中のリンクやボタンを
 *   誤って押さないようにし、押されたら閉じる
 *
 * 設計
 * - HTML は「ナビのリンクがそのまま読める」状態で書き、ハンバーガーボタンは JS が組み立てる。
 *   JS が動かない環境ではリンクが全部読め、押しても何も起きないボタンも残らない。
 * - 仕掛け終えたナビに data-hamburger-push-ready を付ける。閉じた見せ方（画面外への移動と
 *   visibility: hidden）は CSS 側でこの印の中だけに置いてある。
 * - 掲載範囲の先頭にあるインラインスクリプトは、開く前の状態が一瞬見えるのを防ぐためのもの。
 *
 * 画面幅と aria-hidden
 * - 768px 以上ではナビが常に見えているため aria-hidden を外す。
 *   起動時にも同じ関数を通し、いまの画面幅で判断する
 *   （matchMedia の change だけに任せると、最初から広い画面で開いたときに一度も外れない）。
 *
 * 動き
 * - ボタンに is-active、ナビに is-open、ラッパーに is-pushed を付け外しする
 * - ハンバーガーとナビ内の閉じるボタンは JS が組み立てる（004 と同じ形）。
 *   閉じる手段は「押し出された本文のクリック」「ナビ内の閉じるボタン」「Escape」の3つ
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - カバーのクリック、または Escape で閉じ、フォーカスをボタンへ戻す
 * - フォーカストラップの範囲はナビの中
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 数値の対応
 * - 開いた直後にフォーカスを移すまでの 300ms は、CSS の --push-transition
 *   （0.3s）と同じ値である。CSS 側を変えたらこの値も変える
 *
 * フォーカスの捕捉範囲
 * - 捕捉はナビの中だけに取る（004 と同じ形）。開いている間、ハンバーガーボタンは
 *   ナビの下に完全に隠れており、閉じるボタンと矩形が重なる。捕捉に含めると
 *   「同じ読み上げ名の停止が2つ続き、先の1つはフォーカスの輪郭が1画素も出ない」状態になる。
 * - 閉じる手段はナビの中の閉じるボタンと Escape、押し出された本文のクリックの3つで、
 *   どれもナビの外のボタンを必要としない
 *
 * スクロールロック
 * - 開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const header = document.querySelector(".c-header");
  const pushNav = document.querySelector(".c-push-nav");
  const pushWrapper = document.querySelector(".c-push-wrapper");
  const pushCover = document.querySelector(".c-push-cover");

  if (!header || !pushNav || !pushWrapper || !pushCover) return;

  function buildHamburger(controlsId) {
    const inner = header.querySelector(".c-header__inner");
    if (!inner) return null;

    const existing = inner.querySelector(".c-hamburger");
    if (existing) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "c-hamburger";
    button.setAttribute("aria-label", "メニューを開く");
    button.setAttribute("aria-expanded", "false");
    if (controlsId) {
      button.setAttribute("aria-controls", controlsId);
    }

    for (let i = 0; i < 3; i += 1) {
      const line = document.createElement("span");
      line.className = "c-hamburger__line";
      button.appendChild(line);
    }

    const inlineNav = inner.querySelector(".c-nav");
    if (inlineNav) {
      inner.insertBefore(button, inlineNav);
    } else {
      inner.appendChild(button);
    }
    return button;
  }

  function buildPushClose() {
    const existing = pushNav.querySelector(".c-push-nav__close");
    if (existing) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "c-push-nav__close";
    button.setAttribute("aria-label", "メニューを閉じる");

    const icon = document.createElement("span");
    icon.className = "c-push-nav__close-icon";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);

    pushNav.insertBefore(button, pushNav.firstChild);
    return button;
  }

  const hamburger = buildHamburger(pushNav.id);

  if (!hamburger) return;

  const pushClose = buildPushClose();
  const mediaQuery = window.matchMedia("(min-width: 768px)");

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openMenu() {
    hamburger.classList.add("is-active");
    pushNav.classList.add("is-open");
    pushWrapper.classList.add("is-pushed");

    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    pushNav.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    const firstFocusable = pushNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    pushNav.classList.remove("is-open");
    pushWrapper.classList.remove("is-pushed");

    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    pushNav.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";
  }

  function toggleMenu() {
    const isOpen = hamburger.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!pushNav.classList.contains("is-open")) return;

    const focusableElements = Array.from(pushNav.querySelectorAll(FOCUSABLE_SELECTOR));
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  hamburger.addEventListener("click", toggleMenu);

  if (pushClose) {
    pushClose.addEventListener("click", function () {
      closeMenu();
      hamburger.focus();
    });
  }

  pushCover.addEventListener("click", function () {
    if (!pushNav.classList.contains("is-open")) return;
    closeMenu();
    hamburger.focus();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && pushNav.classList.contains("is-open")) {
      closeMenu();
      hamburger.focus();
      return;
    }
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  function syncViewport() {
    if (mediaQuery.matches) {
      if (pushNav.classList.contains("is-open")) {
        closeMenu();
      }
      pushNav.removeAttribute("aria-hidden");
    } else if (!pushNav.classList.contains("is-open")) {
      pushNav.setAttribute("aria-hidden", "true");
    }
  }

  mediaQuery.addEventListener("change", syncViewport);

  syncViewport();
  pushNav.setAttribute("data-hamburger-push-ready", "");
})();
/* snippet:end */
