/**
 * 004_hamburger-overlay
 * 右から出るドロワーと、背面を暗くするオーバーレイの組み合わせ。
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

  const hamburger = document.querySelector(".c-hamburger");
  const drawer = document.querySelector(".c-drawer");
  const drawerClose = document.querySelector(".c-drawer__close");
  const overlay = document.querySelector(".c-overlay");

  if (!hamburger || !drawer || !overlay) return;

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

  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      if (drawer.classList.contains("is-open")) {
        closeMenu();
      }
      drawer.removeAttribute("aria-hidden");
    } else {
      drawer.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
