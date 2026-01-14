/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Satoshi', 'sans-serif'],
            },
            colors: {
                slate: {
                    700: '#374151',
                    800: '#1f2937',
                    900: '#111827',
                }
            }
        },
    },
    plugins: [],
}
