/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed'
        },
        accent: {
          DEFAULT: '#22d3ee'
        }
      }
    }
  },
  plugins: []
};
