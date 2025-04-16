// just for Tailwind CSS IntelliSense plugin working
const cfg = require('./template/img/DefaultTailwindConfig')

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    theme: cfg.theme,
}
