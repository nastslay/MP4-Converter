<template>
  <div class="container">
    <h1>🎬 MP4 / WebP → WebP / GIF</h1>
    <p class="subtitle">Wklej link do X.com, MP4 lub wgraj plik MP4 / animowany WebP</p>

    <div class="input-group">
      <label>Wideo (Link lub plik MP4 / WebP):</label>
      <div class="input-row">
        <input type="text" v-model="videoUrl" placeholder="Wklej link do wideo..." :disabled="isConverting" />
        <button class="clear-btn" @click="videoUrl = ''" :disabled="isConverting || !videoUrl">Wyczyść</button>
      </div>
      <div class="fetch-row">
        <button class="fetch-btn" @click="fetchAndSetDuration" :disabled="isConverting || !videoUrl || isFetching">
          {{ isFetching ? 'Pobieranie…' : '⬇ Pobierz z linku' }}
        </button>
        <input type="file" ref="fileInput" accept="video/mp4,video/x-m4v,video/*,image/webp" style="display:none" @change="handleFileUpload" />
        <button class="upload-btn" @click="$refs.fileInput.click()" :disabled="isConverting || isFetching">📁 Wgraj z dysku</button>
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

    <!-- Format wyjściowy -->
    <div class="format-selector">
      <label class="format-label">Format wyjściowy:</label>
      <div class="format-options">
        <button class="format-btn" :class="{ active: outputFormat === 'webp' }" @click="outputFormat = 'webp'" :disabled="isConverting">
          <span class="format-icon">🖼️</span><span>WebP</span>
        </button>
        <button class="format-btn" :class="{ active: outputFormat === 'gif' }" @click="outputFormat = 'gif'" :disabled="isConverting">
          <span class="format-icon">🎞️</span><span>GIF</span>
        </button>
      </div>
    </div>

    <!-- Metadane -->
    <div v-if="originalWidth" class="original-meta">
      <h4>📁 Informacje o źródle</h4>
      <div class="meta-grid">
        <div><span>Rozmiar:</span> {{ formatFileSize(originalSize) }}</div>
        <div><span>Wymiary:</span> {{ originalWidth }}×{{ originalHeight }} px</div>
        <div><span>FPS:</span> {{ originalFps }}</div>
        <div><span>Czas trwania:</span> {{ originalDuration?.toFixed(2) }} s</div>
      </div>
    </div>

    <!-- ===== SEKCJA CROP + EDYTOR TEKSTU ===== -->
    <div class="crop-section">
      <button
        class="crop-toggle-btn"
        :class="{ active: editPanelOpen }"
        @click="toggleEditPanel"
        :disabled="isConverting"
      >
        ✂️✏️ {{ editPanelOpen ? 'Wyłącz przycinanie i edycję' : 'Przytnij i edytuj' }}
      </button>

      <div v-if="editPanelOpen" class="edit-panel">

        <!-- CROP CONTROLS -->
        <div class="crop-controls">
          <div class="section-label">✂️ Kadrowanie</div>
          <div class="sync-row">
            <label><input type="checkbox" v-model="syncVertical" :disabled="isConverting" /> Synchronizuj (Góra/Dół)</label>
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
            <label><input type="checkbox" v-model="syncHorizontal" :disabled="isConverting" /> Synchronizuj (Lewo/Prawo)</label>
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
          <div class="crop-row-btns">
            <button class="reset-crop-btn" @click="resetCrop" :disabled="isConverting">🔄 Resetuj kadrowanie</button>
            <div v-if="cropTop || cropBottom || cropLeft || cropRight" class="crop-summary">
              Wynikowy kadr:
              <strong v-if="previewNaturalWidth">{{ previewNaturalWidth - cropLeft - cropRight }} × {{ previewNaturalHeight - cropTop - cropBottom }} px</strong>
              <span v-else>(oryg. − {{ cropLeft + cropRight }}px szer., − {{ cropTop + cropBottom }}px wys.)</span>
            </div>
          </div>
        </div>

        <!-- TEXT EDITOR CONTROLS -->
        <div class="text-controls">
          <div class="section-label">✏️ Tekst na obrazie</div>
          <div class="textbox-tabs">
            <button v-for="(tb, idx) in textBoxes" :key="idx" class="tb-tab" :class="{ active: activeTextBoxIdx === idx }" @click="activeTextBoxIdx = idx">
              Tekst {{ idx + 1 }}{{ tb.text ? ': ' + tb.text.slice(0, 10) + (tb.text.length > 10 ? '…' : '') : '' }}
            </button>
            <button class="tb-tab tb-add" @click="addTextBox" :disabled="textBoxes.length >= 10">+ Dodaj</button>
            <button class="tb-tab tb-remove" @click="removeTextBox" :disabled="textBoxes.length <= 1">🗑</button>
          </div>

          <div v-if="activeTextBox" class="textbox-controls">
            <div class="tc-row">
              <label>Tekst:</label>
              <input type="text" v-model="activeTextBox.text" placeholder="Wpisz tekst…" class="text-input" @input="redrawPreviewOverlay" />
              <button class="emoji-btn" @click="insertEmoji" title="Wstaw emotikon">😊</button>
            </div>
            <div class="tc-row tc-row-wrap">
              <div class="tc-group">
                <label>Czcionka:</label>
                <select v-model="activeTextBox.fontFamily" @change="redrawPreviewOverlay">
                  <option value="Arial">Arial</option>
                  <option value="Arial Black">Arial Black</option>
                  <option value="Impact">Impact</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Trebuchet MS">Trebuchet MS</option>
                  <option value="Comic Sans MS">Comic Sans MS</option>
                </select>
              </div>
              <div class="tc-group">
                <label>Rozmiar:</label>
                <div class="size-row">
                  <button class="num-btn" @click="activeTextBox.fontSize = Math.max(8, activeTextBox.fontSize - 2); redrawPreviewOverlay()">−</button>
                  <input type="number" v-model.number="activeTextBox.fontSize" min="8" max="300" style="width:58px" @change="redrawPreviewOverlay" />
                  <button class="num-btn" @click="activeTextBox.fontSize = Math.min(300, activeTextBox.fontSize + 2); redrawPreviewOverlay()">+</button>
                </div>
              </div>
            </div>
            <div class="tc-row tc-row-wrap">
              <div class="tc-group">
                <label>Kolor tekstu:</label>
                <input type="color" v-model="activeTextBox.color" class="color-pick" @input="redrawPreviewOverlay" />
              </div>
              <div class="tc-group">
                <label>Kolor obrysu/cienia:</label>
                <input type="color" v-model="activeTextBox.shadowColor" class="color-pick" @input="redrawPreviewOverlay" />
              </div>
              <div class="tc-group">
                <label>Obrys px:</label>
                <div class="size-row">
                  <button class="num-btn" @click="activeTextBox.strokeWidth = Math.max(0, activeTextBox.strokeWidth - 1); redrawPreviewOverlay()">−</button>
                  <input type="number" v-model.number="activeTextBox.strokeWidth" min="0" max="20" style="width:48px" @change="redrawPreviewOverlay" />
                  <button class="num-btn" @click="activeTextBox.strokeWidth = Math.min(20, activeTextBox.strokeWidth + 1); redrawPreviewOverlay()">+</button>
                </div>
              </div>
            </div>
            <div class="tc-row tc-row-wrap">
              <label class="checkbox-label"><input type="checkbox" v-model="activeTextBox.bold" @change="redrawPreviewOverlay" /> <strong>Bold</strong></label>
              <label class="checkbox-label"><input type="checkbox" v-model="activeTextBox.italic" @change="redrawPreviewOverlay" /> <em>Kursywa</em></label>
              <label class="checkbox-label"><input type="checkbox" v-model="activeTextBox.underline" @change="redrawPreviewOverlay" /> <u>Podkr.</u></label>
              <label class="checkbox-label"><input type="checkbox" v-model="activeTextBox.shadow" @change="redrawPreviewOverlay" /> Cień</label>
            </div>
            <div class="tc-row">
              <label>Obrót: {{ activeTextBox.rotation }}°</label>
              <input type="range" v-model.number="activeTextBox.rotation" min="-180" max="180" @input="redrawPreviewOverlay" />
              <button class="num-btn" @click="activeTextBox.rotation = 0; redrawPreviewOverlay()">0°</button>
            </div>
            <div class="tc-row">
              <label>Przezrocz.: {{ Math.round(activeTextBox.opacity * 100) }}%</label>
              <input type="range" v-model.number="activeTextBox.opacity" min="0.1" max="1" step="0.05" @input="redrawPreviewOverlay" />
            </div>
          </div>
        </div>

        <!-- UNIFIED PREVIEW CANVAS -->
        <div class="preview-section">
          <p class="preview-label" v-if="previewFrame">
            Podgląd — przeciągnij tekst palcem/myszą, kadrowanie rysuje się automatycznie
            <span v-if="previewNaturalWidth" class="preview-dims">({{ previewNaturalWidth }}×{{ previewNaturalHeight }}px)</span>
          </p>
          <div
            v-if="previewFrame"
            class="unified-preview-wrapper"
            ref="previewWrapper"
          >
            <!-- Ukryty img żeby znać naturalne wymiary -->
            <img
              ref="previewImg"
              :src="previewFrame"
              alt=""
              style="display:none"
              @load="onPreviewLoaded"
            />
            <!-- Jeden canvas: crop overlay + text labels -->
            <canvas
              ref="unifiedCanvas"
              class="unified-canvas"
              @mousedown.prevent="onCanvasMouseDown"
              @mousemove.prevent="onCanvasMouseMove"
              @mouseup.prevent="onCanvasMouseUp"
              @mouseleave.prevent="onCanvasMouseUp"
              @touchstart.prevent="onCanvasTouchStart"
              @touchmove.prevent="onCanvasTouchMove"
              @touchend.prevent="onCanvasTouchEnd"
            ></canvas>
          </div>
          <p v-else-if="isLoadingPreview" class="preview-loading">⏳ Ładowanie podglądu…</p>
          <p v-else class="preview-loading">Podgląd pojawi się po załadowaniu wideo.</p>
        </div>

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
import { ref, computed, onMounted, watch, nextTick } from 'vue';
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
const outputFormat = ref('webp');
const limitSizeEnabled = ref(false);
const targetSizeMB     = ref(10);
const isConverting    = ref(false);
const isFetching      = ref(false);
const error           = ref('');
const resultUrl       = ref(null);
const resultBlob      = ref(null);
const estimatedSize  = ref(null);
const sizeConfidence = ref(null);
const cachedFileData = ref(null);
const cachedUrl      = ref('');
const inputExt = ref('mp4');
const originalSize     = ref(null);
const originalWidth    = ref(null);
const originalHeight   = ref(null);
const originalFps      = ref(null);
const originalDuration = ref(null);

