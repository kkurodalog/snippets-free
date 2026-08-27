/**
 * 004_hamburger-overlay
 * 右から出るドロワーと、背面を暗くするオーバーレイの組み合わせ。
 *
 * 設計
 * - HTML は「ナビのリンクがそのまま読める」状態で書き、ハンバーガーボタンは JS が組み立てる。
 *   JS が動かない環境ではリンクが全部読め、押しても何も起きないボタンも残らない。
 * - 仕掛け終えたナビに data-hamburger-overlay-ready を付ける。閉じた見せ方（画面外への移動と
 *   visibility: hidden）は CSS 側でこの印の中だけに置いてある。
 * - 掲載範囲の先頭にあるインラインスクリプトは、開く前の状態が一瞬見えるのを防ぐためのもの。
 *
 * 画面幅と aria-hidden
 * - 768px 以上ではナビが常に見えているため aria-hidden を外す。
 *   起動時にも同じ関数を通し、いまの画面幅で判断する
 *   （matchMedia の change だけに任せると、最初から広い画面で開いたときに一度も外れない）。
 *
 * 動き
 * - ボタンに is-active、ドロワーに is-open、オーバーレイに is-visible を付け外しする
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - オーバーレイのクリック、ドロワー内の閉じるボタン、Escape のいずれでも閉じる
 * - 閉じたらフォーカスをハンバーガーボタンへ戻す
 * - フォーカストラップの範囲はドロワーの中
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * オーバーレイの読み上げ
 * - オーバーレイの aria-hidden は HTML 側で固定する。装飾であり、状態を持たない
 *
 * 数値の対応
 * - 開いた直後にフォーカスを移すまでの 300ms は、CSS の --drawer-transition
 *   （0.3s）と同じ値である。CSS 側を変えたらこの値も変える
 *
 * スクロールロック
 * - 開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const header = document.querySelector(".c-header");
  const drawer = document.querySelector(".c-drawer");
  const overlay = document.querySelector(".c-overlay");

  if (!header || !drawer || !overlay) return;

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

  function buildDrawerClose() {
    const existing = drawer.querySelector(".c-drawer__close");
    if (existing) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "c-drawer__close";
    button.setAttribute("aria-label", "メニューを閉じる");

    const icon = document.createElement("span");
    icon.className = "c-drawer__close-icon";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);

    drawer.insertBefore(button, drawer.firstChild);
    return button;
  }

  const hamburger = buildHamburger(drawer.id);

  if (!hamburger) return;

  const drawerClose = buildDrawerClose();
  const mediaQuery = window.matchMedia("(min-width: 768px)");

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openMenu() {
    hamburger.classList.add("is-active");
    drawer.classList.add("is-open");
    overlay.classList.add("is-visible");

    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    drawer.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    const firstFocusable = drawer.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-visible");

    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    drawer.setAttribute("aria-hidden", "true");

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
    if (!drawer.classList.contains("is-open")) return;

    const focusableElements = Array.from(drawer.querySelectorAll(FOCUSABLE_SELECTOR));
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

  if (drawerClose) {
    drawerClose.addEventListener("click", function () {
      closeMenu();
      hamburger.focus();
    });
  }

  overlay.addEventListener("click", function () {
    closeMenu();
    hamburger.focus();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer.classList.contains("is-open")) {
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
      if (drawer.classList.contains("is-open")) {
        closeMenu();
      }
      drawer.removeAttribute("aria-hidden");
    } else if (!drawer.classList.contains("is-open")) {
      drawer.setAttribute("aria-hidden", "true");
    }
  }

  mediaQuery.addEventListener("change", syncViewport);

  syncViewport();
  drawer.setAttribute("data-hamburger-overlay-ready", "");
})();
/* snippet:end */
