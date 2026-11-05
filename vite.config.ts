import { defineConfig } from "vite";
export default defineConfig({
  server: { proxy: { "/api/transcriptions": "http://127.0.0.1:8000" } },
});
