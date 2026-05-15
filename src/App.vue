<template>
  <div class="container">
    <h1>🎬 MP4 / WebP → WebP / GIF</h1>
    <p class="subtitle">Wklej link do X.com, MP4 lub wgraj plik MP4 / animowany WebP</p>

    <div class="input-group">
      <label>Wideo (Link lub plik MP4 / WebP):</label>
      <div class="input-row">
        <input
          type="text"
          v-model="videoUrl"
          placeholder="Wklej link do wideo..."
          :disabled="isConverting"
        />
        <button
          class="clear-btn"
          @click="videoUrl = ''"
          :disabled="isConverting || !videoUrl"
        >Wyczyść</button>
      </div>
      
      <div class="fetch-row">
        <button
          class="fetch-btn"
          @click="fetchAndSetDuration"
          :disabled="isConverting || !videoUrl || isFetching"
        >
          {{ isFetching ? 'Pobieranie…' : '⬇ Pobierz z linku' }}
        </button>

        <input 
          type="file" 
          ref="fileInput" 
          accept="video/mp4,video/x-m4v,video/*,image/webp" 
          style="display: none" 
          @change="handleFileUpload" 
        />
        <button 
          class="upload-btn" 
          @click="$refs.fileInput.click()" 
          :disabled="isConverting || isFetching"
        >
          📁 Wgraj z dysku
        </button>
      </div>
    </div>

    <div class="params-grid">
      <div class="param-field">
        <label>Czas startu (s):</label>
        <input type="number" v-model.number="startTime" min="0" step="0.5" :disabled="isConverting" />
        <div class="btn-row">
          <button class="num-btn" @click="adjust('startTime', -0.5)" :disabled="isConverting">−</button>
          <button class="num-btn" @click="adjust('startTime', 0.5)" :disabled="isConverting">+</button>
        </div>
      </div>

      <div class="param-field">
        <label>Czas końca (s):</label>
        <input type="number" v-model.number="endTime" min="0.5" step="0.5" :disabled="isConverting" />
        <div class="btn-row">
          <button class="num-btn" @click="adjust('endTime', -0.5)" :disabled="isConverting">−</button>
          <button class="num-btn" @click="adjust('endTime', 0.5)" :disabled="isConverting">+</button>
        </div>
      </div>

      <div class="param-field">
        <label>FPS (klatki/s):</label>
        <input type="number" v-model.number="fps" min="1" max="30" step="1" :disabled="isConverting" />
        <div class="btn-row">
          <button class="num-btn" @click="adjust('fps', -1)" :disabled="isConverting">−</button>
          <button class="num-btn" @click="adjust('fps', 1)" :disabled="isConverting">+</button>
        </div>
      </div>

      <div class="param-field">
        <div class="label-row">
          <label>Szerokość (px):</label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="useOriginalWidth" :disabled="isConverting" />
            Oryginalny rozmiar
          </label>
        </div>
        <input type="number" v-model.number="width" min="100" max="1280" step="10" :disabled="isConverting || useOriginalWidth" />
        <div class="btn-row">
          <button class="num-btn" @click="adjust('width', -10)" :disabled="isConverting || useOriginalWidth">−</button>
          <button class="num-btn" @click="adjust('width', 10)" :disabled="isConverting || useOriginalWidth">+</button>
        </div>
      </div>

      <div class="param-field quality-field">
        <div class="quality-header">
          <label>Jakość (0-100):</label>
          <span class="quality-value">{{ quality }}</span>
        </div>
        <div class="quality-controls">
          <button class="num-btn" @click="quality = Math.max(0, quality - 5)" :disabled="isConverting || quality <= 0">−5</button>
          <button class="num-btn" @click="quality = Math.max(0, quality - 1)" :disabled="isConverting || quality <= 0">−1</button>
          
          <input type="range" v-model.number="quality" min="0" max="100" :disabled="isConverting" />
          
          <button class="num-btn" @click="quality = Math.min(100, quality + 1)" :disabled="isConverting || quality >= 100">+1</button>
          <button class="num-btn" @click="quality = Math.min(100, quality + 5)" :disabled="isConverting || quality >= 100">+5</button>
        </div>
      </div>

      <div class="param-field size-estimate">
        <label>📏 Prognozowany rozmiar {{ outputFormat.toUpperCase() }}:</label>
        <div class="estimate-display">
          <span class="estimate-value">{{ estimatedSize !== null ? formatFileSize(estimatedSize) : '—' }}</span>
          <span class="estimate-note">(po analizie)</span>
        </div>
        <p v-if="sizeConfidence" class="estimate-confidence">Dokładność: ok. {{ Math.round(sizeConfidence * 100) }}%</p>
      </div>

      <div class="param-field size-limit">
        <label>
          <input type="checkbox" v-model="limitSizeEnabled" :disabled="isConverting" />
          Ogranicz rozmiar maksymalny
        </label>
        <div v-if="limitSizeEnabled" class="limit-control">
          <input type="number" v-model.number="targetSizeMB" min="0.1" max="50" step="0.5" :disabled="isConverting" />
          <span>MB</span>
        </div>
        <button class="analyze-btn" @click="analyzeAndEstimate" :disabled="isConverting || !videoUrl || inputExt === 'webp'">
          🔍 Analizuj rozmiar
        </button>
      </div>
    </div>

    <!-- Wybór formatu wyjściowego -->
    <div class="format-selector">
      <label class="format-label">Format wyjściowy:</label>
      <div class="format-options">
        <button
          class="format-btn"
          :class="{ active: outputFormat === 'webp' }"
          @click="outputFormat = 'webp'"
          :disabled="isConverting"
        >
          <span class="format-icon">🖼️</span>
          <span>WebP</span>
        </button>
        <button
          class="format-btn"
          :class="{ active: outputFormat === 'gif' }"
          @click="outputFormat = 'gif'"
          :disabled="isConverting"
        >
          <span class="format-icon">🎞️</span>
          <span>GIF</span>
        </button>
      </div>
    </div>

    <!-- Metadane oryginalnego pliku -->
    <div v-if="originalWidth" class="original-meta">
      <h4>📁 Informacje o źródle</h4>
      <div class="meta-grid">
        <div><span>Rozmiar:</span> {{ formatFileSize(originalSize) }}</div>
        <div><span>Wymiary:</span> {{ originalWidth }}×{{ originalHeight }} px</div>
        <div><span>FPS:</span> {{ originalFps }}</div>
        <div><span>Czas trwania:</span> {{ originalDuration?.toFixed(2) }} s</div>
      </div>
    </div>

    <div class="crop-section">
      <button
        class="crop-toggle-btn"
        :class="{ active: cropEnabled }"
        @click="toggleCrop"
        :disabled="isConverting"
      >
        ✂️ {{ cropEnabled ? 'Wyłącz przycinanie' : 'Przytnij kadr' }}
      </button>

      <div v-if="cropEnabled" class="crop-controls">
        <div class="sync-row">
          <label>
            <input type="checkbox" v-model="syncVertical" :disabled="isConverting" />
            Synchronizuj (Góra/Dół)
          </label>
        </div>
        <div class="crop-grid">
          <div class="crop-field">
            <label>⬆ Góra (px):</label>
            <input type="number" v-model.number="cropTop" min="0" step="5" :disabled="isConverting" />
            <div class="btn-row">
              <button class="num-btn" @click="adjustCrop('cropTop', -5)" :disabled="isConverting">−</button>
              <button class="num-btn" @click="adjustCrop('cropTop', 5)" :disabled="isConverting">+</button>
            </div>
          </div>
          <div class="crop-field">
            <label>⬇ Dół (px):</label>
            <input type="number" v-model.number="cropBottom" min="0" step="5" :disabled="isConverting" />
            <div class="btn-row">
              <button class="num-btn" @click="adjustCrop('cropBottom', -5)" :disabled="isConverting">−</button>
              <button class="num-btn" @click="adjustCrop('cropBottom', 5)" :disabled="isConverting">+</button>
            </div>
          </div>
        </div>

        <div class="sync-row">
          <label>
            <input type="checkbox" v-model="syncHorizontal" :disabled="isConverting" />
            Synchronizuj (Lewo/Prawo)
          </label>
        </div>
        <div class="crop-grid">
          <div class="crop-field">
            <label>⬅ Lewo (px):</label>
            <input type="number" v-model.number="cropLeft" min="0" step="5" :disabled="isConverting" />
            <div class="btn-row">
              <button class="num-btn" @click="adjustCrop('cropLeft', -5)" :disabled="isConverting">−</button>
              <button class="num-btn" @click="adjustCrop('cropLeft', 5)" :disabled="isConverting">+</button>
            </div>
          </div>
          <div class="crop-field">
            <label>➡ Prawo (px):</label>
            <input type="number" v-model.number="cropRight" min="0" step="5" :disabled="isConverting" />
            <div class="btn-row">
              <button class="num-btn" @click="adjustCrop('cropRight', -5)" :disabled="isConverting">−</button>
              <button class="num-btn" @click="adjustCrop('cropRight', 5)" :disabled="isConverting">+</button>
            </div>
          </div>
        </div>

        <button class="reset-crop-btn" @click="resetCrop" :disabled="isConverting">
          🔄 Resetuj kadrowanie
        </button>

        <div v-if="cropTop || cropBottom || cropLeft || cropRight" class="crop-summary">
          Wynikowy kadr:
          <strong v-if="previewNaturalWidth">
            {{ previewNaturalWidth - cropLeft - cropRight }} × {{ previewNaturalHeight - cropTop - cropBottom }} px
          </strong>
          <span v-else>
            (oryg. − {{ cropLeft + cropRight }}px szer., − {{ cropTop + cropBottom }}px wys.)
          </span>
        </div>

        <div v-if="previewFrame" class="crop-preview">
          <p class="preview-label">
            Podgląd kadrowania
            <span v-if="previewNaturalWidth" class="preview-dims">
              (oryg. {{ previewNaturalWidth }}×{{ previewNaturalHeight }}px)
            </span>
          </p>
          <div class="preview-wrapper" ref="previewWrapper">
            <img
              ref="previewImg"
              :src="previewFrame"
              alt="Podgląd klatki"
              @load="onPreviewLoaded"
            />
            <canvas ref="cropCanvas"></canvas>
          </div>
        </div>
        <p v-else-if="isLoadingPreview" class="preview-loading">⏳ Ładowanie podglądu…</p>
      </div>
    </div>

    <button class="convert-btn" @click="convert" :disabled="isConverting || !videoUrl">
      {{ isConverting ? 'Konwertowanie…' : (inputExt === 'webp' ? 'Zastosuj zmiany i wygeneruj ' + outputFormat.toUpperCase() : 'Konwertuj do ' + outputFormat.toUpperCase()) }}
    </button>

    <div v-if="isConverting" class="loader-container">
      <div class="spinner"></div>
      <p class="loader-text">Trwa przetwarzanie...</p>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="resultUrl" class="result-area">
      <h3>Wynik:</h3>
      <img :src="resultUrl" :alt="'Wynikowy ' + outputFormat.toUpperCase()" />
      <div class="result-info">
        <p>Rzeczywisty rozmiar: {{ formatFileSize(resultBlob?.size || 0) }}</p>
      </div>
      <button class="download-btn" @click="downloadResult">⬇ Pobierz {{ outputFormat.toUpperCase() }}</button>
    </div>

    <p class="note">
      Uwaga: pierwsze uruchomienie FFmpeg.wasm ładuje ~30 MB plików. Kolejne konwersje będą szybsze.<br>
      Edycja plików WebP (crop / zmiana FPS / jakości) wymaga przeglądarki z ImageDecoder (Chrome/Edge).
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// ---- Stan aplikacji ----
const videoUrl   = ref('');
const startTime  = ref(0);
const endTime    = ref(20);
const fps        = ref(20);
const width      = ref(350);
const quality    = ref(85);
const useOriginalWidth = ref(false);

