/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './quick-add.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#22C55E',
        surface: {
          DEFAULT: '#020617',
          raised: '#0F172A',
          overlay: '#1E293B',
        },
      },
      fontFamily: {
        heading: ['Caveat', 'cursive'],
        body: ['Quicksand', 'sans-serif'],
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
};
