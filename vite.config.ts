import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Read the Helius key server-side (Node) so it is never bundled into the
  // client or exposed in browser-visible request URLs / CDN logs. The dev
  // proxy below injects it as a query param on the way out to Helius.
  const heliusKey =
    process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY || "";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // Inject the Helius API key server-side. The browser calls a relative
      // "/helius/..." path; this proxy rewrites to the upstream host and
      // appends the key, keeping it out of the client and access logs. In
      // production, route this same path through a serverless/edge function.
      proxy: {
        "/helius": {
          target: "https://api-mainnet.helius-rpc.com",
          changeOrigin: true,
          secure: true,
          rewrite: (p: string) => {
            const stripped = p.replace(/^\/helius/, "");
            if (!heliusKey) return stripped;
            const sep = stripped.includes("?") ? "&" : "?";
            return `${stripped}${sep}api-key=${heliusKey}`;
          },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
