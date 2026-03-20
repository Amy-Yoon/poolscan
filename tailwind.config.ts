import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#EEF1FE",
          100: "#D9DFFD",
          500: "#4F6EF7",
          600: "#3B5AE8",
          700: "#2D47C9",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.04)",
        dropdown: "0 8px 24px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04)",
      },
    },
  },
  plugins: [],
};

export default config;
