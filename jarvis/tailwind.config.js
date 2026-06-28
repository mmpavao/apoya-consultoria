/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#0f1117',
        surface: '#171a23',
        edge: '#262b38',
        accent: '#5b9dff',
      },
    },
  },
  plugins: [],
};