// Format wyjściowy
const outputFormat = ref('webp'); // 'webp' lub 'gif'

const limitSizeEnabled = ref(false);
const targetSizeMB     = ref(10);

const isConverting    = ref(false);
const isFetching      = ref(false);
const error           = ref('');
const resultUrl       = ref(null);
const resultBlob      = ref(null);

// Analiza rozmiaru
const estimatedSize  = ref(null);
const sizeConfidence = ref(null);

// Cache pobranego pliku
const cachedFileData = ref(null);
const cachedUrl      = ref('');

// Rozszerzenie pliku wejściowego (mp4 lub webp)
const inputExt = ref('mp4');

// Metadane oryginalnego pliku
const originalSize     = ref(null);
const originalWidth    = ref(null);
const originalHeight   = ref(null);
const originalFps      = ref(null);
const originalDuration = ref(null);

// Crop
const cropEnabled = ref(false);
const cropTop     = ref(0);
const cropBottom  = ref(0);
const cropLeft    = ref(0);
const cropRight   = ref(0);

// Synchronizacja wartości crop
const syncVertical   = ref(true);
const syncHorizontal = ref(true);

// Podgląd klatki
const previewFrame         = ref(null);
const previewNaturalWidth  = ref(0);
const previewNaturalHeight = ref(0);
const isLoadingPreview     = ref(false);

