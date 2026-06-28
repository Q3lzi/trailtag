import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          950: '#061907',
          900: '#0d2410',
          800: '#16341c',
          700: '#2c694e',
          600: '#357a5c',
          500: '#4a8f6f',
          100: '#f0faf4',
        },
        snow: '#f7f6f2',
        stone: '#6b7280',
        alarm: {
          DEFAULT: '#ba1a1a',
          50: '#fdf2f2',
          100: '#fde4e4',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(6,25,7,0.04), 0 1px 1px 0 rgba(6,25,7,0.03)',
        'card-hover': '0 4px 16px -2px rgba(6,25,7,0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;