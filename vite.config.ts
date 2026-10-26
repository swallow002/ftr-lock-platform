import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative assets work locally and beneath any GitHub Pages repository path.
export default defineConfig({ plugins: [react()], base: './' });