// Template refs
const previewImg     = ref(null);
const cropCanvas     = ref(null);
const previewWrapper = ref(null);
const fileInput      = ref(null);

let ffmpeg = null;

// ---- Parser metadanych WebP (czysty JS) ----
function readUint24LE(view, offset) {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
}

function parseWebPMetadata(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (data.length < 12) return null;

  const riff = String.fromCharCode(...data.slice(0, 4));
  const webp = String.fromCharCode(...data.slice(8, 12));
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;

  let offset = 12;
  let width = 0, height = 0, duration = 0, frameCount = 0;
  let hasAnimation = false;

  while (offset < data.length - 8) {
    const id = String.fromCharCode(...data.slice(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    const paddedSize = size + (size & 1);
    const chunkStart = offset + 8;

    if (id === 'VP8X' && size >= 10) {
      hasAnimation = !!(data[chunkStart] & 0x02);
      width = readUint24LE(view, chunkStart + 4) + 1;
      height = readUint24LE(view, chunkStart + 7) + 1;
    } else if (id === 'ANMF' && size >= 16) {
      const frameDur = readUint24LE(view, chunkStart + 12);
      duration += frameDur;
      frameCount++;
    }

    offset = chunkStart + paddedSize;
  }

  if (!hasAnimation) {
    frameCount = 1;
  }

  return { width, height, duration: duration / 1000, frameCount, hasAnimation };
}

// ---- Reset stanu przed nowym wideo ----
function resetConversionState() {
  startTime.value = 0;
  endTime.value = 20;
  fps.value = 20;
  width.value = 350;
  quality.value = 85;

  cropEnabled.value = false;
  cropTop.value = 0;
  cropBottom.value = 0;
  cropLeft.value = 0;
  cropRight.value = 0;
  syncVertical.value = true;
  syncHorizontal.value = true;

  if (resultUrl.value) {
    URL.revokeObjectURL(resultUrl.value);
    resultUrl.value = null;
    resultBlob.value = null;
  }

  clearPreview();
  estimatedSize.value = null;
  sizeConfidence.value = null;
  inputExt.value = 'mp4';

  originalSize.value = null;
  originalWidth.value = null;
  originalHeight.value = null;
  originalFps.value = null;
  originalDuration.value = null;
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  resetConversionState();

  isFetching.value = true;
  error.value = '';
  videoUrl.value = file.name;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    
    cachedFileData.value = fileData;
    cachedUrl.value = file.name;

    const isWebP = file.name.toLowerCase().endsWith('.webp') || file.type === 'image/webp';
    inputExt.value = isWebP ? 'webp' : 'mp4';

    let metadata;
    if (isWebP) {
      metadata = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength));
      if (!metadata) throw new Error('Nie udało się odczytać metadanych WebP.');
    } else {
      metadata = await getVideoMetadata(fileData, 'mp4');
    }

    // Ustaw metadane oryginalne
    originalSize.value = file.size;
    originalWidth.value = metadata.width;
    originalHeight.value = metadata.height;
    originalDuration.value = metadata.duration;

    if (isWebP) {
      originalFps.value = (metadata.duration > 0)
        ? Math.round((metadata.frameCount / metadata.duration) * 10) / 10
        : metadata.frameCount;
    } else {
      originalFps.value = metadata.fps;
    }

    if (metadata.duration) {
      endTime.value = metadata.duration;
    }
    if (useOriginalWidth.value && metadata.width) {
      width.value = metadata.width;
    }
  } catch (e) {
    error.value = `Błąd ładowania pliku: ${e.message}`;
  } finally {
    isFetching.value = false;
    event.target.value = '';
  }
}

