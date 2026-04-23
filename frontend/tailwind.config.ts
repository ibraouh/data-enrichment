import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Plus Jakarta Sans — EliseAI's typography style
        jakarta: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // EliseAI brand purple scale
        elise: {
          50:  "#F3EEFF",
          100: "#E6DDFF",
          200: "#C9BAFF",
          300: "#A98EFF",
          400: "#9D6FFF",
          500: "#7847EA",  // brand primary
          600: "#6232D4",
          700: "#4C20B8",
          800: "#371496",
          900: "#220B6E",
          950: "#120540",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, hsl(261 82% 59%) 0%, hsl(220 90% 60%) 100%)",
        "gradient-brand-subtle": "linear-gradient(135deg, hsl(261 82% 59% / 0.15) 0%, hsl(220 90% 60% / 0.15) 100%)",
      },
      boxShadow: {
        "glow-sm": "0 0 12px hsl(261 82% 59% / 0.25)",
        "glow-md": "0 0 24px hsl(261 82% 59% / 0.30)",
        "glow-lg": "0 0 40px hsl(261 82% 59% / 0.35)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
