/**
 * 005_count-up
 * カウントアップ（スクロール発火の数値アニメーション）。
 * Intersection Observer でビューポート進入を検知し、requestAnimationFrame で
 * 0 から目標値まで数値を補間して表示する。
 *
 * 設計方針:
 * - 監視対象は data-count-up 属性を持つ要素。HTML 側で属性を付けるだけで
 *   対象を増やせる。フック名は出現演出系（data-fade-in 等）と衝突しない
 *   独立命名にしてある。
 * - ワンショット発火: 一度交差した要素は unobserve して監視を解除する。
 *   これにより上下スクロールでの再カウントと多重発火を防ぐ。
 * - イージングは easeOutQuad を既定とし、最初は速く最後はゆっくり目標値へ
 *   着地させる。
 * - rAF は目標到達（経過時間が所要時間に達した瞬間）でループを止める。
 *   最終フレームでは進捗を強制的に 1 にして、丸め誤差なく目標値ぴったりへ
 *   着地させてから停止する（rAF リークを残さない）。
 * - 桁区切りは Intl.NumberFormat をロケール固定（en-US）で使う。
 *   小数桁ごとにフォーマッタが変わるため、桁数をキーにキャッシュする。
 *
 * 属性:
 * - data-count-up       監視対象であることを示すフック属性。
 * - data-count-to       目標値（必須）。0 以上の有限数を指定する。
 * - data-count-duration カウント時間（ms）。省略・不正なら既定 2000ms。
 * - data-count-suffix   接尾辞（+ / % / 人 / 件 など）。省略可。
 * - data-count-decimals 小数桁数。省略・不正なら 0。
 * - data-count-easing   "linear" で等速に切り替え可。省略時は easeOutQuad。
 *
 * 観測オプション:
 * - threshold 0.15 は、要素の 15% が画面に入った時点で発火する値である。
 * - rootMargin "0px 0px -10% 0px" は画面下端を 10% 内側に詰めて判定する。
 *
 * プログレッシブエンハンスメント / フォールバック:
 * - HTML の各数値には「整形済みの最終値」をテキストで書いておく。
 *   JavaScript が動く環境ではカウント開始前に一旦 0 へ初期化してから補間する。
 * - JavaScript 無効・IntersectionObserver 非対応・目標値が異常などの場合は、
 *   初期化や監視を行わず HTML の最終値をそのまま残す（情報が欠落しない）。
 * - 所要時間 0（または極端に短い指定）のときは rAF を回さず最終値を表示する。
 *
 * アクセシビリティ:
 * - prefers-reduced-motion: reduce のときはカウントアニメーションを行わず、
 *   即時に最終値を表示する（出現演出系の「即時最終状態」と同じ性質）。
 */

/* snippet:start */
(function () {
  "use strict";

  const targets = document.querySelectorAll("[data-count-up]");
  if (targets.length === 0) return;

  const DEFAULT_DURATION = 2000;

  const formatterCache = {};

  function getFormatter(decimals) {
    if (!formatterCache[decimals]) {
      formatterCache[decimals] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return formatterCache[decimals];
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function readConfig(el) {
    const to = Number(el.dataset.countTo);
    if (!(Number.isFinite(to) && to >= 0)) return null;

    const rawDuration = Number(el.dataset.countDuration);
    const duration =
      Number.isFinite(rawDuration) && rawDuration >= 0
        ? rawDuration
        : DEFAULT_DURATION;

    const rawDecimals = Number(el.dataset.countDecimals);
    const decimals =
      Number.isFinite(rawDecimals) && rawDecimals >= 0
        ? Math.floor(rawDecimals)
        : 0;

    const suffix = el.dataset.countSuffix || "";
    const linear = el.dataset.countEasing === "linear";

    return { to: to, duration: duration, suffix: suffix, decimals: decimals, linear: linear };
  }

  function render(el, value, cfg) {
    el.textContent = getFormatter(cfg.decimals).format(value) + cfg.suffix;
  }

  function animate(el, cfg) {
    if (cfg.duration <= 0) {
      render(el, cfg.to, cfg);
      return;
    }

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      let progress = elapsed / cfg.duration;
      if (progress >= 1) progress = 1;

      const eased = cfg.linear ? progress : easeOutQuad(progress);
      const current = cfg.to * eased;

      render(el, current, cfg);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function start(el, cfg) {
    if (prefersReducedMotion) {
      render(el, cfg.to, cfg);
      return;
    }
    animate(el, cfg);
  }

  const items = [];
  targets.forEach(function (el) {
    const cfg = readConfig(el);
    if (!cfg) return;
    items.push({ el: el, cfg: cfg });
  });

  if (items.length === 0) return;

  items.forEach(function (item) {
    render(item.el, 0, item.cfg);
  });

  if (!("IntersectionObserver" in window)) {
    items.forEach(function (item) {
      start(item.el, item.cfg);
    });
    return;
  }

  const configMap = new WeakMap();
  items.forEach(function (item) {
    configMap.set(item.el, item.cfg);
  });

  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        const cfg = configMap.get(entry.target);
        if (cfg) start(entry.target, cfg);

        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  items.forEach(function (item) {
    observer.observe(item.el);
  });
})();
/* snippet:end */