// ---- Pomocnicze ----
function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

const paramRefs = { startTime, endTime, fps, width };
const paramMin  = { startTime: 0, endTime: 0.5, fps: 1, width: 100 };
const paramMax  = { fps: 30, width: 1280 };
const paramStep = { startTime: 0.5, endTime: 0.5, fps: 1, width: 10 };

function adjust(field, delta) {
  if (field === 'width' && useOriginalWidth.value) return;
  const r    = paramRefs[field];
  const step = paramStep[field];
  let val = Math.round((r.value + delta) / step) * step;
  if (paramMin[field] !== undefined) val = Math.max(paramMin[field], val);
  if (paramMax[field] !== undefined) val = Math.min(paramMax[field], val);
  r.value = val;
}

const cropRefs = { cropTop, cropBottom, cropLeft, cropRight };

function adjustCrop(field, delta) {
  cropRefs[field].value = Math.max(0, cropRefs[field].value + delta);
}

function resetCrop() {
  cropTop.value = 0;
  cropBottom.value = 0;
  cropLeft.value = 0;
  cropRight.value = 0;
}

function buildVfFilter() {
  const parts = [];
  const cl = cropLeft.value   || 0;
  const cr = cropRight.value  || 0;
  const ct = cropTop.value    || 0;
  const cb = cropBottom.value || 0;
  
  if (cropEnabled.value && (cl + cr + ct + cb > 0)) {
    parts.push(`crop=iw-${cl + cr}:ih-${ct + cb}:${cl}:${ct}`);
  }
  parts.push(`fps=${fps.value}`);
  parts.push(`scale=${width.value}:trunc(ow/a/2)*2`); 
  return parts.join(',');
}

function toggleCrop() {
  cropEnabled.value = !cropEnabled.value;
  if (!cropEnabled.value) clearPreview();
}

function clearPreview() {
  if (previewFrame.value) {
    URL.revokeObjectURL(previewFrame.value);
    previewFrame.value = null;
  }
  previewNaturalWidth.value  = 0;
  previewNaturalHeight.value = 0;
}

// ---- Inicjalizacja FFmpeg ----
onMounted(async () => {
  ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => console.log(message));

  try {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch (err) {
    console.error('Błąd ładowania FFmpeg:', err);
    error.value = 'Nie udało się załadować silnika FFmpeg. Odśwież stronę.';
  }
});

