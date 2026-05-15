# 🎬 MP4 / WebP → WebP / GIF Converter

A client-side video converter built with Vue 3, Vite, and FFmpeg.wasm. Converts MP4 videos or animated WebP files to WebP animations or GIFs — entirely in the browser.

## Features

- 🔗 Fetch video from X.com / Twitter links or direct MP4 URLs
- 📁 Upload local MP4 or animated WebP files
- ✂️ Crop, trim, resize, and adjust FPS
- 🎨 Quality control with live size estimation
- 📤 Export as animated **WebP** or **GIF**
- 🚀 Runs entirely in the browser (FFmpeg.wasm)

## Tech Stack

- [Vue 3](https://vuejs.org/) — UI framework
- [Vite](https://vitejs.dev/) — build tool
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) — in-browser video processing
- [Vercel](https://vercel.com/) — deployment + serverless API

## Project Structure

```
├── src/
│   ├── App.vue           # Main application component
│   ├── main.js           # Vue app entry point
│   ├── style.css         # Global styles
│   └── xVideoFetcher.js  # X.com / Twitter video URL extractor
├── api/
│   └── download.js       # Vercel serverless function (yt-dlp proxy)
├── index.html
├── vite.config.js
└── vercel.json
```

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Deployment (Vercel)

The app is configured for Vercel deployment. The `api/download.js` serverless function handles X.com video fetching via yt-dlp.

```bash
npm install -g vercel
vercel
```

> **Note:** First FFmpeg.wasm load downloads ~30 MB of files. Subsequent conversions are faster.  
> WebP editing (crop / FPS / quality) requires a browser with `ImageDecoder` support (Chrome/Edge).
