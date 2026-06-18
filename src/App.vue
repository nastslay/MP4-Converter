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
        <input type="file" ref="imageFileInput" accept="image/*" style="display:none" @change="handleImageFileUpload" />
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
        <div class="text-controls"></div>
          <div class="section-label">✏️ Tekst na obrazie</div>

          <!-- Scrollowalny rząd zakładek -->
          <div class="textbox-tabs-row">
            <div class="textbox-tabs">
              <button
                v-for="(item, idx) in overlays"
                :key="idx"
                class="tb-tab"
                :class="{ active: activeOverlayIdx === idx }"
                @click="activeOverlayIdx = idx"
              >
                <span class="tb-tab-num">{{ idx + 1 }}</span>
                <span v-if="item.type === 'text'" class="tb-tab-preview">{{ item.text ? item.text.slice(0, 8) + (item.text.length > 8 ? '…' : '') : '(pusty)' }}</span>
                <span v-else class="tb-tab-preview">🖼️ obrazek</span>
              </button>
            </div>
            <!-- ZMIANA 1: Etykiety widoczne na PC i mobile, zmiana nazwy na 'Wgraj obraz z dysku' -->
            <div class="textbox-tab-actions">
              <button class="tab-action-btn tab-add" @click="addTextOverlay" :disabled="overlays.length >= 10" title="Dodaj tekst">
                <span class="tab-action-icon">＋</span>
                <span class="tab-action-label">Tekst</span>
              </button>
              <button class="tab-action-btn tab-add-img" @click="openAddImagePicker" :disabled="overlays.length >= 10" title="Wgraj obraz z dysku">
                <span class="tab-action-icon">🖼️</span>
                <span class="tab-action-label">Wgraj obraz z dysku</span>
              </button>
              <button class="tab-action-btn tab-remove" @click="removeOverlay" :disabled="overlays.length <= 1" title="Usuń aktywną nakładkę">🗑</button>
            </div>
          </div>

          <div v-if="activeOverlay" class="textbox-controls">

            <!-- ======= KONTROLKI DLA TEKSTU ======= -->
            <template v-if="activeOverlay.type === 'text'">

              <div class="tc-field-group">
                <label class="tc-label">Tekst</label>
                <div class="text-input-row">
                  <input
                    type="text"
                    v-model="activeOverlay.text"
                    placeholder="Wpisz tekst lub emoji…"
                    class="text-input"
                    ref="textInputRef"
                    @input="redrawPreviewOverlay"
                  />
                  <button class="emoji-toggle-btn" @click="toggleEmojiPicker" title="Wstaw emoji">😀</button>
                </div>
                <!-- Emoji picker panel -->
                <div v-if="showEmojiPicker" class="emoji-picker">
                  <div class="emoji-cats">
                    <button
                      v-for="cat in emojiCategories"
                      :key="cat.name"
                      class="emoji-cat-btn"
                      :class="{ active: activeCat === cat.name }"
                      @click="activeCat = cat.name"
                    >{{ cat.icon }}</button>
                  </div>
                  <div class="emoji-grid">
                    <button
                      v-for="em in currentEmojis"
                      :key="em"
                      class="emoji-btn"
                      @click="insertEmoji(em)"
                    >{{ em }}</button>
                  </div>
                </div>
              </div>

              <!-- ZMIANA 4: Styl & Czcionka - sekcja złożona z czcionki, rozmiaru i stylów -->
              <div class="tc-section-box">
                <div class="tc-section-title">Styl & Czcionka</div>

                <div class="tc-field-group">
                  <label class="tc-label">Czcionka</label>
                  <select class="tc-select" v-model="activeOverlay.fontFamily" @change="redrawPreviewOverlay">
                    <option value="Impact">Impact</option>
                    <option value="Arial">Arial</option>
                    <option value="Arial Black">Arial Black</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Trebuchet MS">Trebuchet MS</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                  </select>
                </div>

                <!-- ZMIANA 2: Powiększone przyciski +/- dla Rozmiar (px) na PC -->
                <div class="tc-field-group">
                  <label class="tc-label">Rozmiar (px)</label>
                  <div class="btn-row large-btns">
                    <button class="num-btn num-btn-lg" @click="activeOverlay.fontSize = Math.max(8, activeOverlay.fontSize - 5); redrawPreviewOverlay()">−</button>
                    <input type="number" v-model.number="activeOverlay.fontSize" min="8" max="500" class="tc-num-input" @change="redrawPreviewOverlay" />
                    <button class="num-btn num-btn-lg" @click="activeOverlay.fontSize = Math.min(500, activeOverlay.fontSize + 5); redrawPreviewOverlay()">+</button>
                  </div>
                </div>

                <div class="tc-field-group">
                  <label class="tc-label">Styl tekstu</label>
                  <div class="style-toggles">
                    <button class="style-btn" :class="{ active: activeOverlay.bold }" @click="activeOverlay.bold = !activeOverlay.bold; redrawPreviewOverlay()"><strong>B</strong></button>
                    <button class="style-btn" :class="{ active: activeOverlay.italic }" @click="activeOverlay.italic = !activeOverlay.italic; redrawPreviewOverlay()"><em>I</em></button>
                    <button class="style-btn" :class="{ active: activeOverlay.underline }" @click="activeOverlay.underline = !activeOverlay.underline; redrawPreviewOverlay()"><u>U</u></button>
                    <button class="style-btn" :class="{ active: activeOverlay.shadow }" @click="activeOverlay.shadow = !activeOverlay.shadow; redrawPreviewOverlay()">Cień</button>
                  </div>
                </div>
              </div>

              <div class="tc-field-row">
                <div class="tc-field-group">
                  <label class="tc-label">Kolor tekstu</label>
                  <div class="color-row">
                    <input type="color" v-model="activeOverlay.color" class="color-pick" @input="redrawPreviewOverlay" />
                    <span class="color-hex">{{ activeOverlay.color }}</span>
                  </div>
                </div>
                <div class="tc-field-group">
                  <label class="tc-label">Obrys / cień</label>
                  <div class="color-row">
                    <input type="color" v-model="activeOverlay.shadowColor" class="color-pick" @input="redrawPreviewOverlay" />
                    <span class="color-hex">{{ activeOverlay.shadowColor }}</span>
                  </div>
                </div>
                <!-- ZMIANA 2: Powiększone przyciski +/- dla Grub. obrysu na PC -->
                <div class="tc-field-group">
                  <label class="tc-label">Grub. obrysu</label>
                  <div class="btn-row large-btns">
                    <button class="num-btn num-btn-lg" @click="activeOverlay.strokeWidth = Math.max(0, activeOverlay.strokeWidth - 1); redrawPreviewOverlay()">−</button>
                    <input type="number" v-model.number="activeOverlay.strokeWidth" min="0" max="20" class="tc-num-input-sm" @change="redrawPreviewOverlay" />
                    <button class="num-btn num-btn-lg" @click="activeOverlay.strokeWidth = Math.min(20, activeOverlay.strokeWidth + 1); redrawPreviewOverlay()">+</button>
                  </div>
                </div>
              </div>

              <!-- ZMIANA 3: Przyciski +/- na krawędziach suwaka Obrót -->
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Obrót</label>
                  <span class="tc-value">{{ activeOverlay.rotation }}°</span>
                  <button class="reset-small-btn" @click="activeOverlay.rotation = 0; redrawPreviewOverlay()">Reset</button>
                </div>
                <div class="slider-with-btns">
                  <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.max(-180, activeOverlay.rotation - 1); redrawPreviewOverlay()">−</button>
                  <input type="range" v-model.number="activeOverlay.rotation" min="-180" max="180" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.min(180, activeOverlay.rotation + 1); redrawPreviewOverlay()">+</button>
                </div>
              </div>

              <!-- ZMIANA 3: Przyciski +/- na krawędziach suwaka Przezroczystość -->
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Przezroczystość</label>
                  <span class="tc-value">{{ Math.round(activeOverlay.opacity * 100) }}%</span>
                </div>
                <div class="slider-with-btns">
                  <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.max(0.1, +(activeOverlay.opacity - 0.05).toFixed(2)); redrawPreviewOverlay()">−</button>
                  <input type="range" v-model.number="activeOverlay.opacity" min="0.1" max="1" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.min(1, +(activeOverlay.opacity + 0.05).toFixed(2)); redrawPreviewOverlay()">+</button>
                </div>
              </div>

            </template>

            <!-- ======= KONTROLKI DLA OBRAZU ======= -->
            <template v-else-if="activeOverlay.type === 'image'">

              <!-- ZMIANA 1: Zmiana nazwy 'Obraz' na 'Wgraj obraz z dysku' -->
              <div class="tc-field-group">
                <label class="tc-label">Wgraj obraz z dysku</label>
                <div class="image-preview-box">
                  <img :src="activeOverlay.imageSrc" alt="" style="max-height:80px; max-width:100%;" />
                </div>
                <button class="change-img-btn" @click="openReplaceImagePicker">Zmień obraz</button>
              </div>

              <!-- ZMIANA 5: Suwak Skala z przyciskami +/- na krawędziach -->
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Skala</label>
                  <span class="tc-value">{{ activeOverlay.scale.toFixed(2) }}x</span>
                </div>
                <div class="slider-with-btns">
                  <button class="slider-edge-btn" @click="activeOverlay.scale = Math.max(0.1, +(activeOverlay.scale - 0.05).toFixed(2)); redrawPreviewOverlay()">−</button>
                  <input type="range" v-model.number="activeOverlay.scale" min="0.1" max="5" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="activeOverlay.scale = Math.min(5, +(activeOverlay.scale + 0.05).toFixed(2)); redrawPreviewOverlay()">+</button>
                </div>
              </div>

              <!-- ZMIANA 5: Suwak Obrót z przyciskami +/- na krawędziach -->
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Obrót</label>
                  <span class="tc-value">{{ activeOverlay.rotation }}°</span>
                </div>
                <div class="slider-with-btns">
                  <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.max(-180, activeOverlay.rotation - 1); redrawPreviewOverlay()">−</button>
                  <input type="range" v-model.number="activeOverlay.rotation" min="-180" max="180" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.min(180, activeOverlay.rotation + 1); redrawPreviewOverlay()">+</button>
                </div>
              </div>

              <!-- ZMIANA 5: Suwak Przezroczystość z przyciskami +/- na krawędziach -->
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Przezroczystość</label>
                  <span class="tc-value">{{ Math.round(activeOverlay.opacity * 100) }}%</span>
                </div>
                <div class="slider-with-btns">
                  <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.max(0.1, +(activeOverlay.opacity - 0.05).toFixed(2)); redrawPreviewOverlay()">−</button>
                  <input type="range" v-model.number="activeOverlay.opacity" min="0.1" max="1" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.min(1, +(activeOverlay.opacity + 0.05).toFixed(2)); redrawPreviewOverlay()">+</button>
                </div>
              </div>

            </template>
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
            <img
              ref="previewImg"
              :src="previewFrame"
              alt=""
              style="display:none"
              @load="onPreviewLoaded"
            />
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
const cropEnabled = ref(false);
const cropTop     = ref(0);
const cropBottom  = ref(0);
const cropLeft    = ref(0);
const cropRight   = ref(0);
const syncVertical   = ref(true);
const syncHorizontal = ref(true);

