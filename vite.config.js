import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Descomentado y actualizado: Establece la carpeta src como la raíz del proyecto para Vite
  root: resolve(import.meta.dirname, 'src'),
  
  // Mantiene las rutas relativas portátiles tanto para locales como para GitHub Pages (/OpenFlash/)
  base: './',
  
  build: {
    // Configura la carpeta de salida para que compile fuera de src, subiendo un nivel hacia la raíz general
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true, // Limpia la carpeta dist antes de cada compilación
    target: 'esnext'   // Optimiza el JavaScript para los motores Chromium modernos de CEF
  }
});
