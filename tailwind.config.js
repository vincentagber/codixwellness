/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./test.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        primary: "#57B952",
        "primary-dark": "#45B853",
        "primary-light": "#d7f4d8",
        navy: "#211C68",
        "navy-light": "#514aa4",
        purple: "#4235AE",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        soft: "0 24px 80px rgba(45, 83, 109, 0.12)",
        card: "0 16px 30px rgba(31, 41, 55, 0.08)",
      },
    },
  },
  plugins: [],
};
