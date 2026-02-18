export default {
  "desktop/renderer/**/*.{ts,tsx}": (files) =>
    `cd desktop && npx eslint ${files.map((f) => `"${f}"`).join(" ")}`,
  "backend/**/*.{ts,tsx}": (files) =>
    `cd backend && npx eslint ${files.map((f) => `"${f}"`).join(" ")}`,
};
