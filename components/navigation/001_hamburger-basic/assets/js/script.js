/**
 * 001_hamburger-basic
 * ハンバーガーボタンでナビゲーションを開閉する、いちばん短い形。
 *
 * 動き
 * - ボタンに is-active、ナビに is-open を付け外しして状態を持つ
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - ナビの外をクリック、または Escape で閉じ、フォーカスをボタンへ戻す
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 状態の持ち方
 * - 開閉の真偽はボタンの is-active を見て決める。属性とクラスを別々に判定しない
 *
 * スクロールロック
 * - ナビが画面全体を覆わないため掛けない
 */

/* snippet:start */
(function () {
  "use strict";

  const hamburger = document.querySelector(".c-hamburger");
  const nav = document.querySelector(".c-nav");

  if (!hamburger || !nav) return;

  function openMenu() {
    hamburger.classList.add("is-active");
    nav.classList.add("is-open");
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    nav.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    nav.classList.remove("is-open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    nav.setAttribute("aria-hidden", "true");
  }

  function toggleMenu() {
    const isOpen = hamburger.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  hamburger.addEventListener("click", toggleMenu);

  document.addEventListener("click", function (e) {
    const isOpen = nav.classList.contains("is-open");
    if (!isOpen) return;

    const isOutside = !hamburger.contains(e.target) && !nav.contains(e.target);
    if (isOutside) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      closeMenu();
      hamburger.focus();
    }
  });

  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      if (nav.classList.contains("is-open")) {
        closeMenu();
      }
      nav.removeAttribute("aria-hidden");
    } else {
      nav.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
