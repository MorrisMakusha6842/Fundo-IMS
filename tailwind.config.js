const { transform } = require('typescript')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    screens: {
    },
    extend: {
      backgroundImage: {
        
      },
      animation: {
        
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],

}

