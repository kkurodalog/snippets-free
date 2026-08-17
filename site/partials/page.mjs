import { head } from './head.mjs';
import { header } from './header.mjs';
import { footer } from './footer.mjs';

/**
 * ページ全体の器。すべての生成ページがこの関数を通る。
 * テンプレート記法は定義しない。雛形は文字列を返す関数だけで組む。
 */
export function page({ site, root, pagePath, title, description, currentCategory = null, main }) {
  return `<!DOCTYPE html>
<html lang="${site.lang}" class="no-js">
<head>
${head({ site, title, description, root, pagePath })}
</head>
<body>
${header({ site, root, currentCategory })}
${main}
${footer({ site, root })}
</body>
</html>
`;
}
