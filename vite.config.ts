import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@supabase/")) return "supabase-client";
          if (
            id.includes("/node_modules/react/")
            || id.includes("/node_modules/react-dom/")
            || id.includes("/node_modules/react-router/")
            || id.includes("/node_modules/react-router-dom/")
          ) return "react-runtime";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
