import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bebas Neue — headlines, nav labels, buttons, card titles
        display: ['var(--font-display)', 'Bebas Neue', 'Impact', 'sans-serif'],
        // Inter — body text, meta, small labels
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        'display': '0.01em',
      },
      colors: {
        sport: {
          DEFAULT: '#FF0000',      // Sportradar Red - primary
          dark: '#CC0000',         // Darker red
          light: '#FF3333',        // Light red
          accent: '#FF0000',       // Red accent
          neon: '#FF0000',         // Red for highlights
          gold: '#F59E0B',         // Gold/Amber for coins/points
          purple: '#FF0000',       // Red (unified)
          bg: '#000000',           // Black background
          card: '#000050',         // Dark blue card background
          'card-light': '#000064', // Lighter blue card
        },
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'bounce-out': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.2)', opacity: '1' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'coin-from-header': {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(300px) scale(0.5)', opacity: '0' },
        },
        popIn: {
          '0%': { transform: 'scale(0.3) translateX(20px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateX(0)', opacity: '1' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.3s ease-out',
        slideDown: 'slideDown 0.3s ease-out',
        pulse: 'pulse 2s infinite',
        bounce: 'bounce 1s infinite',
        'bounce-out': 'bounce-out 0.5s ease-out forwards',
        'coin-from-header': 'coin-from-header 0.8s ease-in forwards',
        popIn: 'popIn 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
export default config;