// Crop
const cropEnabled = ref(false);  // kept for VF filter logic
const cropTop     = ref(0);
const cropBottom  = ref(0);
const cropLeft    = ref(0);
const cropRight   = ref(0);
const syncVertical   = ref(true);
const syncHorizontal = ref(true);

// Panel open state (replaces separate cropEnabled + textEditEnabled)
const editPanelOpen = ref(false);

// Podgląd klatki
const previewFrame         = ref(null);
const previewNaturalWidth  = ref(0);
const previewNaturalHeight = ref(0);
const isLoadingPreview     = ref(false);

// Template refs
const previewImg     = ref(null);
const unifiedCanvas  = ref(null);
const previewWrapper = ref(null);
const fileInput      = ref(null);

let ffmpeg = null;

// ---- TEXT EDITOR STATE ----
const activeTextBoxIdx = ref(0);

function createTextBox(yPct = 0.5) {
  return {
    text: '',
    fontFamily: 'Impact',
    fontSize: 100,
    color: '#ffffff',
    shadowColor: '#000000',
    strokeWidth: 2,
    bold: false,
    italic: false,
    underline: false,
    shadow: true,
    rotation: 0,
    opacity: 1,
    xPct: 0.5,
    yPct,
  };
}

const textBoxes = ref([createTextBox(0.5)]);
const activeTextBox = computed(() => textBoxes.value[activeTextBoxIdx.value] || null);

function addTextBox() {
  if (textBoxes.value.length < 2) {
    textBoxes.value.push(createTextBox(0.75));
    activeTextBoxIdx.value = 1;
    nextTick(redrawPreviewOverlay);
  }
}

function removeTextBox() {
  if (textBoxes.value.length > 1) {
    textBoxes.value.splice(activeTextBoxIdx.value, 1);
    activeTextBoxIdx.value = Math.min(activeTextBoxIdx.value, textBoxes.value.length - 1);
    nextTick(redrawPreviewOverlay);
  }
}

