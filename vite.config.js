import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/x-api': {
        target: 'https://cdn.syndication.twimg.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/x-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Dodajemy nagłówki umożliwiające odczyt odpowiedzi przez przeglądarkę
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
            // Czasami potrzebne jest też:
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
          });
        }
      },
      '/x-video': {
        target: 'https://video.twimg.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/x-video/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
          });
        }
      }
    }
  }
})