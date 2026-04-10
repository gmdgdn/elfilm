/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                'arabic': ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
                'sans': ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                'elfilm': {
                    'dark': '#050609',
                    'darker': '#101010',
                    'accent': '#D4AF37', // Gold
                    'accent-bright': '#FFD700',
                    'blue': '#00B4D8',
                    'gray': {
                        50: '#F8F9FA',
                        100: '#E9ECEF',
                        200: '#DEE2E6',
                        300: '#CED4DA',
                        400: '#ADB5BD',
                        500: '#6C757D',
                        600: '#495057',
                        700: '#343A40',
                        800: '#212529',
                        900: '#0A0A0A',
                    }
                }
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
