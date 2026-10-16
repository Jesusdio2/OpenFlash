import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Establece la carpeta src como la raíz del proyecto para Vite
  // root: resolve(__dirname, 'src'),
  base: './',
  
  // Configura la carpeta de salida para que compile fuera de src, en la raíz general
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true, // Limpia la carpeta dist antes de cada compilación
    target: 'esnext'   // Optimiza el JavaScript para los motores Chromium modernos de CEF
  }
});
