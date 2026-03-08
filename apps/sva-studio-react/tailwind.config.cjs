/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/auth/src/**/*.{ts,tsx}',
    '../../packages/core/src/**/*.{ts,tsx}',
    '../../packages/routing/src/**/*.{ts,tsx}',
    '../../packages/sdk/src/**/*.{ts,tsx}',
    '../../packages/monitoring-client/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
