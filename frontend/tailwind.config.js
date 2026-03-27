/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fptOrange: '#F27024',
        fptOrangeDark: '#D25A15',
      },
    },
  },
  plugins: [],
}
