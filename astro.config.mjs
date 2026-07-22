import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { localContentPlugin } from "./src/providers/local-dev-plugin";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), localContentPlugin()],
    optimizeDeps: {
      include: ["@rjsf/core", "@rjsf/validator-ajv8", "react", "react-dom"],
    },
  },
});
