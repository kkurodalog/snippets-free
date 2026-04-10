/**
 * 001_hamburger-basic
 * シンプルなハンバーガーメニュー
 *
 * 機能:
 * - ハンバーガーボタンクリックでナビゲーションをトグル表示
 * - ボタンに is-active、ナビに is-open クラスを付与/除去
 * - aria-expanded 属性を連動更新（アクセシビリティ対応）
 * - ナビ外クリックで閉じる
 * - Escape キーで閉じる
 */

(function () {
  "use strict";

  // 要素取得
  const hamburger = document.querySelector(".c-hamburger");
  const nav = document.querySelector(".c-nav");

  // 要素が存在しない場合は処理しない
  if (!hamburger || !nav) return;

  /**
   * メニューを開く
   */
  function openMenu() {
    hamburger.classList.add("is-active");
    nav.classList.add("is-open");
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    nav.setAttribute("aria-hidden", "false");
  }

  /**
   * メニューを閉じる
   */
  function closeMenu() {
    hamburger.classList.remove("is-active");
    nav.classList.remove("is-open");
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    nav.setAttribute("aria-hidden", "true");
  }

  /**
   * メニューのトグル
   */
  function toggleMenu() {
    const isOpen = hamburger.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // ハンバーガーボタンのクリックイベント
  hamburger.addEventListener("click", toggleMenu);

  // ナビ外クリックで閉じる
  document.addEventListener("click", function (e) {
    const isOpen = nav.classList.contains("is-open");
    if (!isOpen) return;

    // クリック対象がハンバーガーまたはナビの内側でなければ閉じる
    const isOutside = !hamburger.contains(e.target) && !nav.contains(e.target);
    if (isOutside) {
      closeMenu();
    }
  });

  // Escape キーで閉じる
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      closeMenu();
      // フォーカスをハンバーガーボタンに戻す
      hamburger.focus();
    }
  });

  // 画面幅が768px以上になったらナビを閉じる（縦横回転・リサイズ対応）
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      // PCサイズ: ナビは常に表示されるため aria-hidden を除去
      if (nav.classList.contains("is-open")) {
        closeMenu();
      }
      nav.removeAttribute("aria-hidden");
    } else {
      // SPサイズに戻ったとき: ナビは非表示状態なので aria-hidden を付与
      nav.setAttribute("aria-hidden", "true");
    }
  });
})();
