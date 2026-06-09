import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true'
    }),
    react(),
  ],
  build: {
    // Strip all console.* calls in production builds
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Manual chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI framework
          'vendor-ui': ['framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          // Charts & data viz
          'vendor-charts': ['recharts'],
          // Map libraries (heavy — only load on Explore page)
          'vendor-maps': ['react-leaflet', 'leaflet'],
          // PDF generation (heavy — only load when needed)
          'vendor-pdf': ['jspdf', 'html2canvas'],
          // 3D (Three.js — heavy, only load in relevant pages)
          'vendor-three': ['three'],
        }
      }
    },
    // Warn threshold (existing code has one chunk > 500KB)
    chunkSizeWarningLimit: 600,
  }
});
