import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base relativa: la app funciona igual en la raíz de un dominio que en una subcarpeta (GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5190 },
  preview: { port: 5191 },
});
