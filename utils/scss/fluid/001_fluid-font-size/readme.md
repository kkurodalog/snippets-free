# Fluid Font Size

画面幅に応じて自動でフォントサイズが可変になるスニペット。

## 使い方

1. `fluid-font-size.scss` をプロジェクトの `utilities` に配置
2. 以下のように `html` またはクラスに mixin を適用してください

```scss
html {
  @include fluid-font-size();
}
```
