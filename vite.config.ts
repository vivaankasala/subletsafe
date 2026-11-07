import { loadEnv } from "vite";
import { isPublicConfiguration } from "./src/lib/config";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (
    (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) &&
    !isPublicConfiguration(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
    )
  )
    throw Error(
      "Use a valid Supabase URL and publishable/anon key. Secret keys must never reach the frontend.",
    );
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router"],
            supabase: ["@supabase/supabase-js"],
          },
        },
      },
    },
    test: { include: ["tests/*.test.ts"], testTimeout: 30000 },
  };
});
