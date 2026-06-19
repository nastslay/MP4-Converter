<template>
  <div class="container">
    <button
      class="theme-toggle-btn"
      @click="toggleDarkMode"
      :title="isDarkMode ? 'Przełącz na jasny tryb' : 'Przełącz na ciemny tryb'"
      :aria-label="isDarkMode ? 'Przełącz na jasny tryb' : 'Przełącz na ciemny tryb'"
    >{{ isDarkMode ? '☀️' : '🌙' }}</button>
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

  <!-- TEXT EDITOR CONTROLS – teraz z nagłówkiem zwijanym -->
        <div class="text-controls">
          <div
            class="section-label clickable-section-label"
            @click="textPanelOpen = !textPanelOpen"
            role="button"
            tabindex="0"
            :aria-expanded="textPanelOpen"
          >
            ✏️ Tekst na obrazie
            <span class="toggle-arrow">{{ textPanelOpen ? '▼' : '▶' }}</span>
          </div>

          <template v-if="textPanelOpen">
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
              <div class="textbox-tab-actions">
                <button class="tab-action-btn tab-add" @click="addTextOverlay" :disabled="overlays.length >= 10" title="Dodaj tekst">
                  <span class="tab-action-icon">＋</span>
                  <span class="tab-action-label">Dodaj tekst</span>
                </button>
                <button class="tab-action-btn tab-add-img" @click="openAddImagePicker" :disabled="overlays.length >= 10" title="Wgraj obraz z dysku">
                  <span class="tab-action-icon">🖼️</span>
                  <span class="tab-action-label">Wgraj obraz z dysku</span>
                </button>
                <button class="tab-action-btn tab-remove" @click="removeOverlay" :disabled="overlays.length <= 1" title="Usuń aktywną nakładkę">🗑</button>
              </div>
            </div>


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
            <div class="textbox-tab-actions">
              <button class="tab-action-btn tab-add" @click="addTextOverlay" :disabled="overlays.length >= 10" title="Dodaj tekst">
                <span class="tab-action-icon">＋</span>
                <span class="tab-action-label">Dodaj tekst</span>
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
                    <!-- Emoji picker panel (dokładnie taki sam jak poprzednio) -->
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
              
                  <div class="tc-field-row style-font-row">
                    <div class="tc-field-group tc-field-grow">
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
                    <div class="tc-field-group fontsize-field">
                      <label class="tc-label">Rozmiar (px)</label>
                        <div class="btn-row">
                          <button class="num-btn wide-btn" @click="adjust('width', -10)" :disabled="isConverting || useOriginalWidth">−</button>
                          <input type="number" v-model.number="activeOverlay.fontSize" min="8" max="500" class="tc-num-input" @change="redrawPreviewOverlay" />
                          <button class="num-btn wide-btn" @click="adjust('width', 10)" :disabled="isConverting || useOriginalWidth">+</button>
                        </div>
                    </div>
                    <div class="tc-field-group style-field">
                      <label class="tc-label">Styl</label>
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
                    <div class="tc-field-group strokewidth-field">
                      <label class="tc-label">Grub. obrysu</label>
                      <div class="btn-row">
                        <button class="num-btn wide-btn" @click="activeOverlay.strokeWidth = Math.max(0, activeOverlay.strokeWidth - 1); redrawPreviewOverlay()">−</button>
                        <input type="number" v-model.number="activeOverlay.strokeWidth" min="0" max="20" class="tc-num-input-sm" @change="redrawPreviewOverlay" />
                        <button class="num-btn wide-btn" @click="activeOverlay.strokeWidth = Math.min(20, activeOverlay.strokeWidth + 1); redrawPreviewOverlay()">+</button>
                      </div>
                    </div>
                  </div>
              
                  <div class="tc-field-group">
                    <div class="tc-label-row">
                      <label class="tc-label">Obrót</label>
                      <span class="tc-value">{{ activeOverlay.rotation }}°</span>
                      <button class="reset-small-btn" @click="activeOverlay.rotation = 0; redrawPreviewOverlay()">Reset</button>
                    </div>
                    <div class="slider-edge-row">
                      <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.max(-180, activeOverlay.rotation - 1); redrawPreviewOverlay()" title="−1°">−</button>
                      <input type="range" v-model.number="activeOverlay.rotation" min="-180" max="180" step="1" class="tc-range" @input="redrawPreviewOverlay" />
                      <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.min(180, activeOverlay.rotation + 1); redrawPreviewOverlay()" title="+1°">+</button>
                    </div>
                  </div>
              
                  <div class="tc-field-group">
                    <div class="tc-label-row">
                      <label class="tc-label">Przezroczystość</label>
                      <span class="tc-value">{{ Math.round(activeOverlay.opacity * 100) }}%</span>
                    </div>
                    <div class="slider-edge-row">
                      <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.max(0.1, +(activeOverlay.opacity - 0.05).toFixed(2)); redrawPreviewOverlay()" title="−5%">−</button>
                      <input type="range" v-model.number="activeOverlay.opacity" min="0.1" max="1" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                      <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.min(1, +(activeOverlay.opacity + 0.05).toFixed(2)); redrawPreviewOverlay()" title="+5%">+</button>
                    </div>
                  </div>
              
                </template>
              
                <!-- ======= KONTROLKI DLA OBRAZU ======= -->
                <template v-else-if="activeOverlay.type === 'image'">
                  
                  <div class="tc-field-group">
                    <label class="tc-label">Wgraj obraz z dysku</label>
                    <div class="image-preview-box">
                      <img :src="activeOverlay.imageSrc" alt="" style="max-height:80px; max-width:100%;" />
                    </div>
                    <button class="change-img-btn" @click="openReplaceImagePicker">Zmień obraz</button>
                  </div>
              
                  <div class="tc-field-group">
                    <div class="tc-label-row">
                      <label class="tc-label">Skala</label>
                      <span class="tc-value">{{ activeOverlay.scale.toFixed(2) }}×</span>
                    </div>
                    <div class="slider-edge-row">
                      <button class="slider-edge-btn" @click="activeOverlay.scale = Math.max(0.1, +(activeOverlay.scale - 0.25).toFixed(2)); redrawPreviewOverlay()" title="−0.25">−</button>
                      <input type="range" v-model.number="activeOverlay.scale" min="0.1" max="5" step="0.25" class="tc-range" @input="redrawPreviewOverlay" />
                      <button class="slider-edge-btn" @click="activeOverlay.scale = Math.min(5, +(activeOverlay.scale + 0.25).toFixed(2)); redrawPreviewOverlay()" title="+0.25">+</button>
                    </div>
                  </div>
              
                  <div class="tc-field-group">
                    <div class="tc-label-row">
                      <label class="tc-label">Obrót</label>
                      <span class="tc-value">{{ activeOverlay.rotation }}°</span>
                      <button class="reset-small-btn" @click="activeOverlay.rotation = 0; redrawPreviewOverlay()">Reset</button>
                    </div>
                    <div class="slider-edge-row">
                      <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.max(-180, activeOverlay.rotation - 1); redrawPreviewOverlay()" title="−1°">−</button>
                      <input type="range" v-model.number="activeOverlay.rotation" min="-180" max="180" step="1" class="tc-range" @input="redrawPreviewOverlay" />
                      <button class="slider-edge-btn" @click="activeOverlay.rotation = Math.min(180, activeOverlay.rotation + 1); redrawPreviewOverlay()" title="+1°">+</button>
                    </div>
                  </div>
              
                  <div class="tc-field-group">
                    <div class="tc-label-row">
                      <label class="tc-label">Przezroczystość</label>
                      <span class="tc-value">{{ Math.round(activeOverlay.opacity * 100) }}%</span>
                    </div>
                    <div class="slider-edge-row">
                      <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.max(0.1, +(activeOverlay.opacity - 0.05).toFixed(2)); redrawPreviewOverlay()" title="−5%">−</button>
                      <input type="range" v-model.number="activeOverlay.opacity" min="0.1" max="1" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                      <button class="slider-edge-btn" @click="activeOverlay.opacity = Math.min(1, +(activeOverlay.opacity + 0.05).toFixed(2)); redrawPreviewOverlay()" title="+5%">+</button>
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
const textPanelOpen = ref(true);

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
const imageFileInput = ref(null);

