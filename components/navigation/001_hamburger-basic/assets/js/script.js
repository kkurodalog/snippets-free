/**
 * 001_hamburger-basic
 * ハンバーガーボタンでナビゲーションを開閉する、いちばん短い形。
 *
 * 設計
 * - HTML は「ナビのリンクがそのまま読める」状態で書き、ハンバーガーボタンは JS が組み立てる。
 *   JS が動かない環境ではリンクが全部読め、押しても何も起きないボタンも残らない。
 * - 仕掛け終えたヘッダーに data-hamburger-basic-ready を付ける。閉じた見せ方（絶対配置と display: none）は
 *   CSS 側でこの印の中だけに置いてある。
 * - 掲載範囲の先頭にあるインラインスクリプトは、開く前の状態が一瞬見えるのを防ぐためのもの。
 *
 * 動き
 * - ボタンに is-active、ナビに is-open を付け外しして状態を持つ
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - ナビの外をクリック、または Escape で閉じ、フォーカスをボタンへ戻す
 *
 * 画面幅と aria-hidden
 * - 768px 以上ではナビが常に見えているため aria-hidden を外す。
 *   ⚠️ matchMedia の change だけで外すと、最初から広い画面で開いたときに一度も外れない。
 *   起動時にも同じ関数を通し、いまの画面幅で判断する。
 *
 * スクロールロック
 * - ナビが画面全体を覆わないため掛けない
 */

/* snippet:start */
(function () {
  "use strict";

  const header = document.querySelector(".c-header");
  const nav = document.querySelector(".c-nav");

  if (!header || !nav) return;

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

    inner.insertBefore(button, nav);
    return button;
  }

  const hamburger = buildHamburger(nav.id);

  if (!hamburger) return;

  const mediaQuery = window.matchMedia("(min-width: 768px)");

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

  function syncViewport() {
    if (mediaQuery.matches) {
      if (nav.classList.contains("is-open")) {
        closeMenu();
      }
      nav.removeAttribute("aria-hidden");
    } else if (!nav.classList.contains("is-open")) {
      nav.setAttribute("aria-hidden", "true");
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

  mediaQuery.addEventListener("change", syncViewport);

  syncViewport();
  header.setAttribute("data-hamburger-basic-ready", "");
})();
/* snippet:end */