const editPanelOpen = ref(false);

const previewFrame         = ref(null);
const previewNaturalWidth  = ref(0);
const previewNaturalHeight = ref(0);
const isLoadingPreview     = ref(false);

const previewImg     = ref(null);
const unifiedCanvas  = ref(null);
const previewWrapper = ref(null);
const fileInput      = ref(null);
const imageFileInput = ref(null);

let ffmpeg = null;

// ---- TEXT EDITOR STATE ----
const textInputRef = ref(null);
const showEmojiPicker = ref(false);
const activeCat = ref('Popularne');

const emojiCategories = [
  { name: 'Popularne', icon: '⭐', emojis: ['😂','😍','🔥','❤️','👍','😭','🙏','😊','🤣','💀','😎','🤔','💯','🎉','👀','😅','🥺','😩','😤','🤩','😇','🥰','😆','😋','🤗','😏','😒','😞','😠','🤬','😱','😨','😰','😥','😓','🤯','😳','🥵','🥶','😴','🤤','🤮','🤧','🥸','🤡','🤠'] },
  { name: 'Gest', icon: '👋', emojis: ['👋','🤚','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🤲','🙏','✍️','💅','🤳','💪','🦾','🖕','👐','🫶','🫂'] },
  { name: 'Natura', icon: '🌿', emojis: ['🌸','🌺','🌻','🌹','🌷','🌼','🌵','🎋','🎍','🍀','🌿','☘️','🍃','🍂','🍁','🍄','🌾','🌱','🌲','🌳','🌴','🪴','🌊','🌈','⭐','🌟','✨','💫','❄️','🔥','💧','🌙','☀️','⛅','🌤️','🌦️','⛈️','🌪️','🌫️'] },
  { name: 'Jedzenie', icon: '🍕', emojis: ['🍕','🍔','🌮','🌯','🍜','🍣','🍱','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍦','🥤','☕','🧋','🍺','🥂','🍷','🥃','🫖','🍵','🧃','🥛','🍶','🍾','🍸','🍹','🧉','🥃','🍻','🍮','🍯','🧇','🥞','🧈','🥓','🥚'] },
  { name: 'Aktywność', icon: '⚽', emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🥅','⛳','🏹','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪃','🏋️','🤸','⛹️','🤺','🏇','🧘','🏊','🚴','🏄','🤽','🧗','🚵','🤼','🤾','🏌️','🏂'] },
  { name: 'Obiekty', icon: '💡', emojis: ['💡','📱','💻','🖥️','⌨️','🖱️','🖨️','📷','📸','🎥','📽️','🎬','📺','📻','📡','🔊','🎵','🎶','🎸','🎹','🥁','🎺','🎻','🪗','🎷','🎤','🎧','📝','✏️','🖊️','🖋️','✒️','📚','📖','🔍','🔎','🔬','🔭','💊','💉'] },
  { name: 'Symbole', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🕉️','✡️','🔯','🕎','☸️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑'] },
  { name: 'Flagi', icon: '🏳️', emojis: ['🏳️','🏴','🚩','🏁','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇵🇱','🇺🇸','🇬🇧','🇩🇪','🇫🇷','🇪🇸','🇮🇹','🇧🇷','🇯🇵','🇰🇷','🇨🇳','🇷🇺','🇮🇳','🇨🇦','🇦🇺','🇲🇽','🇸🇦','🇿🇦','🇳🇱','🇧🇪','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇨🇭','🇦🇹','🇵🇹','🇬🇷'] },
];

const currentEmojis = computed(() => {
  const cat = emojiCategories.find(c => c.name === activeCat.value);
  return cat ? cat.emojis : [];
});

function toggleEmojiPicker() {
  showEmojiPicker.value = !showEmojiPicker.value;
}

function insertEmoji(emoji) {
  if (!activeOverlay.value || activeOverlay.value.type !== 'text') return;
  activeOverlay.value.text += emoji;
  redrawPreviewOverlay();
}

// ---- UNIWERSALNE NAKŁADKI ----
const overlays = ref([createTextOverlay(0.5)]);
const activeOverlayIdx = ref(0);
const activeOverlay = computed(() => overlays.value[activeOverlayIdx.value] || null);

function createTextOverlay(yPct = 0.5) {
  return {
    type: 'text',
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

function createImageOverlay(yPct = 0.5) {
  return {
    type: 'image',
    imageSrc: null,
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    scale: 0.5,
    rotation: 0,
    opacity: 1,
    xPct: 0.5,
    yPct,
  };
}

function addTextOverlay() {
  if (overlays.value.length >= 10) return;
  const newYPct = Math.min(0.95, 0.2 + (overlays.value.length * 0.08));
  overlays.value.push(createTextOverlay(newYPct));
  activeOverlayIdx.value = overlays.value.length - 1;
  nextTick(redrawPreviewOverlay);
}

// ---- IMAGE OVERLAY: loaded-image cache ----
const imageElCache = new Map();

function getOrLoadImageEl(src, onLoaded) {
  if (!src) return null;
  const cached = imageElCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  if (cached) return null;
  const img = new Image();
  img.onload = () => { if (onLoaded) onLoaded(); };
  img.src = src;
  imageElCache.set(src, img);
  return null;
}

function preloadOverlayImages() {
  const pending = [];
  for (const item of overlays.value) {
    if (item.type !== 'image' || !item.imageSrc) continue;
    const cached = imageElCache.get(item.imageSrc);
    if (cached && cached.complete && cached.naturalWidth > 0) continue;
    pending.push(new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { imageElCache.set(item.imageSrc, img); resolve(); };
      img.onerror = () => resolve();
      img.src = item.imageSrc;
    }));
  }
  return Promise.all(pending);
}

function computeAutoOverlayScale(naturalWidth, naturalHeight) {
  const frameWidth = previewWrapper.value?.clientWidth || previewNaturalWidth.value || 400;
  const targetWidth = frameWidth * 0.35;
  const longestSide = Math.max(naturalWidth, naturalHeight) || 1;
  const scale = targetWidth / longestSide;
  return Math.min(3, Math.max(0.02, scale));
}

function addImageOverlay(file) {
  if (overlays.value.length >= 10) return;
  const imageSrc = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const newYPct = Math.min(0.95, 0.2 + (overlays.value.length * 0.08));
    imageElCache.set(imageSrc, img);
    overlays.value.push({
      type: 'image',
      imageSrc,
      imageNaturalWidth: img.naturalWidth,
      imageNaturalHeight: img.naturalHeight,
      scale: computeAutoOverlayScale(img.naturalWidth, img.naturalHeight),
      rotation: 0,
      opacity: 1,
      xPct: 0.5,
      yPct: newYPct,
    });
    activeOverlayIdx.value = overlays.value.length - 1;
    nextTick(redrawPreviewOverlay);
  };
  img.onerror = () => URL.revokeObjectURL(imageSrc);
  img.src = imageSrc;
}

function replaceActiveOverlayImage(file) {
  if (!activeOverlay.value || activeOverlay.value.type !== 'image') return;
  const imageSrc = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const target = activeOverlay.value;
    if (!target) { URL.revokeObjectURL(imageSrc); return; }
    const oldSrc = target.imageSrc;
    imageElCache.set(imageSrc, img);
    target.imageSrc = imageSrc;
    target.imageNaturalWidth = img.naturalWidth;
    target.imageNaturalHeight = img.naturalHeight;
    target.scale = computeAutoOverlayScale(img.naturalWidth, img.naturalHeight);
    if (oldSrc) { URL.revokeObjectURL(oldSrc); imageElCache.delete(oldSrc); }
    nextTick(redrawPreviewOverlay);
  };
  img.onerror = () => URL.revokeObjectURL(imageSrc);
  img.src = imageSrc;
}