let ffmpeg = null;

// ---- TEXT EDITOR STATE ----

const textInputRef = ref(null);

// Emoji picker state
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
// HTMLImageElements load asynchronously even from a blob URL, so a freshly
// created `new Image()` is never `.complete` synchronously right after
// setting `.src`. We cache the loaded element per imageSrc and re-trigger a
// redraw once it finishes loading, instead of silently skipping the draw.
const imageElCache = new Map(); // imageSrc -> HTMLImageElement (cached once loaded)

function getOrLoadImageEl(src, onLoaded) {
  if (!src) return null;
  const cached = imageElCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  if (cached) return null; // already loading, its onload will fire onLoaded
  const img = new Image();
  img.onload = () => { if (onLoaded) onLoaded(); };
  img.src = src;
  imageElCache.set(src, img);
  return null;
}

// Pre-loads every image overlay's element and waits for it, so export can
// draw them synchronously (no await needed inside the per-frame loop).
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

// Computes a sane default scale so a freshly added photo (which may be
// several thousand px wide) appears at a reasonable size in the preview
// instead of overflowing the whole frame.
function computeAutoOverlayScale(naturalWidth, naturalHeight) {
  const frameWidth = previewWrapper.value?.clientWidth || previewNaturalWidth.value || 400;
  const targetWidth = frameWidth * 0.35; // overlay starts at ~35% of frame width
  const longestSide = Math.max(naturalWidth, naturalHeight) || 1;
  const scale = targetWidth / longestSide;
  return Math.min(3, Math.max(0.02, scale));
}