// ---- DRAG STATE ----
let dragTextIdx = null;
let dragStartClientX = 0;
let dragStartClientY = 0;
let dragStartXPct = 0;
let dragStartYPct = 0;

function getCanvasBounds() {
  const c = unifiedCanvas.value;
  if (!c) return null;
  return c.getBoundingClientRect();
}

function clientToCanvasPct(clientX, clientY) {
  const bounds = getCanvasBounds();
  if (!bounds) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
  };
}

// Hit-test: check if (clientX, clientY) hits any text label
function hitTestText(clientX, clientY) {
  const c = unifiedCanvas.value;
  if (!c) return -1;
  const bounds = c.getBoundingClientRect();
  const px = (clientX - bounds.left) / bounds.width;
  const py = (clientY - bounds.top) / bounds.height;
  const cw = c.width;
  const ch = c.height;

  // Check in reverse order (last = top)
  for (let i = textBoxes.value.length - 1; i >= 0; i--) {
    const tb = textBoxes.value[i];
    if (!tb.text.trim()) continue;
    const tx = tb.xPct * cw;
    const ty = tb.yPct * ch;
    // Estimate text bounding box
    const estW = tb.fontSize * tb.text.length * 0.6 + 20;
    const estH = tb.fontSize + 10;
    const dx = (px * cw) - tx;
    const dy = (py * ch) - ty;
    if (Math.abs(dx) < estW / 2 && Math.abs(dy) < estH / 2) return i;
  }
  return -1;
}

function onCanvasMouseDown(e) {
  const idx = hitTestText(e.clientX, e.clientY);
  if (idx >= 0) {
    dragTextIdx = idx;
    activeTextBoxIdx.value = idx;
    dragStartClientX = e.clientX;
    dragStartClientY = e.clientY;
    dragStartXPct = textBoxes.value[idx].xPct;
    dragStartYPct = textBoxes.value[idx].yPct;
  }
}

function onCanvasMouseMove(e) {
  if (dragTextIdx === null) return;
  const c = unifiedCanvas.value;
  if (!c) return;
  const bounds = c.getBoundingClientRect();
  const dx = (e.clientX - dragStartClientX) / bounds.width;
  const dy = (e.clientY - dragStartClientY) / bounds.height;
  textBoxes.value[dragTextIdx].xPct = Math.max(0, Math.min(1, dragStartXPct + dx));
  textBoxes.value[dragTextIdx].yPct = Math.max(0, Math.min(1, dragStartYPct + dy));
  redrawPreviewOverlay();
}

function onCanvasMouseUp() {
  dragTextIdx = null;
}

function onCanvasTouchStart(e) {
  const touch = e.touches[0];
  const idx = hitTestText(touch.clientX, touch.clientY);
  if (idx >= 0) {
    dragTextIdx = idx;
    activeTextBoxIdx.value = idx;
    dragStartClientX = touch.clientX;
    dragStartClientY = touch.clientY;
    dragStartXPct = textBoxes.value[idx].xPct;
    dragStartYPct = textBoxes.value[idx].yPct;
  }
}

function onCanvasTouchMove(e) {
  if (dragTextIdx === null) return;
  const touch = e.touches[0];
  const c = unifiedCanvas.value;
  if (!c) return;
  const bounds = c.getBoundingClientRect();
  const dx = (touch.clientX - dragStartClientX) / bounds.width;
  const dy = (touch.clientY - dragStartClientY) / bounds.height;
  textBoxes.value[dragTextIdx].xPct = Math.max(0, Math.min(1, dragStartXPct + dx));
  textBoxes.value[dragTextIdx].yPct = Math.max(0, Math.min(1, dragStartYPct + dy));
  redrawPreviewOverlay();
}

function onCanvasTouchEnd() {
  dragTextIdx = null;
}

