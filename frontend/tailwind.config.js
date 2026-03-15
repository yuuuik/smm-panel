/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#08090e',
          card: '#0d1117',
          border: '#1c2333',
          accent: '#06b6d4',
          muted: '#4b5563',
          cyan: '#00d4ff',
          purple: '#a855f7',
          pink: '#ec4899',
        },
      },
    },
  },
  plugins: [],
}
