import type { Config } from 'tailwindcss';

// Paleta e tipografia extraídas da arte de referência:
// fundo verde-floresta ondulado, creme quente, vinho/marrom nos títulos.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 950: '#10301f', 900: '#143a2c', 800: '#1a4a38', 700: '#1f5a43', 600: '#2a6e53', 500: '#378565' },
        cream: { 50: '#fdf8ec', 100: '#f8ebd0', 200: '#f0dcb4', 300: '#e4c88f' },
        wine: { 600: '#85200f', 700: '#6c170b', 800: '#571007', 900: '#3f0c05' },
        ember: '#d9522b',
      },
      fontFamily: {
        display: ['"Archivo Variable"', 'Archivo', 'Impact', 'sans-serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 10px 30px -12px rgba(0,0,0,.45)' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(24px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        flash: { '0%,100%': { boxShadow: '0 0 0 0 rgba(217,82,43,.0)' }, '50%': { boxShadow: '0 0 0 6px rgba(217,82,43,.55)' } },
      },
      animation: { pop: 'pop .22s ease-out', slideUp: 'slideUp .28s ease-out', flash: 'flash 1.2s ease-in-out infinite' },
    },
  },
  plugins: [],
};
export default config;
