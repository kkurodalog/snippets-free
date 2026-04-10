/**
 * 004_hamburger-slidedown
 * スライドダウン型ハンバーガーメニュー
 *
 * 機能:
 * - ハンバーガーボタンクリックでナビゲーションが上からスライドダウンして表示
 * - ボタンに is-active、スライドダウンナビに is-open クラスを付与/除去
 * - aria-expanded / aria-hidden 属性を連動更新（アクセシビリティ対応）
 * - ナビ外クリックで閉じる
 * - Escape キーで閉じる（フォーカスをハンバーガーボタンに戻す）
 * - フォーカストラップ（ハンバーガーボタン＋スライドダウンナビ内にフォーカスを閉じ込める）
 * - matchMedia でリサイズ時に状態をリセット
 *
 * スクロールロック:
 * スライドダウン型はヘッダー背面から降りてくるだけで画面全体を覆わないため、
 * スクロールロックは不要（ユーザーがメニュー背後のコンテンツをスクロールできる方が自然）
 */

(function () {
  "use strict";

  // 要素取得
  const hamburger = document.querySelector(".c-hamburger");
  const slidedownNav = document.querySelector(".c-slidedown-nav");

  // 要素が存在しない場合は処理しない
  if (!hamburger || !slidedownNav) return;

  // フォーカス可能な要素のセレクター
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * メニューを開く
   */
  function openMenu() {
    hamburger.classList.add("is-active");
    slidedownNav.classList.add("is-open");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    slidedownNav.setAttribute("aria-hidden", "false");

    // スライドダウンナビ内の最初のフォーカス可能要素にフォーカス移動
    const firstFocusable = slidedownNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      // トランジション完了後にフォーカス移動
      // 300ms = CSS カスタムプロパティ --slidedown-transition（0.3s）に合わせること
      // CSS 側の値を変更した場合はここも合わせて変更する
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  /**
   * メニューを閉じる
   */
  function closeMenu() {
    hamburger.classList.remove("is-active");
    slidedownNav.classList.remove("is-open");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    slidedownNav.setAttribute("aria-hidden", "true");
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

  /**
   * フォーカストラップ
   * ハンバーガーボタン＋スライドダウンナビ内のフォーカス可能要素の間でフォーカスをループさせる
   * @param {KeyboardEvent} e
   */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!slidedownNav.classList.contains("is-open")) return;

    // ハンバーガーボタン + スライドダウンナビ内のフォーカス可能要素を結合
    const navFocusable = Array.from(slidedownNav.querySelectorAll(FOCUSABLE_SELECTOR));
    const focusableElements = [hamburger, ...navFocusable];
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: 最初の要素でさらに後退しようとしたら最後の要素に移動
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: 最後の要素でさらに前進しようとしたら最初の要素に移動
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  // ハンバーガーボタンのクリックイベント
  hamburger.addEventListener("click", toggleMenu);

  // ナビ外クリックで閉じる
  document.addEventListener("click", function (e) {
    const isOpen = slidedownNav.classList.contains("is-open");
    if (!isOpen) return;

    // クリック対象がハンバーガーまたはスライドダウンナビの内側でなければ閉じる
    const isOutside =
      !hamburger.contains(e.target) && !slidedownNav.contains(e.target);
    if (isOutside) {
      closeMenu();
    }
  });

  // キーボード操作（Escape / Tab）を1つのリスナーで統合管理
  document.addEventListener("keydown", function (e) {
    // Escape: メニューを閉じてフォーカスを戻す
    if (e.key === "Escape" && slidedownNav.classList.contains("is-open")) {
      closeMenu();
      hamburger.focus();
      return;
    }
    // Tab: フォーカストラップ
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  // 画面幅が768px以上になったらナビを閉じる（縦横回転・リサイズ対応）
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      // PCサイズ: ナビは常に表示されるため aria-hidden を除去
      if (slidedownNav.classList.contains("is-open")) {
        closeMenu();
      }
      slidedownNav.removeAttribute("aria-hidden");
    } else {
      // SPサイズに戻ったとき: ナビは非表示状態なので aria-hidden を付与
      slidedownNav.setAttribute("aria-hidden", "true");
    }
  });
})();