// ---- UNIFIED CANVAS DRAW ----
// Draws: background image + crop overlay + text labels (all on one canvas)
function redrawPreviewOverlay() {
  const canvas = unifiedCanvas.value;
  const img = previewImg.value;
  if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

  const dw = previewWrapper.value?.clientWidth || img.naturalWidth;
  const scale = dw / img.naturalWidth;
  const dh = img.naturalHeight * scale;

  canvas.width = dw;
  canvas.height = dh;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, dw, dh);

  // Draw image
  ctx.drawImage(img, 0, 0, dw, dh);

  // Draw crop overlay
  const hasCrop = (cropTop.value || cropBottom.value || cropLeft.value || cropRight.value);
  if (hasCrop) {
    const scaleX = dw / img.naturalWidth;
    const scaleY = dh / img.naturalHeight;
    const x = cropLeft.value * scaleX;
    const y = cropTop.value * scaleY;
    const w = dw - (cropLeft.value + cropRight.value) * scaleX;
    const h = dh - (cropTop.value + cropBottom.value) * scaleY;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, dw, y);
    ctx.fillRect(0, y + h, dw, dh - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, dw - x - w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    // Corner brackets
    const cs = 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    const corners = [
      [x, y+cs, x, y, x+cs, y],
      [x+w-cs, y, x+w, y, x+w, y+cs],
      [x, y+h-cs, x, y+h, x+cs, y+h],
      [x+w-cs, y+h, x+w, y+h, x+w, y+h-cs],
    ];
    for (const [ax, ay, mx, my, bx, by] of corners) {
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(mx,my); ctx.lineTo(bx,by); ctx.stroke();
    }
  }

  // Draw text labels
  for (let i = 0; i < textBoxes.value.length; i++) {
    const tb = textBoxes.value[i];
    if (!tb.text.trim()) continue;
    const tx = tb.xPct * dw;
    const ty = tb.yPct * dh;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate((tb.rotation * Math.PI) / 180);
    ctx.globalAlpha = tb.opacity;

    let fontStr = '';
    if (tb.italic) fontStr += 'italic ';
    if (tb.bold) fontStr += 'bold ';
    fontStr += `${tb.fontSize}px "${tb.fontFamily}"`;
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (tb.shadow) {
      ctx.shadowColor = tb.shadowColor;
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    if (tb.strokeWidth > 0) {
      ctx.strokeStyle = tb.shadowColor;
      ctx.lineWidth = tb.strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(tb.text, 0, 0);
    }

    ctx.fillStyle = tb.color;
    ctx.fillText(tb.text, 0, 0);

    if (tb.underline) {
      const metrics = ctx.measureText(tb.text);
      const tw = metrics.width;
      const uy = tb.fontSize * 0.1;
      ctx.strokeStyle = tb.color;
      ctx.lineWidth = Math.max(1, tb.fontSize * 0.05);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(-tw/2, uy); ctx.lineTo(tw/2, uy); ctx.stroke();
    }

    ctx.restore();

    // Active text indicator (dashed selection box)
    if (i === activeTextBoxIdx.value) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate((tb.rotation * Math.PI) / 180);
      const metrics2 = (() => {
        ctx.font = fontStr;
        return ctx.measureText(tb.text);
      })();
      const selW = metrics2.width + 12;
      const selH = tb.fontSize + 8;
      ctx.strokeStyle = 'rgba(255,255,100,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(-selW/2, -selH/2, selW, selH);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

// Draws text onto an output canvas frame (used during conversion)
function drawTextOnCanvas(ctx, canvasWidth, canvasHeight) {
  for (const tb of textBoxes.value) {
    if (!tb.text.trim()) continue;
    const x = tb.xPct * canvasWidth;
    const y = tb.yPct * canvasHeight;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((tb.rotation * Math.PI) / 180);
    ctx.globalAlpha = tb.opacity;

    let fontStr = '';
    if (tb.italic) fontStr += 'italic ';
    if (tb.bold) fontStr += 'bold ';
    fontStr += `${tb.fontSize}px "${tb.fontFamily}"`;
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (tb.shadow) {
      ctx.shadowColor = tb.shadowColor;
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    if (tb.strokeWidth > 0) {
      ctx.strokeStyle = tb.shadowColor;
      ctx.lineWidth = tb.strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.strokeText(tb.text, 0, 0);
    }

    ctx.fillStyle = tb.color;
    ctx.fillText(tb.text, 0, 0);

    if (tb.underline) {
      const metrics = ctx.measureText(tb.text);
      const tw = metrics.width;
      const uy = tb.fontSize * 0.1;
      ctx.strokeStyle = tb.color;
      ctx.lineWidth = Math.max(1, tb.fontSize * 0.05);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(-tw/2, uy); ctx.lineTo(tw/2, uy); ctx.stroke();
    }

    ctx.restore();
  }
}

// ---- TOGGLE PANEL ----
function toggleEditPanel() {
  editPanelOpen.value = !editPanelOpen.value;
  cropEnabled.value = editPanelOpen.value;
  if (editPanelOpen.value) {
    if (!previewFrame.value && videoUrl.value.trim() && !isLoadingPreview.value) {
      loadPreviewFrame();
    } else {
      nextTick(redrawPreviewOverlay);
    }
  } else {
    clearPreview();
  }
}

// ---- PARSER WEBP ----
function readUint24LE(view, offset) {
  return view.getUint8(offset) | (view.getUint8(offset+1) << 8) | (view.getUint8(offset+2) << 16);
}

function parseWebPMetadata(arrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (data.length < 12) return null;
  const riff = String.fromCharCode(...data.slice(0,4));
  const webp = String.fromCharCode(...data.slice(8,12));
  if (riff !== 'RIFF' || webp !== 'WEBP') return null;
  let offset = 12, w=0, h=0, duration=0, frameCount=0, hasAnimation=false;
  while (offset < data.length - 8) {
    const id = String.fromCharCode(...data.slice(offset, offset+4));
    const size = view.getUint32(offset+4, true);
    const paddedSize = size + (size & 1);
    const chunkStart = offset + 8;
    if (id === 'VP8X' && size >= 10) {
      hasAnimation = !!(data[chunkStart] & 0x02);
      w = readUint24LE(view, chunkStart+4) + 1;
      h = readUint24LE(view, chunkStart+7) + 1;
    } else if (id === 'ANMF' && size >= 16) {
      duration += readUint24LE(view, chunkStart+12);
      frameCount++;
    }
    offset = chunkStart + paddedSize;
  }
  if (!hasAnimation) frameCount = 1;
  return { width: w, height: h, duration: duration/1000, frameCount, hasAnimation };
}

// ---- RESET ----
function resetConversionState() {
  startTime.value = 0; endTime.value = 20; fps.value = 20; width.value = 350; quality.value = 85;
  cropEnabled.value = false;
  cropTop.value = 0; cropBottom.value = 0; cropLeft.value = 0; cropRight.value = 0;
  syncVertical.value = true; syncHorizontal.value = true;
  editPanelOpen.value = false;
  textBoxes.value = [createTextBox(0.5)];
  activeTextBoxIdx.value = 0;
  if (resultUrl.value) { URL.revokeObjectURL(resultUrl.value); resultUrl.value = null; resultBlob.value = null; }
  clearPreview();
  estimatedSize.value = null; sizeConfidence.value = null;
  inputExt.value = 'mp4';
  originalSize.value = null; originalWidth.value = null; originalHeight.value = null;
  originalFps.value = null; originalDuration.value = null;
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  resetConversionState();
  isFetching.value = true; error.value = '';
  videoUrl.value = file.name;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    cachedFileData.value = fileData; cachedUrl.value = file.name;
    const isWebP = file.name.toLowerCase().endsWith('.webp') || file.type === 'image/webp';
    inputExt.value = isWebP ? 'webp' : 'mp4';
    let metadata;
    if (isWebP) {
      metadata = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset+fileData.byteLength));
      if (!metadata) throw new Error('Nie udało się odczytać metadanych WebP.');
    } else {
      metadata = await getVideoMetadata(fileData, 'mp4');
    }
    originalSize.value = file.size; originalWidth.value = metadata.width; originalHeight.value = metadata.height;
    originalDuration.value = metadata.duration;
    originalFps.value = isWebP
      ? (metadata.duration > 0 ? Math.round((metadata.frameCount/metadata.duration)*10)/10 : metadata.frameCount)
      : metadata.fps;
    if (metadata.duration) endTime.value = metadata.duration;
    if (useOriginalWidth.value && metadata.width) width.value = metadata.width;
  } catch(e) { error.value = `Błąd ładowania pliku: ${e.message}`; }
  finally { isFetching.value = false; event.target.value = ''; }
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

const paramRefs = { startTime, endTime, fps, width };
const paramMin  = { startTime: 0, endTime: 0.5, fps: 1, width: 100 };
const paramMax  = { fps: 30, width: 1280 };
const paramStep = { startTime: 0.5, endTime: 0.5, fps: 1, width: 10 };

function adjust(field, delta) {
  if (field === 'width' && useOriginalWidth.value) return;
  const r = paramRefs[field]; const step = paramStep[field];
  let val = Math.round((r.value + delta) / step) * step;
  if (paramMin[field] !== undefined) val = Math.max(paramMin[field], val);
  if (paramMax[field] !== undefined) val = Math.min(paramMax[field], val);
  r.value = val;
}

const cropRefs = { cropTop, cropBottom, cropLeft, cropRight };
function adjustCrop(field, delta) { cropRefs[field].value = Math.max(0, cropRefs[field].value + delta); }
function resetCrop() { cropTop.value=0; cropBottom.value=0; cropLeft.value=0; cropRight.value=0; }

// buildVfFilter — only crop + fps + scale, NO drawtext (text via canvas)
function buildVfFilter() {
  const parts = [];
  const cl = cropLeft.value||0, cr = cropRight.value||0, ct = cropTop.value||0, cb = cropBottom.value||0;
  if (cropEnabled.value && (cl+cr+ct+cb > 0)) parts.push(`crop=iw-${cl+cr}:ih-${ct+cb}:${cl}:${ct}`);
  parts.push(`fps=${fps.value}`);
  parts.push(`scale=${width.value}:trunc(ow/a/2)*2`);
  return parts.join(',');
}

function clearPreview() {
  if (previewFrame.value) { URL.revokeObjectURL(previewFrame.value); previewFrame.value = null; }
  previewNaturalWidth.value = 0; previewNaturalHeight.value = 0;
}

// ---- FFmpeg INIT ----
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

// ---- FETCH VIDEO ----
async function fetchVideo(url) {
  const trimmed = url.trim();
  if (cachedUrl.value === trimmed && cachedFileData.value) return new Uint8Array(cachedFileData.value.slice().buffer);
  const needsProxy = trimmed.includes('x.com') || trimmed.includes('twitter.com') || trimmed.includes('video.twimg.com');
  let fileData;
  if (needsProxy) {
    const res = await fetch(`/api/download?url=${encodeURIComponent(trimmed)}&raw=true`);
    if (!res.ok) throw new Error(`Błąd API (${res.status})`);
    fileData = new Uint8Array(await (await res.blob()).arrayBuffer());
  } else {
    fileData = await fetchFile(trimmed);
  }
  cachedUrl.value = trimmed; cachedFileData.value = new Uint8Array(fileData.slice().buffer);
  return new Uint8Array(fileData.slice().buffer);
}

// ---- VIDEO METADATA ----
async function getVideoMetadata(fileData, ext = 'mp4') {
  if (ext === 'webp') {
    const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset+fileData.byteLength));
    return meta || { duration: null, width: null, height: null, fps: null };
  }
  const dataCopy = new Uint8Array(fileData.slice().buffer);
  await ffmpeg.writeFile('meta.mp4', dataCopy);
  let fullLog = '';
  const logHandler = ({ message }) => { fullLog += message + '\n'; };
  ffmpeg.on('log', logHandler);
  try { await ffmpeg.exec(['-i','meta.mp4']); } catch(e) {}
  ffmpeg.off('log', logHandler);
  await ffmpeg.deleteFile('meta.mp4');
  let duration=null, w=null, h=null, fpsv=null;
  const durMatch = fullLog.match(/Duration: (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (durMatch) duration = parseInt(durMatch[1])*3600 + parseInt(durMatch[2])*60 + parseFloat(durMatch[3]);
  const sizeMatch = fullLog.match(/Stream #\d+:\d+.*?[Vv]ideo:.*? (\d{2,})x(\d{2,})/);
  if (sizeMatch) { w = parseInt(sizeMatch[1]); h = parseInt(sizeMatch[2]); }
  const fpsMatch = fullLog.match(/(\d+(?:\.\d+)?)\s*fps/);
  if (fpsMatch) fpsv = parseFloat(fpsMatch[1]);
  else { const tbrMatch = fullLog.match(/(\d+(?:\.\d+)?)\s*tbr/); if (tbrMatch) fpsv = parseFloat(tbrMatch[1]); }
  return { duration, width: w, height: h, fps: fpsv };
}

async function fetchAndSetDuration() {
  if (!videoUrl.value.trim()) return;
  resetConversionState();
  isFetching.value = true; error.value = '';
  try {
    const fileData = await fetchVideo(videoUrl.value);
    const url = videoUrl.value.trim().toLowerCase();
    inputExt.value = url.endsWith('.webp') ? 'webp' : 'mp4';
    const metadata = await getVideoMetadata(fileData, inputExt.value);
    originalSize.value = fileData.length; originalWidth.value = metadata.width;
    originalHeight.value = metadata.height; originalDuration.value = metadata.duration;
    if (inputExt.value === 'webp') {
      const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset+fileData.byteLength));
      originalFps.value = (meta && meta.duration>0) ? Math.round((meta.frameCount/meta.duration)*10)/10 : (meta ? meta.frameCount : null);
    } else { originalFps.value = metadata.fps; }
    if (metadata.duration) endTime.value = metadata.duration;
    if (useOriginalWidth.value && metadata.width) width.value = metadata.width;
  } catch(e) { error.value = `Błąd pobierania: ${e.message}`; }
  finally { isFetching.value = false; }
}

