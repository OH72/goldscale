/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        'primary-foreground': '#ffffff',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        destructive: '#ef4444',
        'destructive-foreground': '#ffffff',
        border: '#e2e8f0',
        card: '#ffffff',
        'card-foreground': '#0f172a',
        background: '#f8fafc',
        foreground: '#0f172a',
        accent: '#f1f5f9',
        'accent-foreground': '#0f172a',
        secondary: '#f1f5f9',
        'secondary-foreground': '#0f172a',
      },
    },
  },
  plugins: [],
}