function addImageOverlay(file) {
  if (overlays.value.length >= 10) return;
  const imageSrc = URL.createObjectURL(file); // real blob URL from the actual file bytes
  const img = new Image();
  img.onload = () => {
    const newYPct = Math.min(0.95, 0.2 + (overlays.value.length * 0.08));
    imageElCache.set(imageSrc, img); // already loaded — cache immediately
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

// Replaces the image of the currently active overlay (used by "Zmień obraz").
// Previously this also called addImageOverlay(), so "Zmień obraz" silently
// created a brand new overlay instead of changing the existing one.
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

// Tracks whether the file picker was opened to add a new image overlay
// ("Dodaj obrazek") or to replace the active one's image ("Zmień obraz").
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

function clientToCanvasPct(clientX, clientY) {
  const bounds = getCanvasBounds();
  if (!bounds) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
  };
}

// Hit-test: check if (clientX, clientY) hits any text label
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

function onCanvasMouseUp() {
  dragTextIdx = null;
}

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

    // Draw overlays
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
        const img = getOrLoadImageEl(item.imageSrc, redrawPreviewOverlay);
        if (img) {
          const scaledW = item.imageNaturalWidth * item.scale;
          const scaledH = item.imageNaturalHeight * item.scale;
          ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
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

// Draws text onto an output canvas frame (used during conversion)
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
      const img = getOrLoadImageEl(item.imageSrc, null);
      if (img) {
        const scaledW = item.imageNaturalWidth * item.scale;
        const scaledH = item.imageNaturalHeight * item.scale;
        ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
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

// ---- DARK MODE ----
const isDarkMode = ref(false);

function applyDarkModeClass() {
  document.documentElement.classList.toggle('dark-mode', isDarkMode.value);
}

function toggleDarkMode() {
  isDarkMode.value = !isDarkMode.value;
}

watch(isDarkMode, (val) => {
  applyDarkModeClass();
  try { localStorage.setItem('animconverter-theme', val ? 'dark' : 'light'); } catch (e) { /* ignore */ }
});

// ---- FFmpeg INIT ----
onMounted(async () => {
  try {
    const savedTheme = localStorage.getItem('animconverter-theme');
    if (savedTheme) {
      isDarkMode.value = savedTheme === 'dark';
    } else {
      isDarkMode.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  } catch (e) { /* ignore */ }
  applyDarkModeClass();

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
  // Previously this only checked for text overlays, so image-only overlays
  // were silently skipped entirely during export even though they showed
  // (or tried to show) in the live preview.
  const hasOverlays = overlays.value.some(item =>
    (item.type === 'text' && item.text.trim() !== '') ||
    (item.type === 'image' && !!item.imageSrc)
  );
  if (hasOverlays) await preloadOverlayImages();

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
      if (hasOverlays) drawOverlaysOnCanvas(ctx, outW, outH);
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
      if (hasOverlays) drawOverlaysOnCanvas(ctx, outW, outH);
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
    const hasOverlays = overlays.value.some(item =>
      (item.type === 'text' && item.text.trim() !== '') ||
      (item.type === 'image' && !!item.imageSrc)
    );

    if (inputExt.value === 'webp') {
      // WebP always goes through canvas path
      await convertViaCanvas(fileData, 'webp');
    } else if (hasCrop || hasOverlays) {
      // MP4 with crop, text, or image overlay — canvas path
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

watch(activeOverlayIdx, () => nextTick(redrawPreviewOverlay));

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
/* ===== ROOT CONTAINER / THEME TOGGLE ===== */
.container {
  position: relative;
}

.theme-toggle-btn {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 50%;
  border: none;
  background-color: #eef1f5;
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, transform 0.15s;
  touch-action: manipulation;
  z-index: 5;
}
.theme-toggle-btn:hover { background-color: #dde3ea; transform: scale(1.06); }
.theme-toggle-btn:active { transform: scale(0.94); }

/* ===== EDIT PANEL WRAPPER ===== */
.edit-panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.clickable-section-label {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.toggle-arrow {
  font-size: 0.8rem;
  color: #888;
}
  
.section-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: #213547;
  margin-bottom: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 2px solid #e0e0e0;
}

/* ===== CROP CONTROLS — inherits from global style.css ===== */
.crop-controls {
  margin-top: 0;
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

.crop-row-btns {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

/* Szersze przyciski +/− dla Rozmiar (px) i Grub. obrysu */
.wide-btn {
  min-width: 2.8rem;   /* lub padding: 0 0.8rem; */
  padding: 0 0.8rem;
}
  
/* ===== TEXT CONTROLS ===== */
.text-controls {
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

/* Tabs row */
.textbox-tabs-row {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.textbox-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  flex: 1;
}

.tb-tab {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #444;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  touch-action: manipulation;
}
.tb-tab:hover:not(:disabled) {
  background: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}
.tb-tab.active {
  background: #1da1f2;
  border-color: #1da1f2;
  color: white;
}
.tb-tab-num {
  font-size: 0.72rem;
  opacity: 0.75;
  font-weight: 700;
}
.tb-tab-preview {
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.textbox-tab-actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}

.tab-action-btn {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 6px;
  border: none;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  transition: background-color 0.15s;
}
.tab-add {
  width: auto;
  height: 2.2rem;
  padding: 0 0.65rem;
  gap: 0.35rem;
  background-color: #e8f5e9;
  color: #2e7d32;
  white-space: nowrap;
}
.tab-add:hover:not(:disabled) { background-color: #c8e6c9; }
.tab-add:disabled { background-color: #f5f5f5; color: #a0a0a0; cursor: not-allowed; }

.tab-remove {
  background-color: #fce4e4;
  color: #d32f2f;
}
.tab-remove:hover:not(:disabled) { background-color: #f8caca; }
.tab-remove:disabled { background-color: #f5f5f5; color: #a0a0a0; cursor: not-allowed; }

/* Controls box */
.textbox-controls {
  background: white;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

/* Field groups */
.tc-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tc-field-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.tc-field-grow {
  flex: 1;
  min-width: 120px;
}

.tc-label {
  display: block;
  font-weight: 600;
  font-size: 0.82rem;
  color: #213547;
  margin-bottom: 0;
}

.tc-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.1rem;
}

.tc-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1da1f2;
  min-width: 2.5rem;
  text-align: right;
}

/* Text input + emoji toggle */
.text-input-row {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.text-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  width: 100%;
}
.text-input:focus {
  outline: none;
  border-color: #1da1f2;
  box-shadow: 0 0 0 2px rgba(29,161,242,0.15);
}

.emoji-toggle-btn {
  flex-shrink: 0;
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, border-color 0.15s;
  touch-action: manipulation;
}
.emoji-toggle-btn:hover {
  background: #fff8e1;
  border-color: #ffc107;
}

/* Emoji picker */
.emoji-picker {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  margin-top: 0.25rem;
}

.emoji-cats {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid #eee;
}

.emoji-cat-btn {
  padding: 0.25rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background-color 0.12s;
  touch-action: manipulation;
}
.emoji-cat-btn:hover { background: #f0f0f0; }
.emoji-cat-btn.active {
  background: #e3f2fd;
  border-color: #1da1f2;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2rem, 1fr));
  gap: 0.15rem;
  max-height: 180px;
  overflow-y: auto;
}

.emoji-btn {
  padding: 0.25rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 1.3rem;
  cursor: pointer;
  text-align: center;
  line-height: 1;
  transition: background-color 0.1s;
  touch-action: manipulation;
}
.emoji-btn:hover { background: #f0f0f0; }

/* Select */
.tc-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.88rem;
  background: white;
  color: #213547;
}

/* Number inputs */
.tc-num-input {
  width: 68px;
  text-align: center;
  padding: 0.5rem 0.25rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  -moz-appearance: textfield;
  appearance: textfield;
}
.tc-num-input::-webkit-outer-spin-button,
.tc-num-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.tc-num-input-sm {
  width: 52px;
  text-align: center;
  padding: 0.5rem 0.25rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  -moz-appearance: textfield;
  appearance: textfield;
}
.tc-num-input-sm::-webkit-outer-spin-button,
.tc-num-input-sm::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

/* Color row */
.color-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.color-pick {
  width: 40px;
  height: 34px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
  background: white;
  flex-shrink: 0;
}

.color-hex {
  font-size: 0.78rem;
  color: #666;
  font-family: monospace;
}

/* Style toggles — B / I / U / Cień */
.style-toggles {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.style-btn {
  min-width: 2.4rem;
  height: 2.4rem;
  padding: 0 0.6rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  color: #444;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}
.style-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #bbb;
}
.style-btn.active {
  background: #1da1f2;
  border-color: #1da1f2;
  color: white;
}

/* Range slider */
.tc-range {
  width: 100%;
  accent-color: #1da1f2;
}

/* Slider with +/- buttons on its edges */
.slider-edge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.slider-edge-row .tc-range {
  flex: 1;
  width: auto;
}
.slider-edge-btn {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #f0f0f0;
  color: #333;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
  touch-action: manipulation;
  user-select: none;
}
.slider-edge-btn:hover:not(:disabled) { background: #e0e0e0; }
.slider-edge-btn:active:not(:disabled) { background: #c8c8c8; }

/* Styl & Czcionka — jeden wiersz na desktopie */
.style-font-row .style-field {
  flex-shrink: 0;
}
.style-font-row {
  flex-wrap: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0.2rem;
}
.style-font-row .tc-field-grow {
  min-width: 90px;
  flex: 1 1 110px;
}
.style-font-row .tc-select {
  min-width: 0;
  width: 100%;
}
.style-font-row .fontsize-field {
  flex-shrink: 0;
}

/* Reset small */
.reset-small-btn {
  padding: 0.2rem 0.55rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #f0f0f0;
  color: #555;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  transition: background-color 0.15s;
  touch-action: manipulation;
}
.reset-small-btn:hover { background: #e0e0e0; }

/* ===== UNIFIED PREVIEW ===== */
.preview-section { margin-top: 0.25rem; }

.unified-preview-wrapper {
  position: relative;
  width: 60%;
  margin: 0 auto;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #ddd;
  background: #111;
  line-height: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}

.unified-canvas {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
  touch-action: none;
}

.preview-label {
  font-weight: 600;
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
  color: #333;
}
.preview-dims { font-weight: 400; color: #888; font-size: 0.8rem; }
.preview-loading { text-align: center; padding: 0.5rem; font-size: 0.85rem; color: #666; }

/* ===== FORMAT SELECTOR ===== */
.format-selector {
  margin-bottom: 1.25rem;
  background: #f9f9f9;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  border: 1px solid #e0e0e0;
}
.format-label { display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; color: #213547; }
.format-options { display: flex; gap: 0.5rem; }
.format-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 0.6rem 1rem; border: 2px solid #ddd; border-radius: 8px;
  background: white; color: #444; font-weight: 600; font-size: 0.95rem;
  cursor: pointer; transition: all 0.2s; touch-action: manipulation;
}
.format-btn:hover:not(:disabled) { border-color: #adb5bd; background: #f0f0f0; }
.format-btn.active { border-color: #1da1f2; background: #e3f2fd; color: #0c63e4; }
.format-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.format-icon { font-size: 1.1rem; }

/* ===== META ===== */
.original-meta {
  margin-bottom: 1.25rem; background: #f9f9f9; border-radius: 10px;
  padding: 0.75rem 1rem; border: 1px solid #e0e0e0;
}
.original-meta h4 { margin: 0 0 0.5rem; font-size: 0.9rem; color: #213547; font-weight: 700; }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 1rem; font-size: 0.85rem; color: #555; }
.meta-grid div span { font-weight: 600; color: #213547; }

/* ===== RESPONSIVE ===== */
@media (max-width: 600px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
  .format-options {
    flex-direction: column;
  }
  .unified-preview-wrapper {
    width: 100%;
  }

  /* ===== TEKST NA OBRAZIE – MOBILE FIX ===== */

  /* Zakładki – pozwól im się przewijać, zamiast łamać */
  .textbox-tabs-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.2rem;
  }
  .textbox-tabs {
    flex-wrap: nowrap;   /* zapobiega łamaniu się przycisków w pionie */
  }

  /* Główne grupy pól – układ pionowy już był, ale wzmacniamy go */
  .tc-field-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  /* Każde pole w pionie zajmuje całą szerokość */
  .tc-field-group {
    width: 100%;
  }
  /* Rozwijane listy i pola tekstowe wypełniają dostępne miejsce */
  .tc-select,
  .text-input {
    width: 100%;
    max-width: 100%;
  }

  /* Rzędy z przyciskami +/- i inputem – zapobiegaj rozjeżdżaniu */
  .btn-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .tc-num-input,
  .tc-num-input-sm {
    min-width: 0;       /* pozwala się zmniejszyć */
    flex: 1;            /* dzielą dostępną przestrzeń */
    max-width: 100%;
  }
  .num-btn {
    flex-shrink: 0;     /* przyciski nie zmniejszają się */
  }

  /* Kolor i grubość obrysu – układ w poziomie z zawijaniem */
  .color-row {
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .color-hex {
    font-size: 0.75rem;
    word-break: break-all;
  }

  /* Kontrolki stylu (B, I, U, Cień) – bardziej zwarte */
  .style-toggles {
    gap: 0.3rem;
  }
  .style-btn {
    min-width: 2.2rem;
    height: 2.2rem;
    font-size: 0.9rem;
  }

  /* Picker emoji – mniejsze kafelki i przewijanie w pionie */
  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(1.8rem, 1fr));
    max-height: 140px;   /* nie zajmuje pół ekranu */
  }
  .emoji-btn {
    font-size: 1.2rem;
    padding: 0.2rem;
  }

  /* Suwaki i etykiety – zachowanie czytelności */
  .tc-label-row {
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .reset-small-btn {
    margin-left: 0;
  }
    .tab-add-img {
    font-size: 1rem;
    padding: 0 0.5rem;
  }
  .tab-add {
    font-size: 1rem;
    padding: 0 0.5rem;
  }
  .tab-action-label {
    font-size: 0.7rem;
  }
  .image-preview-box {
    min-height: 50px;
  }
  .slider-edge-btn {
    width: 2.3rem;
    height: 2.3rem;
    font-size: 1.25rem;
  }
}
  /* ===== PRZYCISK DODAWANIA OBRAZU ===== */
.tab-add-img {
  width: auto;
  height: 2.2rem;
  padding: 0 0.65rem;
  gap: 0.35rem;
  background-color: #e3f2fd;
  color: #1565c0;
  font-size: 1.2rem;
  white-space: nowrap;
}
.tab-add-img:hover:not(:disabled) { background-color: #bbdefb; }
.tab-add-img:disabled { background-color: #f5f5f5; color: #a0a0a0; cursor: not-allowed; }
.tab-action-icon {
  font-size: 1.1rem;
  line-height: 1;
}
.tab-action-label {
  font-size: 0.8rem;
  font-weight: 600;
}

/* ===== PODGLĄD OBRAZU W KONTROLKACH ===== */
.image-preview-box {
  background: #eee;
  border-radius: 6px;
  padding: 0.4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60px;
  margin-bottom: 0.3rem;
}
.change-img-btn {
  padding: 0.35rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s;
}
.change-img-btn:hover { background: #f0f0f0; }

/* ===================================================== */
/* ===== DARK MODE — panel edycji / nakładki / suwaki === */
/* ===================================================== */
.dark-mode .container {
  background-color: #181a1f;
  color: #e8e8e8;
}
.dark-mode .section-label { color: #e8e8e8; border-bottom-color: #3a3d44; }
.dark-mode .crop-controls,
.dark-mode .text-controls { background: #23262c; border-color: #3a3d44; }

.dark-mode .tb-tab { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .tb-tab:hover:not(:disabled) { background: #1f3a26; border-color: #4caf50; color: #8fd99f; }
.dark-mode .tb-tab.active { background: #1da1f2; border-color: #1da1f2; color: #fff; }

.dark-mode .tab-add { background-color: #1f3a26; color: #8fd99f; }
.dark-mode .tab-add:hover:not(:disabled) { background-color: #2a4a32; }
.dark-mode .tab-add:disabled { background-color: #2a2d34; color: #6a6d74; }

.dark-mode .tab-remove { background-color: #3a1f1f; color: #ff9a9a; }
.dark-mode .tab-remove:hover:not(:disabled) { background-color: #4a2828; }
.dark-mode .tab-remove:disabled { background-color: #2a2d34; color: #6a6d74; }

.dark-mode .tab-add-img { background-color: #16415e; color: #8fd0ff; }
.dark-mode .tab-add-img:hover:not(:disabled) { background-color: #1d567a; }
.dark-mode .tab-add-img:disabled { background-color: #2a2d34; color: #6a6d74; }

.dark-mode .textbox-controls { background: #1f2228; border-color: #3a3d44; }
.dark-mode .tc-label { color: #e8e8e8; }
.dark-mode .tc-value { color: #5ec1f7; }

.dark-mode .text-input,
.dark-mode .tc-select,
.dark-mode .tc-num-input,
.dark-mode .tc-num-input-sm {
  background: #2a2d34;
  border-color: #3a3d44;
  color: #e8e8e8;
}
.dark-mode .text-input:focus { border-color: #1da1f2; }

.dark-mode .emoji-toggle-btn { background: #2a2d34; border-color: #3a3d44; }
.dark-mode .emoji-toggle-btn:hover { background: #3a3422; border-color: #ffc107; }
.dark-mode .emoji-picker { background: #23262c; border-color: #3a3d44; }
.dark-mode .emoji-cats { border-bottom-color: #3a3d44; }
.dark-mode .emoji-cat-btn:hover { background: #3a3d44; }
.dark-mode .emoji-cat-btn.active { background: #16415e; border-color: #1da1f2; }
.dark-mode .emoji-btn:hover { background: #3a3d44; }

.dark-mode .color-pick { background: #2a2d34; border-color: #3a3d44; }
.dark-mode .color-hex { color: #aaa; }

.dark-mode .style-btn { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .style-btn:hover:not(:disabled) { background: #3a3d44; border-color: #555; }
.dark-mode .style-btn.active { background: #1da1f2; border-color: #1da1f2; color: #fff; }

.dark-mode .num-btn { background-color: #3a3d44; color: #e8e8e8; }
.dark-mode .num-btn:hover:not(:disabled) { background-color: #4a4d54; }
.dark-mode .num-btn:active:not(:disabled) { background-color: #5a5d64; }
.dark-mode .num-btn:disabled { background-color: #2a2d34; color: #6a6d74; }

.dark-mode .slider-edge-btn { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .slider-edge-btn:hover:not(:disabled) { background: #3a3d44; }
.dark-mode .slider-edge-btn:active:not(:disabled) { background: #4a4d54; }

.dark-mode .reset-small-btn { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .reset-small-btn:hover { background: #3a3d44; }

.dark-mode .unified-preview-wrapper { border-color: #3a3d44; }
.dark-mode .preview-label { color: #e8e8e8; }
.dark-mode .preview-dims,
.dark-mode .preview-loading { color: #999; }

.dark-mode .format-selector { background: #23262c; border-color: #3a3d44; }
.dark-mode .format-label { color: #e8e8e8; }
.dark-mode .format-btn { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .format-btn:hover:not(:disabled) { background: #3a3d44; border-color: #555; }
.dark-mode .format-btn.active { background: #16415e; border-color: #1da1f2; color: #8fd0ff; }

.dark-mode .original-meta { background: #23262c; border-color: #3a3d44; }
.dark-mode .original-meta h4 { color: #e8e8e8; }
.dark-mode .meta-grid { color: #b0b0b0; }
.dark-mode .meta-grid div span { color: #e8e8e8; }

.dark-mode .image-preview-box { background: #2a2d34; }
.dark-mode .change-img-btn { background: #2a2d34; border-color: #3a3d44; color: #e8e8e8; }
.dark-mode .change-img-btn:hover { background: #3a3d44; }

.dark-mode .theme-toggle-btn { background-color: #2a2d34; color: #ffd54f; }
.dark-mode .theme-toggle-btn:hover { background-color: #3a3d44; }

</style>

<style>
/* Globalny styl dla całego dokumentu w trybie ciemnym */
html.dark-mode,
html.dark-mode body,
html.dark-mode #app {
  background-color: #181a1f !important;
  color: #e8e8e8 !important;
}
</style>