// ---- PREVIEW FRAME ----
async function loadPreviewFrame() {
  if (!videoUrl.value.trim() || !ffmpeg) return;
  isLoadingPreview.value = true; error.value = '';
  try {
    const fileData = await fetchVideo(videoUrl.value);
    if (inputExt.value === 'webp') {
      const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset+fileData.byteLength));
      if (meta) { previewNaturalWidth.value = meta.width; previewNaturalHeight.value = meta.height; }
      const blob = new Blob([fileData], { type: 'image/webp' });
      clearPreview();
      previewFrame.value = URL.createObjectURL(blob);
      isLoadingPreview.value = false;
      return;
    }
    await ffmpeg.writeFile('preview_in.mp4', new Uint8Array(fileData.slice().buffer));
    const frameTime = startTime.value + (endTime.value - startTime.value) * 0.3;
    await ffmpeg.exec(['-i','preview_in.mp4','-ss',frameTime.toFixed(2),'-vframes','1','-c:v','png','-f','image2pipe','preview_frame.png']);
    const frameData = await ffmpeg.readFile('preview_frame.png');
    const blob = new Blob([frameData.buffer], { type: 'image/png' });
    clearPreview();
    previewFrame.value = URL.createObjectURL(blob);
    await ffmpeg.deleteFile('preview_in.mp4');
    await ffmpeg.deleteFile('preview_frame.png');
  } catch(e) { error.value = `Błąd podglądu: ${e.message}`; console.error(e); }
  finally { isLoadingPreview.value = false; }
}