// ---- Pobieranie z cache'em ----
async function fetchVideo(url) {
  const trimmed = url.trim();
  if (cachedUrl.value === trimmed && cachedFileData.value) {
    return new Uint8Array(cachedFileData.value.slice().buffer);
  }
  const needsProxy = trimmed.includes('x.com') || trimmed.includes('twitter.com') || trimmed.includes('video.twimg.com');
  let fileData;
  if (needsProxy) {
    const res = await fetch(`/api/download?url=${encodeURIComponent(trimmed)}&raw=true`);
    if (!res.ok) throw new Error(`Błąd API (${res.status})`);
    fileData = new Uint8Array(await (await res.blob()).arrayBuffer());
  } else {
    fileData = await fetchFile(trimmed);
  }
  cachedUrl.value      = trimmed;
  cachedFileData.value = new Uint8Array(fileData.slice().buffer);
  return new Uint8Array(fileData.slice().buffer);
}

// ---- Odczyt metadanych (duration + width + height + fps) ----
async function getVideoMetadata(fileData, ext = 'mp4') {
  if (ext === 'webp') {
    const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength));
    return meta || { duration: null, width: null, height: null, fps: null };
  }

  const dataCopy = new Uint8Array(fileData.slice().buffer);
  await ffmpeg.writeFile('meta.mp4', dataCopy);

  let fullLog = '';
  const logHandler = ({ message }) => { fullLog += message + '\n'; };
  ffmpeg.on('log', logHandler);

  try {
    await ffmpeg.exec(['-i', 'meta.mp4']);
  } catch (e) {
    // oczekiwany błąd – ignorujemy
  }

  ffmpeg.off('log', logHandler);
  await ffmpeg.deleteFile('meta.mp4');

  let duration = null;
  let width = null;
  let height = null;
  let fps = null;

  const durMatch = fullLog.match(/Duration: (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (durMatch) {
    const hours = parseInt(durMatch[1]);
    const minutes = parseInt(durMatch[2]);
    const seconds = parseFloat(durMatch[3]);
    duration = hours * 3600 + minutes * 60 + seconds;
  }

  const sizeMatch = fullLog.match(/Stream #\d+:\d+.*?[Vv]ideo:.*? (\d{2,})x(\d{2,})/);
  if (sizeMatch) {
    width = parseInt(sizeMatch[1]);
    height = parseInt(sizeMatch[2]);
  }

  const fpsMatch = fullLog.match(/(\d+(?:\.\d+)?)\s*fps/);
  if (fpsMatch) {
    fps = parseFloat(fpsMatch[1]);
  } else {
    const tbrMatch = fullLog.match(/(\d+(?:\.\d+)?)\s*tbr/);
    if (tbrMatch) {
      fps = parseFloat(tbrMatch[1]);
    }
  }

  return { duration, width, height, fps };
}

// ---- Pobierz i ustaw czas trwania oraz szerokość ----
async function fetchAndSetDuration() {
  if (!videoUrl.value.trim()) return;
  
  resetConversionState();

  isFetching.value = true;
  error.value = '';
  
  try {
    const fileData = await fetchVideo(videoUrl.value);
    const url = videoUrl.value.trim().toLowerCase();
    inputExt.value = url.endsWith('.webp') ? 'webp' : 'mp4';
    
    const metadata = await getVideoMetadata(fileData, inputExt.value);
    
    originalSize.value = fileData.length;
    originalWidth.value = metadata.width;
    originalHeight.value = metadata.height;
    originalDuration.value = metadata.duration;

    if (inputExt.value === 'webp') {
      const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength));
      originalFps.value = (meta && meta.duration > 0)
        ? Math.round((meta.frameCount / meta.duration) * 10) / 10
        : (meta ? meta.frameCount : null);
    } else {
      originalFps.value = metadata.fps;
    }
    
    if (metadata.duration) {
      endTime.value = metadata.duration;
    }
    
    if (useOriginalWidth.value && metadata.width) {
      width.value = metadata.width;
    }
  } catch (e) {
    error.value = `Błąd pobierania: ${e.message}`;
  } finally {
    isFetching.value = false;
  }
}

