/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0f172a',
        accent: '#f97316',
        'lime-green': '#cddc39',
        'lime-light': '#d4e157',
        'lime-dark': '#bfd935',
      },
    },
  },
  plugins: [],
}
