/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Merriweather"', '"Lora"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      colors: {
        zen: {
          bg: '#FBFBFA',
          darkBg: '#121214',
          surface: '#F4F4F2',
          darkSurface: '#1A1A1E',
          text: '#222222',
          darkText: '#ECECED',
          subtle: '#787882',
          darkSubtle: '#9A9AA2',
          accent: '#4338CA',
          accentLight: '#6366F1',
        }
      }
    },
  },
  plugins: [],
}