function onPreviewLoaded() {
  const img = previewImg.value;
  if (!img) return;
  previewNaturalWidth.value = img.naturalWidth;
  previewNaturalHeight.value = img.naturalHeight;
  nextTick(redrawPreviewOverlay);
}

// ---- ANALIZA ROZMIARU ----
async function analyzeAndEstimate() {
  if (!videoUrl.value.trim() || inputExt.value === 'webp') {
    if (inputExt.value === 'webp') error.value = 'Analiza rozmiaru dla WebP nie jest obsługiwana.';
    return;
  }
  error.value = ''; estimatedSize.value = null; sizeConfidence.value = null;
  try {
    const fileData = await fetchVideo(videoUrl.value);
    await ffmpeg.writeFile('analyze.mp4', new Uint8Array(fileData.slice().buffer));
    const duration = endTime.value - startTime.value;
    const testDuration = Math.min(1.0, duration * 0.2);
    const testStart = startTime.value + duration * 0.4;
    if (outputFormat.value === 'gif') {
      const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
      await ffmpeg.exec(['-i','analyze.mp4','-ss',testStart.toFixed(2),'-t',testDuration.toFixed(2),'-vf',buildVfFilter()+`,split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,'-loop','0','sample.gif']);
      const sampleSize = (await ffmpeg.readFile('sample.gif')).length;
      await ffmpeg.deleteFile('sample.gif'); await ffmpeg.deleteFile('analyze.mp4');
      const testFrames = Math.floor(testDuration * fps.value);
      const totalFrames = Math.floor(duration * fps.value);
      if (testFrames > 0) {
        const nonLinearFactor = 1 + (Math.log(totalFrames / testFrames) * 0.15);
        const sizeFactor = Math.sqrt((width.value * width.value) / (640 * 480)) || 1;
        estimatedSize.value = Math.round((sampleSize/testFrames)*totalFrames*nonLinearFactor*sizeFactor*1.05);
        sizeConfidence.value = 0.88;
      } else { estimatedSize.value = sampleSize; sizeConfidence.value = 0.5; }
    } else {
      await ffmpeg.exec(['-i','analyze.mp4','-ss',testStart.toFixed(2),'-t',testDuration.toFixed(2),'-vf',buildVfFilter(),'-c:v','webp','-q:v',quality.value.toString(),'-loop','0','-preset','default','-an','sample.webp']);
      const sampleSize = (await ffmpeg.readFile('sample.webp')).length;
      await ffmpeg.deleteFile('sample.webp'); await ffmpeg.deleteFile('analyze.mp4');
      estimatedSize.value = Math.round((sampleSize/testDuration)*duration*1.02);
      sizeConfidence.value = 0.95;
    }
    if (limitSizeEnabled.value) {
      const targetBytes = targetSizeMB.value * 1024 * 1024;
      if (estimatedSize.value > targetBytes) {
        if (outputFormat.value === 'gif') { width.value = Math.max(100, Math.floor(width.value * Math.sqrt(targetBytes/estimatedSize.value) / 10) * 10); }
        else { quality.value = Math.max(1, Math.min(100, Math.floor(quality.value * Math.sqrt(targetBytes/estimatedSize.value)))); }
        await analyzeAndEstimate();
      }
    }
  } catch(e) { error.value = `Błąd analizy: ${e.message}`; console.error(e); }
}

// ---- KONWERSJA ----
// Wspólna ścieżka canvas dla MP4 i WebP gdy aktywny jest crop lub tekst.
// FFmpeg wyciąga klatki → canvas nakłada crop/tekst → FFmpeg składa animację.
async function convertViaCanvas(fileData, srcExt) {
  const userStart  = startTime.value;
  const userEnd    = endTime.value;
  const userFps    = fps.value;
  const targetDuration = Math.max(0.1, userEnd - userStart);
  const outputFrameCount = Math.max(1, Math.floor(targetDuration * userFps));

  const cl = cropLeft.value||0, cr = cropRight.value||0, ct = cropTop.value||0, cb = cropBottom.value||0;
  const hasCrop = cropEnabled.value && (cl+cr+ct+cb > 0);
  const hasText = textBoxes.value.some(tb => tb.text.trim() !== '');

  let srcW, srcH, srcFps, totalFrames;

  if (srcExt === 'webp') {
    const meta = parseWebPMetadata(fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset+fileData.byteLength));
    if (!meta) throw new Error('Nie udało się odczytać metadanych WebP.');
    srcW = meta.width; srcH = meta.height;
    const totalDuration = meta.duration || 1;
    totalFrames = meta.frameCount;
    srcFps = totalFrames / totalDuration;
  } else {
    // MP4: extract individual frames via ffmpeg
    const meta = await getVideoMetadata(fileData, 'mp4');
    srcW = meta.width || width.value; srcH = meta.height || Math.round(width.value * 9 / 16);
    srcFps = meta.fps || 25;
    totalFrames = Math.round(meta.duration * srcFps);
  }

  const cropW = Math.max(1, srcW - cl - cr);
  const cropH = Math.max(1, srcH - ct - cb);
  let outW = width.value;
  let outH = Math.round(outW * cropH / cropW);
  outH = Math.max(2, outH % 2 === 0 ? outH : outH + 1);

  const canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (srcExt === 'webp') {
    if (typeof ImageDecoder === 'undefined') throw new Error('Edycja plików WebP wymaga przeglądarki z ImageDecoder (Chrome/Edge).');
    const decoder = new ImageDecoder({ data: fileData, type: 'image/webp' });
    await decoder.tracks.ready;

    for (let i = 0; i < outputFrameCount; i++) {
      const t = userStart + (i / userFps);
      const srcIndex = Math.min(totalFrames-1, Math.max(0, Math.floor(t * srcFps)));
      const result = await decoder.decode({ frameIndex: srcIndex });
      const frame = result.image;
      ctx.clearRect(0, 0, outW, outH);
      if (hasCrop) {
        ctx.drawImage(frame, cl, ct, cropW, cropH, 0, 0, outW, outH);
      } else {
        ctx.drawImage(frame, 0, 0, outW, outH);
      }
      if (hasText) drawTextOnCanvas(ctx, outW, outH);
      frame.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const buf = await blob.arrayBuffer();
      await ffmpeg.writeFile(`frame_${String(i).padStart(5,'0')}.png`, new Uint8Array(buf));
    }
    decoder.close();
  } else {
    // MP4: use ffmpeg to extract frames one by one
    await ffmpeg.writeFile('conv_input.mp4', new Uint8Array(fileData.slice().buffer));

    // Extract all needed frames as PNGs
    const rawFilter = [];
    if (hasCrop) rawFilter.push(`crop=${srcW-cl-cr}:${srcH-ct-cb}:${cl}:${ct}`);
    // We'll draw at original size first, then scale on canvas
    const extractFilter = rawFilter.join(',') || 'null';

    // Extract frames in the time range at desired fps
    await ffmpeg.exec([
      '-i', 'conv_input.mp4',
      '-ss', userStart.toString(),
      '-to', userEnd.toString(),
      '-vf', (hasCrop ? `crop=${srcW-cl-cr}:${srcH-ct-cb}:${cl}:${ct},` : '') + `fps=${userFps}`,
      '-f', 'image2',
      'rawframe_%05d.png',
    ]);

    // Count extracted frames
    let frameIdx = 0;
    for (let i = 0; i < outputFrameCount; i++) {
      const fname = `rawframe_${String(i+1).padStart(5,'0')}.png`;
      let rawData;
      try { rawData = await ffmpeg.readFile(fname); } catch(e) {
        // If less frames extracted than expected, stop
        outputFrameCount_actual = i;
        break;
      }
      // Draw on canvas with text
      const imgBlob = new Blob([rawData.buffer], { type: 'image/png' });
      const imgBitmap = await createImageBitmap(imgBlob);
      ctx.clearRect(0, 0, outW, outH);
      ctx.drawImage(imgBitmap, 0, 0, outW, outH);
      imgBitmap.close();
      if (hasText) drawTextOnCanvas(ctx, outW, outH);
      const outBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const outBuf = await outBlob.arrayBuffer();
      await ffmpeg.writeFile(`frame_${String(i).padStart(5,'0')}.png`, new Uint8Array(outBuf));
      await ffmpeg.deleteFile(fname);
      frameIdx = i + 1;
    }

    await ffmpeg.deleteFile('conv_input.mp4');
    outputFrameCount_actual = frameIdx;
  }

  // Assemble animation from frames
  const actualFrameCount = srcExt === 'webp' ? outputFrameCount : (outputFrameCount_actual ?? outputFrameCount);

  if (outputFormat.value === 'gif') {
    const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
    await ffmpeg.exec([
      '-f','image2','-framerate',userFps.toString(),'-i','frame_%05d.png',
      '-vf',`split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,
      '-loop','0','output.gif',
    ]);
  } else {
    await ffmpeg.exec([
      '-f','image2','-framerate',userFps.toString(),'-i','frame_%05d.png',
      '-c:v','libwebp','-q:v',quality.value.toString(),'-loop','0','-preset','default','-an','output.webp',
    ]);
  }

  // Cleanup frames
  for (let i = 0; i < actualFrameCount; i++) {
    try { await ffmpeg.deleteFile(`frame_${String(i).padStart(5,'0')}.png`); } catch(e) {}
  }

  const outExt = outputFormat.value;
  const data = await ffmpeg.readFile('output.' + outExt);
  resultBlob.value = new Blob([data.buffer], { type: outExt === 'gif' ? 'image/gif' : 'image/webp' });
  resultUrl.value = URL.createObjectURL(resultBlob.value);
  await ffmpeg.deleteFile('output.' + outExt);
}

// Variable to track actual frame count in MP4 path
let outputFrameCount_actual = 0;

async function convert() {
  if (!videoUrl.value.trim()) { error.value = 'Wprowadź link do wideo lub wgraj plik.'; return; }
  error.value = ''; resultUrl.value = null; resultBlob.value = null; isConverting.value = true;

  try {
    const fileData = await fetchVideo(videoUrl.value);
    const hasCrop = cropEnabled.value && (cropLeft.value+cropRight.value+cropTop.value+cropBottom.value > 0);
    const hasText = textBoxes.value.some(tb => tb.text.trim() !== '');

    if (inputExt.value === 'webp') {
      // WebP always goes through canvas path
      await convertViaCanvas(fileData, 'webp');
    } else if (hasCrop || hasText) {
      // MP4 with crop or text — canvas path
      await convertViaCanvas(fileData, 'mp4');
    } else {
      // MP4 clean — direct FFmpeg path (fastest)
      await ffmpeg.writeFile('input.mp4', new Uint8Array(fileData.slice().buffer));
      if (outputFormat.value === 'gif') {
        const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
        await ffmpeg.exec(['-i','input.mp4','-ss',startTime.value.toString(),'-to',endTime.value.toString(),'-vf',buildVfFilter()+`,split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,'-loop','0','output.gif']);
      } else {
        await ffmpeg.exec(['-i','input.mp4','-ss',startTime.value.toString(),'-to',endTime.value.toString(),'-vf',buildVfFilter(),'-c:v','webp','-q:v',quality.value.toString(),'-loop','0','-preset','default','-an','output.webp']);
      }
      const outExt = outputFormat.value;
      const data = await ffmpeg.readFile('output.' + outExt);
      resultBlob.value = new Blob([data.buffer], { type: outExt === 'gif' ? 'image/gif' : 'image/webp' });
      resultUrl.value = URL.createObjectURL(resultBlob.value);
      await ffmpeg.deleteFile('input.mp4');
      await ffmpeg.deleteFile('output.' + outExt);
    }
  } catch(e) { error.value = `Błąd konwersji: ${e.message}`; console.error(e); }
  finally { isConverting.value = false; }
}

function insertEmoji() {
  const emojis = ['😀','😂','🤣','😍','🥰','😎','🤔','👍','👎','🔥','💯','❤️','💔','✨','🎉','🚀','💀','🤡','🤯','🥶','🤠','😈','👻','🤖','💩','👀','🙏','💪','🧠','🫡','🥳','😤','🤬','😱','🤮','🤧','😴','😵‍💫','🫠','🤓','🥸','🤥','🫢','🫣','🤭','🤫','🤪','🤑','🤠','😷','🤒','🤕','🤢','🤮','🤧','😇','🥳','🥺','🤠','🤡','🤥','🤫','🤭','🧐','🤓','😈','👿','👹','👺','💀','☠️','👻','👽','👾','🤖','💩','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊','💋','💌','💘','💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️‍🔥','❤️‍🩹','❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗨️','🗯️','💭','💤'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  activeTextBox.value.text += emoji;
  redrawPreviewOverlay();
}

function downloadResult() {
  if (!resultBlob.value) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(resultBlob.value);
  link.download = 'animation.' + outputFormat.value;
  link.click();
}

// ---- WATCHERY ----
watch(videoUrl, (newUrl) => {
  if (newUrl.trim() !== cachedUrl.value) {
    cachedFileData.value = null; cachedUrl.value = ''; estimatedSize.value = null;
    sizeConfidence.value = null; inputExt.value = 'mp4';
    originalSize.value = null; originalWidth.value = null; originalHeight.value = null;
    originalFps.value = null; originalDuration.value = null;
    clearPreview();
  }
});

watch(cropTop,    (val) => { if (syncVertical.value)   cropBottom.value = val; nextTick(redrawPreviewOverlay); });
watch(cropBottom, (val) => { if (syncVertical.value)   cropTop.value    = val; nextTick(redrawPreviewOverlay); });
watch(cropLeft,   (val) => { if (syncHorizontal.value) cropRight.value  = val; nextTick(redrawPreviewOverlay); });
watch(cropRight,  (val) => { if (syncHorizontal.value) cropLeft.value   = val; nextTick(redrawPreviewOverlay); });

watch(activeTextBoxIdx, () => nextTick(redrawPreviewOverlay));

watch(useOriginalWidth, async (enabled) => {
  if (enabled && cachedFileData.value && cachedUrl.value === videoUrl.value.trim()) {
    try {
      const copy = new Uint8Array(cachedFileData.value.slice().buffer);
      const metadata = await getVideoMetadata(copy, inputExt.value);
      if (metadata.width) width.value = metadata.width;
    } catch(e) { console.warn('Nie udało się odczytać szerokości:', e); }
  }
});
</script>

<style scoped>
/* ===== UNIFIED EDIT PANEL ===== */
.edit-panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-label {
  font-weight: 700;
  font-size: 0.88rem;
  color: #374151;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #e5e7eb;
}

.crop-controls {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
}

.crop-row-btns {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.text-controls {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem;
}

.textbox-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.tb-tab {
  padding: 0.35rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #4b5563;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.tb-tab:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
.tb-tab.active { background: #1da1f2; color: white; border-color: #1da1f2; }
.tb-tab.tb-add { border-style: dashed; color: #4caf50; border-color: #4caf50; background: #f0fdf4; }
.tb-tab.tb-add:hover:not(:disabled) { background: #dcfce7; }
.tb-tab.tb-add:disabled { opacity: 0.45; cursor: not-allowed; }
.tb-tab.tb-remove { color: #e53935; border-color: #e53935; background: #fef2f2; }
.tb-tab.tb-remove:hover:not(:disabled) { background: #fee2e2; }
.tb-tab.tb-remove:disabled { opacity: 0.45; cursor: not-allowed; }

.textbox-controls {
  background: white;
  border-radius: 8px;
  padding: 0.65rem;
  border: 1px solid #e5e7eb;
}

.tc-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.45rem;
  flex-wrap: wrap;
}
.tc-row label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  white-space: nowrap;
  min-width: 75px;
}
.tc-row-wrap { flex-wrap: wrap; gap: 0.6rem; }
.tc-group { display: flex; align-items: center; gap: 0.35rem; }
.tc-group label { font-size: 0.8rem; font-weight: 600; color: #374151; white-space: nowrap; }
.text-input { flex: 1; min-width: 110px; padding: 0.4rem 0.55rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; transition: border-color 0.15s; }
.text-input:focus { outline: none; border-color: #1da1f2; }
.color-pick { width: 40px; height: 32px; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; padding: 2px; background: white; }
.size-row { display: flex; align-items: center; gap: 0.2rem; }

.emoji-btn {
  background: #fef9c3;
  border: 1px solid #fde047;
  border-radius: 6px;
  padding: 0.35rem 0.55rem;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.15s;
  line-height: 1;
}
.emoji-btn:hover:not(:disabled) { background: #fef08a; transform: scale(1.05); }
.emoji-btn:active:not(:disabled) { transform: scale(0.95); }

.checkbox-label {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.82rem; cursor: pointer; user-select: none;
}

/* ===== UNIFIED PREVIEW ===== */
.preview-section { margin-top: 0.25rem; }

.unified-preview-wrapper {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #4b6cb7;
  background: #111;
  line-height: 0;
}

.unified-canvas {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
  touch-action: none;
}

.preview-label {
  font-size: 0.82rem;
  color: #6b7280;
  margin: 0 0 0.35rem;
  font-style: italic;
}
.preview-dims { color: #9ca3af; margin-left: 0.3rem; }
.preview-loading { font-size: 0.88rem; color: #6b7280; padding: 0.5rem 0; }

/* ===== FORMAT SELECTOR ===== */
.format-selector {
  margin-bottom: 1.25rem;
  background: #f8f9fa;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  border: 1px solid #e9ecef;
}
.format-label { display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; color: #495057; }
.format-options { display: flex; gap: 0.5rem; }
.format-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 0.6rem 1rem; border: 2px solid #dee2e6; border-radius: 8px;
  background: white; color: #495057; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;
}
.format-btn:hover:not(:disabled) { border-color: #adb5bd; background: #f8f9fa; }
.format-btn.active { border-color: #1da1f2; background: #e7f5ff; color: #0c63e4; }
.format-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.format-icon { font-size: 1.1rem; }

/* ===== META ===== */
.original-meta {
  margin-bottom: 1.25rem; background: #f0f4f8; border-radius: 10px;
  padding: 0.75rem 1rem; border: 1px solid #dde3ea;
}
.original-meta h4 { margin: 0 0 0.5rem; font-size: 0.9rem; color: #334155; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 1rem; font-size: 0.85rem; color: #475569; }
.meta-grid div span { font-weight: 600; color: #1e293b; }

@media (max-width: 600px) {
  .meta-grid { grid-template-columns: 1fr; }
  .format-options { flex-direction: column; }
}
</style>