function removeOverlay() {
  if (overlays.value.length > 1) {
    const removed = overlays.value.splice(activeOverlayIdx.value, 1)[0];
    if (removed.type === 'image' && removed.imageSrc) {
      URL.revokeObjectURL(removed.imageSrc);
      imageElCache.delete(removed.imageSrc);
    }
    activeOverlayIdx.value = Math.min(activeOverlayIdx.value, overlays.value.length - 1);
    nextTick(redrawPreviewOverlay);
  }
}

const imageUploadMode = ref('add');

function openAddImagePicker() {
  imageUploadMode.value = 'add';
  imageFileInput.value?.click();
}

function openReplaceImagePicker() {
  imageUploadMode.value = 'replace';
  imageFileInput.value?.click();
}

function handleImageFileUpload(event) {
  const file = event.target.files[0];
  if (!file) { event.target.value = ''; return; }
  if (imageUploadMode.value === 'replace') {
    replaceActiveOverlayImage(file);
  } else {
    addImageOverlay(file);
  }
  event.target.value = '';
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

function hitTestOverlay(clientX, clientY) {
  const c = unifiedCanvas.value;
  if (!c) return -1;
  const bounds = c.getBoundingClientRect();
  const px = (clientX - bounds.left) / bounds.width;
  const py = (clientY - bounds.top) / bounds.height;
  const cw = c.width;
  const ch = c.height;

  for (let i = overlays.value.length - 1; i >= 0; i--) {
    const item = overlays.value[i];
    if (item.type === 'text' && !item.text.trim()) continue;
    if (item.type === 'image' && !item.imageSrc) continue;

    const cx = item.xPct * cw;
    const cy = item.yPct * ch;
    const dx = (px * cw) - cx;
    const dy = (py * ch) - cy;

    if (item.type === 'text') {
      const estW = item.fontSize * item.text.length * 0.6 + 20;
      const estH = item.fontSize + 10;
      if (Math.abs(dx) < estW / 2 && Math.abs(dy) < estH / 2) return i;
    } else {
      const scaledW = item.imageNaturalWidth * item.scale;
      const scaledH = item.imageNaturalHeight * item.scale;
      if (Math.abs(dx) < scaledW / 2 && Math.abs(dy) < scaledH / 2) return i;
    }
  }
  return -1;
}

function onCanvasMouseDown(e) {
  const idx = hitTestOverlay(e.clientX, e.clientY);
  if (idx >= 0) {
    dragTextIdx = idx;
    activeOverlayIdx.value = idx;
    dragStartClientX = e.clientX;
    dragStartClientY = e.clientY;
    dragStartXPct = overlays.value[idx].xPct;
    dragStartYPct = overlays.value[idx].yPct;
  }
}

function onCanvasMouseMove(e) {
  if (dragTextIdx === null) return;
  const c = unifiedCanvas.value;
  if (!c) return;
  const bounds = c.getBoundingClientRect();
  const dx = (e.clientX - dragStartClientX) / bounds.width;
  const dy = (e.clientY - dragStartClientY) / bounds.height;
  overlays.value[dragTextIdx].xPct = Math.max(0, Math.min(1, dragStartXPct + dx));
  overlays.value[dragTextIdx].yPct = Math.max(0, Math.min(1, dragStartYPct + dy));
  redrawPreviewOverlay();
}

function onCanvasMouseUp() { dragTextIdx = null; }

function onCanvasTouchStart(e) {
  const touch = e.touches[0];
  const idx = hitTestOverlay(touch.clientX, touch.clientY);
  if (idx >= 0) {
    dragTextIdx = idx;
    activeOverlayIdx.value = idx;
    dragStartClientX = touch.clientX;
    dragStartClientY = touch.clientY;
    dragStartXPct = overlays.value[idx].xPct;
    dragStartYPct = overlays.value[idx].yPct;
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
  overlays.value[dragTextIdx].xPct = Math.max(0, Math.min(1, dragStartXPct + dx));
  overlays.value[dragTextIdx].yPct = Math.max(0, Math.min(1, dragStartYPct + dy));
  redrawPreviewOverlay();
}

function onCanvasTouchEnd() { dragTextIdx = null; }

// ---- UNIFIED CANVAS DRAW ----
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
  ctx.drawImage(img, 0, 0, dw, dh);

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

  for (let i = 0; i < overlays.value.length; i++) {
    const item = overlays.value[i];
    if (item.type === 'text' && !item.text.trim()) continue;
    if (item.type === 'image' && !item.imageSrc) continue;

    const tx = item.xPct * dw;
    const ty = item.yPct * dh;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.globalAlpha = item.opacity;

    if (item.type === 'text') {
      let fontStr = '';
      if (item.italic) fontStr += 'italic ';
      if (item.bold) fontStr += 'bold ';
      fontStr += `${item.fontSize}px "${item.fontFamily}"`;
      ctx.font = fontStr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (item.shadow) {
        ctx.shadowColor = item.shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      if (item.strokeWidth > 0) {
        ctx.strokeStyle = item.shadowColor;
        ctx.lineWidth = item.strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(item.text, 0, 0);
      }

      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      if (item.underline) {
        const metrics = ctx.measureText(item.text);
        const tw = metrics.width;
        const uy = item.fontSize * 0.1;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = Math.max(1, item.fontSize * 0.05);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(-tw/2, uy); ctx.lineTo(tw/2, uy); ctx.stroke();
      }

      if (i === activeOverlayIdx.value) {
        ctx.font = fontStr;
        const metrics2 = ctx.measureText(item.text);
        const selW = metrics2.width + 12;
        const selH = item.fontSize + 8;
        ctx.strokeStyle = 'rgba(255,255,100,0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(-selW/2, -selH/2, selW, selH);
        ctx.setLineDash([]);
      }
    } else if (item.type === 'image') {
      const imgEl = getOrLoadImageEl(item.imageSrc, redrawPreviewOverlay);
      if (imgEl) {
        const scaledW = item.imageNaturalWidth * item.scale;
        const scaledH = item.imageNaturalHeight * item.scale;
        ctx.drawImage(imgEl, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
        if (i === activeOverlayIdx.value) {
          ctx.strokeStyle = 'rgba(255,255,100,0.9)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(-scaledW/2, -scaledH/2, scaledW, scaledH);
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();
  }
}

function drawOverlaysOnCanvas(ctx, canvasWidth, canvasHeight) {
  for (const item of overlays.value) {
    if (item.type === 'text' && !item.text.trim()) continue;
    if (item.type === 'image' && !item.imageSrc) continue;

    const x = item.xPct * canvasWidth;
    const y = item.yPct * canvasHeight;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.globalAlpha = item.opacity;

    if (item.type === 'text') {
      let fontStr = '';
      if (item.italic) fontStr += 'italic ';
      if (item.bold) fontStr += 'bold ';
      fontStr += `${item.fontSize}px "${item.fontFamily}"`;
      ctx.font = fontStr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (item.shadow) {
        ctx.shadowColor = item.shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      if (item.strokeWidth > 0) {
        ctx.strokeStyle = item.shadowColor;
        ctx.lineWidth = item.strokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeText(item.text, 0, 0);
      }

      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      if (item.underline) {
        const metrics = ctx.measureText(item.text);
        const tw = metrics.width;
        const uy = item.fontSize * 0.1;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = Math.max(1, item.fontSize * 0.05);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(-tw/2, uy); ctx.lineTo(tw/2, uy); ctx.stroke();
      }
    } else if (item.type === 'image') {
      const imgEl = getOrLoadImageEl(item.imageSrc, null);
      if (imgEl) {
        const scaledW = item.imageNaturalWidth * item.scale;
        const scaledH = item.imageNaturalHeight * item.scale;
        ctx.drawImage(imgEl, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
      }
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
  overlays.value = [createTextOverlay(0.5)];
  activeOverlayIdx.value = 0;
  showEmojiPicker.value = false;
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
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function adjust(prop, delta) {
  if (prop === 'startTime') startTime.value = Math.max(0, startTime.value + delta);
  else if (prop === 'endTime') endTime.value = Math.max(0.5, endTime.value + delta);
  else if (prop === 'fps') fps.value = Math.max(1, Math.min(30, fps.value + delta));
  else if (prop === 'width') width.value = Math.max(100, Math.min(1280, width.value + delta));
}

function adjustCrop(prop, delta) {
  const val = ref(0);
  if (prop === 'cropTop') { cropTop.value = Math.max(0, cropTop.value + delta); if (syncVertical.value) cropBottom.value = cropTop.value; }
  else if (prop === 'cropBottom') { cropBottom.value = Math.max(0, cropBottom.value + delta); if (syncVertical.value) cropTop.value = cropBottom.value; }
  else if (prop === 'cropLeft') { cropLeft.value = Math.max(0, cropLeft.value + delta); if (syncHorizontal.value) cropRight.value = cropLeft.value; }
  else if (prop === 'cropRight') { cropRight.value = Math.max(0, cropRight.value + delta); if (syncHorizontal.value) cropLeft.value = cropRight.value; }
  redrawPreviewOverlay();
}

function resetCrop() {
  cropTop.value = 0; cropBottom.value = 0; cropLeft.value = 0; cropRight.value = 0;
  redrawPreviewOverlay();
}

function onPreviewLoaded() {
  const img = previewImg.value;
  if (!img) return;
  previewNaturalWidth.value = img.naturalWidth;
  previewNaturalHeight.value = img.naturalHeight;
  nextTick(redrawPreviewOverlay);
}

function clearPreview() {
  previewFrame.value = null;
  previewNaturalWidth.value = 0;
  previewNaturalHeight.value = 0;
}

async function loadPreviewFrame() {
  if (!cachedFileData.value && !videoUrl.value) return;
  isLoadingPreview.value = true;
  try {
    if (inputExt.value === 'webp' && cachedFileData.value) {
      previewFrame.value = URL.createObjectURL(new Blob([cachedFileData.value]));
    } else if (cachedFileData.value) {
      const blob = new Blob([cachedFileData.value], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const video = document.createElement('video');
      video.muted = true; video.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
        video.src = url;
      });
      video.currentTime = Math.min(startTime.value || 0, (video.duration || 1) * 0.5);
      await new Promise(r => video.onseeked = r);
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      previewFrame.value = c.toDataURL('image/png');
      URL.revokeObjectURL(url);
    }
  } catch(e) { error.value = 'Nie udało się załadować podglądu.'; }
  finally { isLoadingPreview.value = false; }
}

async function getVideoMetadata(fileData, ext) {
  const blob = new Blob([fileData], { type: `video/${ext}` });
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true; video.preload = 'metadata';
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = reject;
    video.src = url;
  });
  const meta = {
    width: video.videoWidth,
    height: video.videoHeight,
    duration: video.duration,
    fps: 30
  };
  URL.revokeObjectURL(url);
  return meta;
}

async function fetchAndSetDuration() {
  if (!videoUrl.value.trim()) return;
  isFetching.value = true; error.value = '';
  try {
    const response = await fetch(videoUrl.value);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);
    cachedFileData.value = fileData;
    cachedUrl.value = videoUrl.value;
    inputExt.value = 'mp4';
    const metadata = await getVideoMetadata(fileData, 'mp4');
    originalSize.value = blob.size; originalWidth.value = metadata.width; originalHeight.value = metadata.height;
    originalDuration.value = metadata.duration; originalFps.value = metadata.fps;
    if (metadata.duration) endTime.value = metadata.duration;
    if (useOriginalWidth.value && metadata.width) width.value = metadata.width;
  } catch(e) { error.value = `Błąd pobierania: ${e.message}`; }
  finally { isFetching.value = false; }
}

async function analyzeAndEstimate() {
  if (!cachedFileData.value) { error.value = 'Brak danych do analizy.'; return; }
  estimatedSize.value = Math.round(cachedFileData.value.length * 0.15);
  sizeConfidence.value = 0.7;
}

async function convert() {
  if (!videoUrl.value && !cachedFileData.value) { error.value = 'Brak źródła wideo.'; return; }
  isConverting.value = true; error.value = '';
  try {
    await preloadOverlayImages();
    
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }

    const inputName = `input.${inputExt.value}`;
    const outputName = `output.${outputFormat.value}`;
    
    if (cachedFileData.value) {
      await ffmpeg.writeFile(inputName, cachedFileData.value);
    } else {
      await ffmpeg.writeFile(inputName, await fetchFile(videoUrl.value));
    }

    const filters = [];
    if (cropTop.value || cropBottom.value || cropLeft.value || cropRight.value) {
      const cw = (originalWidth.value || previewNaturalWidth.value) - cropLeft.value - cropRight.value;
      const ch = (originalHeight.value || previewNaturalHeight.value) - cropTop.value - cropBottom.value;
      filters.push(`crop=${cw}:${ch}:${cropLeft.value}:${cropTop.value}`);
    }
    if (!useOriginalWidth.value && width.value) {
      const scaleH = -2;
      filters.push(`scale=${width.value}:${scaleH}`);
    }
    filters.push(`fps=${fps.value}`);

    const vf = filters.join(',');
    const args = ['-i', inputName, '-vf', vf, '-t', String(endTime.value - startTime.value), '-ss', String(startTime.value)];
    
    if (outputFormat.value === 'webp') {
      args.push('-loop', '0', '-lossless', '0', '-q:v', String(quality.value), outputName);
    } else {
      args.push('-vf', `${vf},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`, outputName);
    }

    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: outputFormat.value === 'webp' ? 'image/webp' : 'image/gif' });
    resultBlob.value = blob;
    resultUrl.value = URL.createObjectURL(blob);
    
    try { await ffmpeg.deleteFile(inputName); await ffmpeg.deleteFile(outputName); } catch(e) {}
  } catch(e) { error.value = `Błąd konwersji: ${e.message}`; }
  finally { isConverting.value = false; }
}

function downloadResult() {
  if (!resultUrl.value) return;
  const a = document.createElement('a');
  a.href = resultUrl.value;
  a.download = `wynik.${outputFormat.value}`;
  a.click();
}

// Watch dla podglądu
watch([cropTop, cropBottom, cropLeft, cropRight], () => {
  if (editPanelOpen.value) redrawPreviewOverlay();
});

onMounted(() => {
  // Inicjalizacja jeśli potrzebna
});
</script>

<style scoped>
/* ===== GŁÓWNY KONTENER ===== */
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e0;
  background: #1a1a2e;
  min-height: 100vh;
}

h1 {
  font-size: 1.4rem;
  margin-bottom: 4px;
  color: #fff;
}

.subtitle {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 16px;
}

/* ===== INPUT GROUP ===== */
.input-group {
  margin-bottom: 16px;
}
.input-group label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 6px;
  color: #ccc;
}
.input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.input-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #16213e;
  color: #fff;
  font-size: 0.9rem;
}
.fetch-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ===== PRZYCISKI ===== */
.clear-btn, .fetch-btn, .upload-btn, .convert-btn, .download-btn, .analyze-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
}
.clear-btn { background: #444; color: #fff; }
.fetch-btn { background: #0f3460; color: #fff; }
.upload-btn { background: #16213e; color: #e0e0e0; border: 1px solid #333; }
.convert-btn {
  width: 100%;
  padding: 14px;
  font-size: 1.1rem;
  background: linear-gradient(135deg, #e94560, #0f3460);
  color: #fff;
  margin: 16px 0;
}
.download-btn {
  background: #533483;
  color: #fff;
  padding: 12px 24px;
}
.analyze-btn {
  background: #0f3460;
  color: #fff;
  margin-top: 8px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== PARAMS GRID ===== */
.params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.param-field {
  background: #16213e;
  border: 1px solid #233;
  border-radius: 8px;
  padding: 12px;
}
.param-field label {
  display: block;
  font-size: 0.8rem;
  color: #aaa;
  margin-bottom: 6px;
}
.param-field input[type="number"] {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #fff;
  font-size: 0.9rem;
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.checkbox-label {
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
}
.btn-row {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  align-items: center;
}

/* ===== NUM-BTN (standardowy) ===== */
.num-btn {
  min-width: 28px;
  height: 28px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #233;
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.num-btn:hover:not(:disabled) {
  background: #0f3460;
}
.num-btn:active:not(:disabled) {
  transform: scale(0.92);
}

/* ===== ZMIANA 2: POWIĘKSZONE PRZYCISKI NA PC ===== */
.num-btn-lg {
  min-width: 28px;
  height: 28px;
  font-size: 0.9rem;
}

@media (min-width: 769px) {
  .num-btn-lg {
    min-width: 90px;
    height: 90px;
    font-size: 2.2rem;
    border-radius: 10px;
    border-width: 2px;
  }
  .large-btns {
    gap: 8px;
  }
  .large-btns .tc-num-input,
  .large-btns .tc-num-input-sm {
    height: 90px;
    font-size: 1.5rem;
    text-align: center;
  }
}

/* ===== QUALITY ===== */
.quality-field { grid-column: span 2; }
.quality-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.quality-value {
  font-weight: bold;
  color: #e94560;
  font-size: 1.1rem;
}
.quality-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}
.quality-controls input[type="range"] {
  flex: 1;
}

/* ===== SIZE ESTIMATE ===== */
.size-estimate .estimate-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.estimate-value {
  font-size: 1.3rem;
  font-weight: bold;
  color: #e94560;
}
.estimate-note { font-size: 0.75rem; color: #666; }
.estimate-confidence { font-size: 0.75rem; color: #533483; margin-top: 4px; }
.size-limit { grid-column: span 2; }
.limit-control {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
}
.limit-control input {
  width: 80px;
  padding: 6px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #fff;
}

/* ===== FORMAT SELECTOR ===== */
.format-selector {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.format-label { font-size: 0.9rem; color: #ccc; }
.format-options { display: flex; gap: 8px; }
.format-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: 2px solid #333;
  border-radius: 8px;
  background: #16213e;
  color: #aaa;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.2s;
}
.format-btn.active {
  border-color: #e94560;
  background: #0f3460;
  color: #fff;
}
.format-icon { font-size: 1.2rem; }

/* ===== METADATA ===== */
.original-meta {
  background: #16213e;
  border: 1px solid #233;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}
.original-meta h4 { margin: 0 0 8px; font-size: 0.9rem; }
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 4px;
  font-size: 0.8rem;
}
.meta-grid span { color: #666; }

/* ===== CROP / EDIT PANEL ===== */
.crop-section { margin: 16px 0; }
.crop-toggle-btn {
  width: 100%;
  padding: 12px;
  border: 2px solid #333;
  border-radius: 8px;
  background: #16213e;
  color: #ccc;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}
.crop-toggle-btn.active {
  border-color: #e94560;
  background: #0f3460;
  color: #fff;
}
.edit-panel {
  margin-top: 12px;
  background: #16213e;
  border: 1px solid #233;
  border-radius: 10px;
  padding: 16px;
}
.section-label {
  font-size: 1rem;
  font-weight: bold;
  color: #e94560;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #233;
}

/* ===== CROP CONTROLS ===== */
.crop-controls { margin-bottom: 20px; }
.sync-row { margin: 8px 0; }
.sync-row label { font-size: 0.8rem; }
.crop-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.crop-field label { font-size: 0.8rem; color: #aaa; }
.crop-field input[type="number"] {
  width: 100%;
  padding: 6px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  color: #fff;
  margin: 4px 0;
}
.crop-row-btns {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.reset-crop-btn {
  padding: 6px 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #233;
  color: #fff;
  cursor: pointer;
  font-size: 0.8rem;
}
.crop-summary { font-size: 0.8rem; color: #888; }
.crop-summary strong { color: #e94560; }

/* ===== TEXT EDITOR ===== */
.text-controls { margin-bottom: 16px; }

.textbox-tabs-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: flex-start;
}
.textbox-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  padding-bottom: 4px;
}
.tb-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a2e;
  color: #888;
  cursor: pointer;
  white-space: nowrap;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.tb-tab.active {
  border-color: #e94560;
  background: #0f3460;
  color: #fff;
}
.tb-tab-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #333;
  font-size: 0.7rem;
  font-weight: bold;
}
.tb-tab.active .tb-tab-num { background: #e94560; }
.tb-tab-preview {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== ZMIANA 1: TAB ACTION BTNS - etykiety zawsze widoczne ===== */
.textbox-tab-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.tab-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a2e;
  color: #ccc;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
  white-space: nowrap;
}
.tab-add { border-color: #533483; color: #a855f7; }
.tab-add:hover:not(:disabled) { background: #533483; color: #fff; }
.tab-add-img { border-color: #0f3460; color: #3b82f6; }
.tab-add-img:hover:not(:disabled) { background: #0f3460; color: #fff; }
.tab-remove:hover:not(:disabled) { background: #e94560; color: #fff; border-color: #e94560; }
.tab-action-icon { font-size: 1rem; }
/* Etykiety widoczne na PC i mobilnej */
.tab-action-label {
  display: inline;
  font-size: 0.8rem;
}

/* ===== TEXTBOX CONTROLS ===== */
.textbox-controls {
  background: #1a1a2e;
  border: 1px solid #233;
  border-radius: 8px;
  padding: 14px;
}
.tc-field-group { margin-bottom: 12px; }
.tc-field-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.tc-field-grow { flex: 1; min-width: 120px; }
.tc-label {
  display: block;
  font-size: 0.8rem;
  color: #aaa;
  margin-bottom: 4px;
}
.text-input-row {
  display: flex;
  gap: 6px;
}
.text-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #16213e;
  color: #fff;
  font-size: 0.9rem;
}
.emoji-toggle-btn {
  padding: 8px 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #233;
  cursor: pointer;
  font-size: 1.1rem;
}

/* ===== EMOJI PICKER ===== */
.emoji-picker {
  margin-top: 8px;
  background: #16213e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px;
  max-height: 250px;
  overflow-y: auto;
}
.emoji-cats {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.emoji-cat-btn {
  padding: 4px 8px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #1a1a2e;
  cursor: pointer;
  font-size: 1.1rem;
}
.emoji-cat-btn.active { border-color: #e94560; background: #0f3460; }
.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
  gap: 2px;
}
.emoji-btn {
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1.3rem;
  border-radius: 4px;
}
.emoji-btn:hover { background: #333; }

/* ===== ZMIANA 4: TC SECTION BOX (Styl & Czcionka) ===== */
.tc-section-box {
  background: #16213e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.tc-section-title {
  font-size: 0.9rem;
  font-weight: bold;
  color: #e94560;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #233;
}

/* ===== TC SELECT / INPUTS ===== */
.tc-select {
  width: 100%;
  padding: 8px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a2e;
  color: #fff;
  font-size: 0.9rem;
}
.tc-num-input {
  width: 70px;
  padding: 6px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #16213e;
  color: #fff;
  text-align: center;
  font-size: 0.9rem;
}
.tc-num-input-sm {
  width: 50px;
  padding: 6px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #16213e;
  color: #fff;
  text-align: center;
  font-size: 0.9rem;
}

/* ===== COLOR ===== */
.color-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.color-pick {
  width: 40px;
  height: 34px;
  border: 1px solid #333;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.color-hex {
  font-size: 0.8rem;
  color: #888;
  font-family: monospace;
}

/* ===== STYLE TOGGLES ===== */
.style-toggles {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.style-btn {
  min-width: 38px;
  height: 34px;
  padding: 4px 10px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #1a1a2e;
  color: #aaa;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.15s;
}
.style-btn.active {
  border-color: #e94560;
  background: #0f3460;
  color: #fff;
}

/* ===== TC LABEL ROW ===== */
.tc-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.tc-value {
  font-weight: bold;
  color: #e94560;
  font-size: 0.85rem;
}
.reset-small-btn {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid #333;
  border-radius: 4px;
  background: #233;
  color: #888;
  cursor: pointer;
  font-size: 0.75rem;
}

/* ===== ZMIANA 3 & 5: SLIDER WITH BTNS ===== */
.slider-with-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}
.slider-edge-btn {
  min-width: 36px;
  height: 36px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #233;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.slider-edge-btn:hover:not(:disabled) {
  background: #0f3460;
  border-color: #e94560;
}
.slider-edge-btn:active:not(:disabled) {
  transform: scale(0.9);
}
.slider-with-btns .tc-range {
  flex: 1;
}

/* ===== RANGE INPUT ===== */
.tc-range {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: #333;
  border-radius: 3px;
  outline: none;
}
.tc-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e94560;
  cursor: pointer;
  border: 2px solid #fff;
}
.tc-range::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e94560;
  cursor: pointer;
  border: 2px solid #fff;
}

/* ===== IMAGE PREVIEW ===== */
.image-preview-box {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px;
  text-align: center;
  margin-bottom: 8px;
}
.change-img-btn {
  padding: 8px 16px;
  border: 1px solid #0f3460;
  border-radius: 6px;
  background: #0f3460;
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.change-img-btn:hover { background: #1a4a80; }

/* ===== PREVIEW SECTION ===== */
.preview-section { margin-top: 16px; }
.preview-label {
  font-size: 0.8rem;
  color: #888;
  margin-bottom: 8px;
}
.preview-dims { color: #e94560; font-weight: bold; }
.unified-preview-wrapper {
  position: relative;
  border: 2px solid #333;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.unified-canvas {
  display: block;
  width: 100%;
  cursor: grab;
  touch-action: none;
}
.unified-canvas:active { cursor: grabbing; }
.preview-loading {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 0.9rem;
}

/* ===== LOADER ===== */
.loader-container {
  text-align: center;
  padding: 20px;
}
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #333;
  border-top-color: #e94560;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loader-text { color: #888; }

/* ===== ERROR ===== */
.error {
  background: #3d1010;
  border: 1px solid #e94560;
  color: #ff6b6b;
  padding: 12px;
  border-radius: 8px;
  margin: 12px 0;
  font-size: 0.9rem;
}

/* ===== RESULT ===== */
.result-area {
  background: #16213e;
  border: 1px solid #233;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  margin: 16px 0;
}
.result-area h3 { margin: 0 0 12px; color: #e94560; }
.result-area img {
  max-width: 100%;
  border-radius: 8px;
  margin-bottom: 12px;
}
.result-info { font-size: 0.85rem; color: #888; margin-bottom: 12px; }

/* ===== NOTE ===== */
.note {
  font-size: 0.75rem;
  color: #555;
  margin-top: 16px;
  line-height: 1.6;
}

/* ===== RANGE (quality) ===== */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: #333;
  border-radius: 3px;
  outline: none;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e94560;
  cursor: pointer;
  border: 2px solid #fff;
}
input[type="range"]::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e94560;
  cursor: pointer;
  border: 2px solid #fff;
}

/* ===== MOBILE ===== */
@media (max-width: 768px) {
  .container { padding: 10px; }
  h1 { font-size: 1.1rem; }
  .params-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  .param-field { padding: 8px; }
  .quality-field, .size-estimate, .size-limit { grid-column: span 2; }
  .crop-grid { grid-template-columns: 1fr; }
  .tc-field-row { flex-direction: column; }
  .format-btn { padding: 6px 14px; font-size: 0.85rem; }
  .tab-action-label { font-size: 0.75rem; }
  .slider-edge-btn { min-width: 32px; height: 32px; font-size: 1rem; }
}
</style>
