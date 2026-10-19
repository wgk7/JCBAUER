import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        petrol: {
          50: "#f0f7f9",
          100: "#daecf1",
          200: "#b9dbe5",
          300: "#89c1d3",
          400: "#529eb9",
          500: "#36829e",
          600: "#2d6a85",
          700: "#28576d",
          800: "#26495b",
          900: "#233e4e",
          950: "#122733",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