// ---- Podgląd klatki ----
async function loadPreviewFrame() {
  if (!videoUrl.value.trim() || !ffmpeg) return;
  isLoadingPreview.value = true;
  error.value = '';
  
  try {
    const fileData = await fetchVideo(videoUrl.value);

    if (inputExt.value === 'webp') {
      const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength));
      if (meta) {
        previewNaturalWidth.value = meta.width;
        previewNaturalHeight.value = meta.height;
      }

      const blob = new Blob([fileData], { type: 'image/webp' });
      clearPreview();
      previewFrame.value = URL.createObjectURL(blob);
      isLoadingPreview.value = false;
      return;
    }
    
    await ffmpeg.writeFile('preview_in.mp4', new Uint8Array(fileData.slice().buffer));
    
    const frameTime = startTime.value + (endTime.value - startTime.value) * 0.3;
    
    await ffmpeg.exec([
      '-i', 'preview_in.mp4',
      '-ss', frameTime.toFixed(2),
      '-vframes', '1',
      '-c:v', 'png',
      '-f', 'image2pipe',
      'preview_frame.png'
    ]);
    
    const frameData = await ffmpeg.readFile('preview_frame.png');
    const blob = new Blob([frameData.buffer], { type: 'image/png' });
    
    clearPreview();
    previewFrame.value = URL.createObjectURL(blob);
    
    await ffmpeg.deleteFile('preview_in.mp4');
    await ffmpeg.deleteFile('preview_frame.png');
  } catch (e) {
    error.value = `Błąd podglądu: ${e.message}`;
    console.error('Preview error:', e);
  } finally {
    isLoadingPreview.value = false;
  }
}

function onPreviewLoaded() {
  const img = previewImg.value;
  if (!img) return;
  previewNaturalWidth.value  = img.naturalWidth;
  previewNaturalHeight.value = img.naturalHeight;
  nextTick(() => drawCropOverlay());
}

function drawCropOverlay() {
  const img    = previewImg.value;
  const canvas = cropCanvas.value;
  if (!img || !canvas || !previewFrame.value) return;

  const dw = img.clientWidth;
  const dh = img.clientHeight;
  if (!dw || !dh) return;

  canvas.width  = dw;
  canvas.height = dh;

  const scaleX = dw / img.naturalWidth;
  const scaleY = dh / img.naturalHeight;

  const x = cropLeft.value   * scaleX;
  const y = cropTop.value    * scaleY;
  const w = dw - (cropLeft.value  + cropRight.value)  * scaleX;
  const h = dh - (cropTop.value   + cropBottom.value) * scaleY;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, dw, dh);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0,     0,     dw,          y         );
  ctx.fillRect(0,     y + h, dw,          dh - y - h);
  ctx.fillRect(0,     y,     x,           h         );
  ctx.fillRect(x + w, y,     dw - x - w,  h         );

  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);
  ctx.strokeRect(x, y, w, h);

  const cs = 14;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 3;
  ctx.lineJoin    = 'miter';

  const corners = [
    [x,       y + cs,  x,     y,     x + cs,  y     ],
    [x+w-cs,  y,       x+w,   y,     x+w,     y + cs],
    [x,       y+h-cs,  x,     y+h,   x+cs,    y+h   ],
    [x+w-cs,  y+h,     x+w,   y+h,   x+w,     y+h-cs],
  ];

  for (const [ax, ay, mx, my, bx, by] of corners) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(mx, my);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }
}

