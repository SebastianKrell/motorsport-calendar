import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages liefert Projekt-Seiten unter /<repo-name>/ aus.
// isPreview mitprüfen: `vite preview` hat command 'serve', muss aber wie der
// Produktions-Build unter /motorsport-calendar/ ausgeliefert werden, sonst
// zeigen HTML und Static-Server auf unterschiedliche Pfade.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/motorsport-calendar/' : '/',
  plugins: [react()],
}));
