import { createRequire } from "node:module";
import autoprefixer from "autoprefixer";

const require = createRequire(import.meta.url);

const topLevelTailwindVersion = (() => {
  try {
    return require("tailwindcss/package.json").version;
  } catch {
    return null;
  }
})();

const tailwindcss = topLevelTailwindVersion?.startsWith("3.")
  ? require("tailwindcss")
  : require("./node_modules/lovable-tagger/node_modules/tailwindcss/lib/index.js");

export default {
  plugins: [tailwindcss(), autoprefixer()],
};
