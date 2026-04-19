import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  site: "https://Ghoul-SSZ.github.io",
  base: "/cloud-historic-uptime/",
  output: "static",
});
