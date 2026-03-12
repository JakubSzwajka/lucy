/**
 * Rehype plugin that rewrites relative README.md links to directory URLs.
 *
 * In the IDE, `../extensions/memory/README.md` resolves to the file.
 * In the docs site, the URL structure mirrors the code structure under src/,
 * so we just need to strip the README.md filename — the relative path is
 * already correct.
 *
 * Examples (from a page at /docs/runtime/core/):
 *   ../extensions/memory/README.md  →  ../extensions/memory/
 *   src/pi-bridge/README.md         →  src/pi-bridge/
 *   ../../gateway/core/README.md    →  ../../gateway/core/
 */

import { visit } from "unist-util-visit";

export function rehypeReadmeLinks() {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName !== "a") return;
      const href: string | undefined = node.properties?.href;
      if (!href) return;
      // Skip absolute URLs
      if (href.startsWith("http://") || href.startsWith("https://")) return;

      // Strip README.md from relative links, turning them into directory URLs
      if (href.endsWith("/README.md")) {
        node.properties.href = href.replace(/README\.md$/, "");
      } else if (href.endsWith("README.md")) {
        node.properties.href = href.replace(/README\.md$/, "");
      }
    });
  };
}
