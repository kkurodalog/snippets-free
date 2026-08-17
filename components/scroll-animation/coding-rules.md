# scroll-animation カテゴリ固有の実装規範

全カテゴリ共通の規範は、リポジトリ直下の `CODING-RULES.md` にある。
**本書はそこに書ききれない、このカテゴリ特有の地雷だけ**を残す。

---

## 1. 方向指定と詳細度（001 fade-in / 002 stagger）

- **方向の子孫セレクタを使う場合、最終状態 `.is-visible` の詳細度を方向ルールと同点以上に保つ。**
  方向値を親・子の両対応にするため `.js [dir] [data-fade-in]`（詳細度 0,3,0）へ拡張したら、最終状態も要素フックを残して
  `.js [data-fade-in].is-visible`（0,3,0）にし、ソース順で方向ルールより後ろに置く。
  `.js .is-visible`（0,2,0）に下げると方向ルールが `transform` と `will-change` を上書きし、
  出現後も最終位置に戻らず `will-change` も解除されない。
- **要素自身に方向を付けるセレクタは、出現対象でガードする**（`.js [data-fade-in][dir]`）。
  素の `.js [dir]` のままだと、方向を親コンテナに付けたとき**親自身にもマッチして transform が当たる**。
  親には `.is-visible` が付かない（付与対象は子の `data-fade-in` のみ）ため、
  translate が戻らずコンテナごと約 24px ずれたまま固定される。

## 2. フック属性

- **親フックと子フックを分ける。** グループ監視は親 `data-{機能}`（例 `data-stagger`）、出現対象は子 `data-fade-in` を再利用する
- **方向値の親・子両対応は2段セレクタ。** `.js [data-fade-in][dir]`（自身が出現対象のとき）と
  `.js [dir] [data-fade-in]`（親に付けたとき子へ）を併記する

## 3. フォールバック

- **IntersectionObserver 非対応時は遅延を付けず一括表示する**（stagger の文脈）。順次遅延を無理に再現しない

## 4. scroll-driven CSS（`animation-timeline`）系（003 以降）

- **二重駆動の防止は `@supports` / `@supports not` の対称分岐 ＋ JavaScript 側の
  `CSS.supports('animation-timeline', 'scroll()')` 判定（真なら早期 return）で行う。**
  CSS で動く環境では JavaScript がリスナーを張らないことで、両方が同時にバーを動かす状態を構造的に排除する。
  **判定キーを CSS と JavaScript で完全に一致させる。**
- **情報を提示する UI（進捗バー等）の `reduced-motion` は「即時最終状態」を踏襲しない。**
  出現演出（001 / 002）は `reduce` 時に最終状態固定でよいが、
  読了率バーを満タン固定や非表示にすると誤った情報になる。
  スクロール操作に直結する追従は維持し、補間の transition だけを切る。

## 5. 実測で初めて出た不具合（このカテゴリでの実例）

| パーツ | 症状 | 原因 | 対処 |
|---|---|---|---|
| 004 parallax | 進捗が固定されたまま動かない | `.c-parallax` の `overflow: hidden` が `view()` の最近接スクロールポートを自身にしていた | `overflow: clip` |
| 006 blur | 範囲を超えた後に `backdrop-filter` が `blur(0)` へ戻る | `animation-fill-mode` 未指定（ショートハンドで `none`） | `animation-fill-mode: forwards` |
