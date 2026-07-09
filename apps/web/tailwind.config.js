/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        aegis: {
          50: '#eef7ff',
          100: '#d9ecff',
          200: '#bce0ff',
          300: '#8eccff',
          400: '#59afff',
          500: '#338dff',
          600: '#1a6df5',
          700: '#1358e1',
          800: '#1647b6',
          900: '#183e8f',
          950: '#132757',
        },
        health: {
          excellent: '#10b981',
          good: '#34d399',
          fair: '#fbbf24',
          poor: '#f97316',
          critical: '#ef4444',
        },
        domain: {
          navigation: '#6366f1',
          crowd: '#f59e0b',
          transport: '#3b82f6',
          accessibility: '#8b5cf6',
          sustainability: '#10b981',
          multilingual: '#ec4899',
          operations: '#6b7280',
          medical: '#ef4444',
          security: '#f97316',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'health-pulse': 'healthPulse 2s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(51, 141, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(51, 141, 255, 0.4)' },
        },
        healthPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
