import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // These files render R2/CDN artwork and reader pages whose dimensions come
    // from CSS, or images embedded in user-authored markdown. next/image needs
    // intrinsic dimensions and an allow-listed remote loader, which this
    // deployment does not have, so plain <img> is the intended element.
    files: [
      "app/account/creator-content.tsx",
      "app/account/komik/\\[comicId\\]/editor.tsx",
      "app/admin/articles-panel.tsx",
      "app/comic/\\[slug\\]/chapter/\\[chapterId\\]/reader-client.tsx",
      "app/comic/\\[slug\\]/comic-detail-client.tsx",
      "app/homepage-client.tsx",
      "components/markdown-content.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
