import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { rehypeReadmeLinks } from "./src/rehype-readme-links.ts";

const site = process.env.SITE_URL ?? "https://example.com";
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  site,
  base,
  output: "static",
  integrations: [mdx()],
  markdown: {
    rehypePlugins: [rehypeReadmeLinks],
  },
});
