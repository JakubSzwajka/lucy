export default {
  "**/*.{ts,tsx}": (files) =>
    `npx eslint ${files.map((f) => `"${f}"`).join(" ")}`,
};
