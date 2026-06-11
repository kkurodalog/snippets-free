/**
 * カウントアップ（スクロール発火の数値アニメーション）
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
 *   着地させる。data-count-easing="linear" で等速にも切り替えられる。
 * - rAF は目標到達（経過時間が所要時間に達した瞬間）でループを止める。
 *   最終フレームでは進捗を強制的に 1 にして、丸め誤差なく目標値ぴったりへ
 *   着地させてから停止する（rAF リークを残さない）。
 *
 * プログレッシブエンハンスメント / フォールバック:
 * - HTML の各数値には「整形済みの最終値」をテキストで書いてある。
 *   JS が動く環境ではカウント開始前に一旦 0 へ初期化してから補間する。
 * - JS 無効・IntersectionObserver 非対応・目標値が異常などの場合は、
 *   初期化や監視を行わず HTML の最終値をそのまま残す（情報が欠落しない）。
 *
 * アクセシビリティ:
 * - prefers-reduced-motion: reduce のときはカウントアニメーションを行わず、
 *   即時に最終値を表示する（出現演出系の「即時最終状態」と同じ性質）。
 */

(function () {
  "use strict";

  const targets = document.querySelectorAll("[data-count-up]");
  if (targets.length === 0) return;

  // 既定値。data 属性が省略・異常なときに使う。
  const DEFAULT_DURATION = 2000; // ms

  // 桁区切り＋小数桁を整形するためのフォーマッタをロケール固定で生成する。
  // 小数桁ごとにフォーマッタが変わるのでキャッシュして使い回す。
  const formatterCache = {};

  /**
   * 指定小数桁の NumberFormat を返す（ロケール固定 + 桁区切りあり）。
   * @param {number} decimals - 小数桁数（0 以上の整数）
   * @returns {Intl.NumberFormat}
   */
  function getFormatter(decimals) {
    if (!formatterCache[decimals]) {
      formatterCache[decimals] = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
    return formatterCache[decimals];
  }

  /**
   * easeOutQuad: 最初は速く、最後はゆっくり減速して止まる。
   * @param {number} t - 進捗 0〜1
   * @returns {number} イージング適用後の進捗 0〜1
   */
  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  /**
   * 1 要素のカウント設定を data 属性から読み取り、検証して返す。
   * 目標値が異常（NaN・負値・属性なし）なら null を返し、呼び出し側で
   * HTML の最終値を温存する。
   * @param {HTMLElement} el
   * @returns {{to:number, duration:number, suffix:string, decimals:number, linear:boolean}|null}
   */
  function readConfig(el) {
    const to = Number(el.dataset.countTo);
    // 目標値の検証: 有限かつ 0 以上のみ受け付ける（既定の検証基準）。
    if (!(Number.isFinite(to) && to >= 0)) return null;

    // 所要時間: 有限かつ 0 以上なら採用、それ以外は既定値へフォールバック。
    const rawDuration = Number(el.dataset.countDuration);
    const duration =
      Number.isFinite(rawDuration) && rawDuration >= 0
        ? rawDuration
        : DEFAULT_DURATION;

    // 小数桁: 有限かつ 0 以上の整数なら採用、それ以外は 0。
    const rawDecimals = Number(el.dataset.countDecimals);
    const decimals =
      Number.isFinite(rawDecimals) && rawDecimals >= 0
        ? Math.floor(rawDecimals)
        : 0;

    const suffix = el.dataset.countSuffix || "";
    const linear = el.dataset.countEasing === "linear";

    return { to: to, duration: duration, suffix: suffix, decimals: decimals, linear: linear };
  }

  /**
   * 数値を整形して接尾辞を付け、要素へ書き込む。
   * @param {HTMLElement} el
   * @param {number} value
   * @param {{suffix:string, decimals:number}} cfg
   */
  function render(el, value, cfg) {
    el.textContent = getFormatter(cfg.decimals).format(value) + cfg.suffix;
  }

  /**
   * 0 → 目標値のカウントアニメーションを実行する。
   * 所要時間が 0 のときは rAF を回さず即座に最終値を表示する。
   * @param {HTMLElement} el
   * @param {object} cfg - readConfig の戻り値
   */
  function animate(el, cfg) {
    // 所要時間 0（または極端に短い指定）の場合は補間せず最終値を表示。
    if (cfg.duration <= 0) {
      render(el, cfg.to, cfg);
      return;
    }

    const startTime = performance.now();

    function step(now) {
      // 経過割合 0〜1。1 を超えないようクランプし、最終フレームを確定させる。
      const elapsed = now - startTime;
      let progress = elapsed / cfg.duration;
      if (progress >= 1) progress = 1;

      const eased = cfg.linear ? progress : easeOutQuad(progress);
      const current = cfg.to * eased;

      render(el, current, cfg);

      // progress が 1 に達したら、最終値（cfg.to）をそのまま描いた状態で
      // ループを止める。これ以上 rAF を予約しないことでリークを残さない。
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  // OS の「視差効果を減らす」設定。reduce のときはカウントせず即最終値。
  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * カウント開始のトリガ。reduced-motion 時は補間せず最終値を即表示する。
   * @param {HTMLElement} el
   * @param {object} cfg
   */
  function start(el, cfg) {
    if (prefersReducedMotion) {
      render(el, cfg.to, cfg);
      return;
    }
    animate(el, cfg);
  }

  // 各要素の設定を事前に検証し、有効なものだけ初期化・監視する。
  // 異常値（目標値が NaN・負値・属性なし）の要素は HTML の最終値を温存する。
  const items = [];
  targets.forEach(function (el) {
    const cfg = readConfig(el);
    if (!cfg) return; // フォールバック: 最終値のテキストをそのまま残す
    items.push({ el: el, cfg: cfg });
  });

  if (items.length === 0) return;

  // JS が動く環境では、カウント開始前に一旦 0（整形済み）へ初期化する。
  // ここで初めて表示が 0 になるため、JS 無効時は最終値が残る（PE）。
  items.forEach(function (item) {
    render(item.el, 0, item.cfg);
  });

  // IntersectionObserver 非対応環境のフォールバック:
  // 監視せず、全要素を即時にカウント（reduce 時は最終値）開始する。
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (item) {
      start(item.el, item.cfg);
    });
    return;
  }

  // 要素から設定を引けるよう WeakMap で対応付ける。
  const configMap = new WeakMap();
  items.forEach(function (item) {
    configMap.set(item.el, item.cfg);
  });

  /**
   * 観測オプション（出現演出系と同じ妥当値）
   * - threshold: 0.15  要素の 15% が入った時点で発火。
   * - rootMargin: "0px 0px -10% 0px"  下端を 10% 内側に詰めて、
   *     やや上に入ってから発火させ自然なタイミングにする。
   */
  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        const cfg = configMap.get(entry.target);
        if (cfg) start(entry.target, cfg);

        // ワンショット発火: 一度発火したら監視を解除して多重発火を防ぐ。
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
