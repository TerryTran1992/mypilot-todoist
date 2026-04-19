/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './quick-add.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#22C55E',
      },
    },
  },
  plugins: [],
};