// ---- Analiza rozmiaru ----
async function analyzeAndEstimate() {
  if (!videoUrl.value.trim()) return;
  if (inputExt.value === 'webp') {
    error.value = 'Analiza rozmiaru dla WebP nie jest jeszcze obsługiwana.';
    return;
  }

  error.value = '';
  estimatedSize.value  = null;
  sizeConfidence.value = null;
  
  try {
    const fileData = await fetchVideo(videoUrl.value);
    await ffmpeg.writeFile('analyze.mp4', new Uint8Array(fileData.slice().buffer));

    const duration     = endTime.value - startTime.value;
    const testDuration = Math.min(1.0, duration * 0.2);
    const testStart    = startTime.value + duration * 0.4;

    if (outputFormat.value === 'gif') {
      const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
      await ffmpeg.exec([
        '-i',  'analyze.mp4',
        '-ss', testStart.toFixed(2),
        '-t',  testDuration.toFixed(2),
        '-vf', buildVfFilter() + `,split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,
        '-loop', '0',
        'sample.gif',
      ]);

      const sampleSize = (await ffmpeg.readFile('sample.gif')).length;
      await ffmpeg.deleteFile('sample.gif');
      await ffmpeg.deleteFile('analyze.mp4');

      // GIF ma nieliniowy wzrost rozmiaru ze względu na:
      // 1. Narzut palety (globalnej + lokalnych)
      // 2. Tablice kolorów (color lookup tables)
      // 3. Kompresja LZW która jest mniej efektywna przy większej liczbie klatek
      
      const testFrames = Math.floor(testDuration * fps.value);
      const totalFrames = Math.floor(duration * fps.value);
      
      if (testFrames > 0) {
        // Współczynnik nieliniowości: więcej klatek = większy narzut na klatkę
        const nonLinearFactor = 1 + (Math.log(totalFrames / testFrames) * 0.15);
        // Współczynnik zależny od rozmiaru ramki (większa ramka = większy narzut palety)
        const sizeFactor = Math.sqrt((width.value * width.value) / (640 * 480)) || 1;
        
        estimatedSize.value = Math.round((sampleSize / testFrames) * totalFrames * nonLinearFactor * sizeFactor * 1.05);
        sizeConfidence.value = 0.88; // Nieco niższa pewność niż dla WebP
      } else {
        estimatedSize.value = sampleSize;
        sizeConfidence.value = 0.5;
      }

    } else {
      // === ANALIZA DLA WEBP (jak wcześniej) ===
      await ffmpeg.exec([
        '-i',  'analyze.mp4',
        '-ss', testStart.toFixed(2),
        '-t',  testDuration.toFixed(2),
        '-vf', buildVfFilter(),
        '-c:v', 'webp',
        '-q:v', quality.value.toString(),
        '-loop', '0',
        '-preset', 'default',
        '-an',
        'sample.webp',
      ]);

      const sampleSize = (await ffmpeg.readFile('sample.webp')).length;
      await ffmpeg.deleteFile('sample.webp');
      await ffmpeg.deleteFile('analyze.mp4');

      estimatedSize.value  = Math.round((sampleSize / testDuration) * duration * 1.02);
      sizeConfidence.value = 0.95;
    }

    if (limitSizeEnabled.value) {
      const targetBytes = targetSizeMB.value * 1024 * 1024;
      if (estimatedSize.value > targetBytes) {
        if (outputFormat.value === 'gif') {
          // Dla GIF zmniejszamy szerokość (bardziej wpływa na rozmiar niż jakość)
          const scaleFactor = Math.sqrt(targetBytes / estimatedSize.value);
          width.value = Math.max(100, Math.floor(width.value * scaleFactor / 10) * 10);
        } else {
          quality.value = Math.max(1, Math.min(100, Math.floor(quality.value * Math.sqrt(targetBytes / estimatedSize.value))));
        }
        await analyzeAndEstimate();
      }
    }
  } catch (e) {
    error.value = `Błąd analizy: ${e.message}`;
    console.error(e);
  }
}

// ---- Główna konwersja ----
async function convert() {
  if (!videoUrl.value.trim()) { error.value = 'Wprowadź link do wideo lub wgraj plik.'; return; }

  error.value         = '';
  resultUrl.value    = null;
  resultBlob.value   = null;
  isConverting.value = true;

  try {
    const fileData = await fetchVideo(videoUrl.value);

    if (inputExt.value === 'webp') {
      // ---- ŚCIEŻKA WEBP (przez ImageDecoder + Canvas + PNG) ----
      if (typeof ImageDecoder === 'undefined') {
        throw new Error('Edycja plików WebP wymaga przeglądarki z ImageDecoder (Chrome/Edge).');
      }

      const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength));
      if (!meta) throw new Error('Nie udało się odczytać metadanych WebP.');

      const decoder = new ImageDecoder({ data: fileData, type: 'image/webp' });
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const totalFrames = track.frameCount;
      const totalDuration = meta.duration || 1;

      const userStart = startTime.value;
      const userEnd = endTime.value;
      const userFps = fps.value;
      const targetDuration = Math.max(0.1, userEnd - userStart);
      const outputFrameCount = Math.max(1, Math.floor(targetDuration * userFps));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const srcW = meta.width;
      const srcH = meta.height;
      const cl = cropLeft.value || 0;
      const cr = cropRight.value || 0;
      const ct = cropTop.value || 0;
      const cb = cropBottom.value || 0;
      const cropW = Math.max(1, srcW - cl - cr);
      const cropH = Math.max(1, srcH - ct - cb);

      let outW = width.value;
      let outH = Math.round(outW * cropH / cropW);
      outH = Math.max(2, outH + (outH % 2));

      canvas.width = outW;
      canvas.height = outH;

      const originalFps = totalFrames / totalDuration;

      for (let i = 0; i < outputFrameCount; i++) {
        const t = userStart + (i / userFps);
        const srcIndex = Math.min(totalFrames - 1, Math.max(0, Math.floor(t * originalFps)));

        const result = await decoder.decode({ frameIndex: srcIndex });
        const frame = result.image;

        ctx.drawImage(frame, cl, ct, cropW, cropH, 0, 0, outW, outH);
        frame.close();

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const buf = await blob.arrayBuffer();
        await ffmpeg.writeFile(`frame_${String(i).padStart(5, '0')}.png`, new Uint8Array(buf));
      }

      decoder.close();

      if (outputFormat.value === 'gif') {
        const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
        await ffmpeg.exec([
          '-f', 'image2',
          '-framerate', userFps.toString(),
          '-i', 'frame_%05d.png',
          '-vf', `split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,
          '-loop', '0',
          'output.gif',
        ]);
      } else {
        await ffmpeg.exec([
          '-f', 'image2',
          '-framerate', userFps.toString(),
          '-i', 'frame_%05d.png',
          '-c:v', 'libwebp',
          '-q:v', quality.value.toString(),
          '-loop', '0',
          '-preset', 'default',
          '-an',
          'output.webp',
        ]);
      }

      for (let i = 0; i < outputFrameCount; i++) {
        await ffmpeg.deleteFile(`frame_${String(i).padStart(5, '0')}.png`);
      }

      const outExt = outputFormat.value;
      const data = await ffmpeg.readFile('output.' + outExt);
      resultBlob.value = new Blob([data.buffer], { type: outExt === 'gif' ? 'image/gif' : 'image/webp' });
      resultUrl.value = URL.createObjectURL(resultBlob.value);
      await ffmpeg.deleteFile('output.' + outExt);

    } else {
      // ---- STANDARDOWA ŚCIEŻKA MP4 ----
      await ffmpeg.writeFile('input.mp4', new Uint8Array(fileData.slice().buffer)); 

      if (outputFormat.value === 'gif') {
        const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
        await ffmpeg.exec([
          '-i',  'input.mp4',
          '-ss', startTime.value.toString(),
          '-to', endTime.value.toString(),
          '-vf', buildVfFilter() + `,split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,
          '-loop', '0',
          'output.gif',
        ]);
      } else {
        await ffmpeg.exec([
          '-i',  'input.mp4',
          '-ss', startTime.value.toString(),
          '-to', endTime.value.toString(),
          '-vf', buildVfFilter(),
          '-c:v', 'webp',
          '-q:v', quality.value.toString(),
          '-loop', '0',
          '-preset', 'default',
          '-an',
          'output.webp',
        ]);
      }

      const outExt = outputFormat.value;
      const data = await ffmpeg.readFile('output.' + outExt);
      resultBlob.value = new Blob([data.buffer], { type: outExt === 'gif' ? 'image/gif' : 'image/webp' });
      resultUrl.value  = URL.createObjectURL(resultBlob.value);

      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.' + outExt);
    }
  } catch (e) {
    error.value = `Błąd konwersji: ${e.message}`;
    console.error(e);
  } finally {
    isConverting.value = false;
  }
}

function downloadResult() {
  if (!resultBlob.value) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(resultBlob.value);
  link.download = 'animation.' + outputFormat.value;
  link.click();
}

// ---- Watchery ----
watch(videoUrl, (newUrl) => {
  if (newUrl.trim() !== cachedUrl.value) {
    cachedFileData.value = null;
    cachedUrl.value      = '';
    estimatedSize.value  = null;
    sizeConfidence.value = null;
    inputExt.value       = 'mp4';

    originalSize.value = null;
    originalWidth.value = null;
    originalHeight.value = null;
    originalFps.value = null;
    originalDuration.value = null;

    clearPreview();
  }
});

watch(cropTop, (val) => { if (syncVertical.value) cropBottom.value = val; });
watch(cropBottom, (val) => { if (syncVertical.value) cropTop.value = val; });
watch(cropLeft, (val) => { if (syncHorizontal.value) cropRight.value = val; });
watch(cropRight, (val) => { if (syncHorizontal.value) cropLeft.value = val; });

watch(cropEnabled, async (enabled) => {
  if (enabled && !previewFrame.value && videoUrl.value.trim() && !isLoadingPreview.value) {
    await loadPreviewFrame();
  }
});

watch([cropTop, cropBottom, cropLeft, cropRight], () => {
  drawCropOverlay();
});

watch(useOriginalWidth, async (enabled) => {
  if (enabled && cachedFileData.value && cachedUrl.value === videoUrl.value.trim()) {
    try {
      const copy = new Uint8Array(cachedFileData.value.slice().buffer);
      const metadata = await getVideoMetadata(copy, inputExt.value);
      if (metadata.width) {
        width.value = metadata.width;
      }
    } catch (e) {
      console.warn('Nie udało się odczytać szerokości:', e);
    }
  }
});
</script>

<style scoped>
.format-selector {
  margin-bottom: 1.25rem;
  background: #f8f9fa;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  border: 1px solid #e9ecef;
}

.format-label {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: #495057;
}

.format-options {
  display: flex;
  gap: 0.5rem;
}

.format-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  background: white;
  color: #495057;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.format-btn:hover:not(:disabled) {
  border-color: #adb5bd;
  background: #f8f9fa;
}

.format-btn.active {
  border-color: #1da1f2;
  background: #e7f5ff;
  color: #0c63e4;
}

.format-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.format-icon {
  font-size: 1.1rem;
}

.original-meta {
  margin-bottom: 1.25rem;
  background: #f0f4f8;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  border: 1px solid #dde3ea;
}

.original-meta h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #334155;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem 1rem;
  font-size: 0.85rem;
  color: #475569;
}

.meta-grid div span {
  font-weight: 600;
  color: #1e293b;
}

@media (max-width: 600px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
  
  .format-options {
    flex-direction: column;
  }
}
</style>