<template>
<div class="container">
  <button
    class="theme-toggle-btn"
    @click="toggleDarkMode"
    :title="isDarkMode ? 'Przełącz na jasny tryb' : 'Przełącz na ciemny tryb'"
    :aria-label="isDarkMode ? 'Przełącz na jasny tryb' : 'Przełącz na ciemny tryb'"
  >
    <span class="theme-icon">{{ isDarkMode ? '☀️' : '🌙' }}</span>
    <span class="theme-label">{{ isDarkMode ? 'Tryb Jasny' : 'Tryb Ciemny' }}</span>
  </button>
  <h1>🎬 MP4 / WebP → WebP / GIF</h1>
  <p class="subtitle">Wklej link do X.com, TikTok, MP4 lub wgraj plik MP4 / animowany WebP</p>

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
      <button class="analyze-btn" @click="analyzeAndEstimate()" :disabled="isConverting || !videoUrl || inputExt === 'webp'">
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
      <button class="format-btn" :class="{ active: outputFormat === 'mp4' }" @click="outputFormat = 'mp4'" :disabled="isConverting">
        <span class="format-icon">🎬</span><span>MP4</span>
      </button>
    </div>
  </div>

  <!-- Metadane źródła -->
  <div v-if="originalWidth" class="original-meta">
    <h4>📁 Informacje o źródle</h4>
    <div class="meta-grid">
      <div><span>Format:</span> {{ inputExt.toUpperCase() }}</div>
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
        <div
          class="section-label clickable-section-label"
          @click="cropPanelOpen = !cropPanelOpen"
          role="button"
          tabindex="0"
          :aria-expanded="cropPanelOpen"
        >
          ✂️ Kadrowanie
          <span class="toggle-arrow">{{ cropPanelOpen ? '▼ (zwiń)' : '▶ (rozwiń)' }}</span>
        </div>
        <template v-if="cropPanelOpen">
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
          <p class="crop-drag-hint">💡 Możesz przeciągać ramkę kadru bezpośrednio na podglądzie.</p>
        </template>
      </div>

      <!-- FLIP / TRANSFORM CONTROLS -->
      <div class="transform-controls">
        <div
          class="section-label clickable-section-label"
          @click="transformPanelOpen = !transformPanelOpen"
          role="button"
          tabindex="0"
          :aria-expanded="transformPanelOpen"
        >
          🪞 Przekształcenia
          <span class="toggle-arrow">{{ transformPanelOpen ? '▼ (zwiń)' : '▶ (rozwiń)' }}</span>
        </div>
        <template v-if="transformPanelOpen">
          <div class="transform-grid">
            <button class="transform-btn" :class="{ active: flipHorizontal }" @click="() => { flipHorizontal = !flipHorizontal; redrawPreviewOverlay() }" :disabled="isConverting">
              ↔️ Odbij poziomo
            </button>
            <button class="transform-btn" :class="{ active: flipVertical }" @click="() => { flipVertical = !flipVertical; redrawPreviewOverlay() }" :disabled="isConverting">
              ↕️ Odbij pionowo
            </button>
            <button class="transform-btn" :class="{ active: rotate90 !== 0 }" @click="() => { rotate90 = (rotate90 + 90) % 360; redrawPreviewOverlay() }" :disabled="isConverting">
              🔄 Obróć 90° ({{ rotate90 }}°)
            </button>
            <button class="transform-btn" @click="() => { flipHorizontal = false; flipVertical = false; rotate90 = 0; redrawPreviewOverlay() }" :disabled="isConverting">
              ♻️ Resetuj przekształcenia
            </button>
          </div>
        </template>
      </div>

      <!-- TEXT EDITOR CONTROLS -->
      <div class="text-controls">
        <div
          class="section-label clickable-section-label"
          @click="textPanelOpen = !textPanelOpen"
          role="button"
          tabindex="0"
          :aria-expanded="textPanelOpen"
        >
          ✏️ Tekst na obrazie
          <span class="toggle-arrow">{{ textPanelOpen ? '▼ (zwiń)' : '▶ (rozwiń)' }}</span>
        </div>
        <template v-if="textPanelOpen">
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
                    <button class="num-btn wide-btn" @click="() => { activeOverlay.fontSize = Math.max(8, activeOverlay.fontSize - 2); redrawPreviewOverlay() }">−</button>
                    <input type="number" v-model.number="activeOverlay.fontSize" min="8" max="500" class="tc-num-input" @change="redrawPreviewOverlay" />
                    <button class="num-btn wide-btn" @click="() => { activeOverlay.fontSize = Math.min(500, activeOverlay.fontSize + 2); redrawPreviewOverlay() }">+</button>
                  </div>
                </div>
                <div class="tc-field-group strokewidth-field">
                  <label class="tc-label">Grub. obrysu</label>
                  <div class="btn-row">
                    <button class="num-btn wide-btn" @click="() => { activeOverlay.strokeWidth = Math.max(0, activeOverlay.strokeWidth - 1); redrawPreviewOverlay() }">−</button>
                    <input type="number" v-model.number="activeOverlay.strokeWidth" min="0" max="20" class="tc-num-input-sm" @change="redrawPreviewOverlay" />
                    <button class="num-btn wide-btn" @click="() => { activeOverlay.strokeWidth = Math.min(20, activeOverlay.strokeWidth + 1); redrawPreviewOverlay() }">+</button>
                  </div>
                </div>
              </div>
              <div class="tc-field-row style-color-row">
                <div class="tc-field-group style-field">
                  <label class="tc-label">Styl</label>
                  <div class="style-toggles">
                    <button class="style-btn" :class="{ active: activeOverlay.bold }" @click="() => { activeOverlay.bold = !activeOverlay.bold; redrawPreviewOverlay() }"><strong>B</strong></button>
                    <button class="style-btn" :class="{ active: activeOverlay.italic }" @click="() => { activeOverlay.italic = !activeOverlay.italic; redrawPreviewOverlay() }"><em>I</em></button>
                    <button class="style-btn" :class="{ active: activeOverlay.underline }" @click="() => { activeOverlay.underline = !activeOverlay.underline; redrawPreviewOverlay() }"><u>U</u></button>
                    <button class="style-btn" :class="{ active: activeOverlay.shadow }" @click="() => { activeOverlay.shadow = !activeOverlay.shadow; redrawPreviewOverlay() }">Cień</button>
                  </div>
                </div>
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
              </div>
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Obrót</label>
                  <span class="tc-value">{{ activeOverlay.rotation }}°</span>
                  <button class="reset-small-btn" @click="() => { activeOverlay.rotation = 0; redrawPreviewOverlay() }">Reset</button>
                </div>
                <div class="slider-edge-row">
                  <button class="slider-edge-btn" @click="() => { activeOverlay.rotation = Math.max(-180, activeOverlay.rotation - 1); redrawPreviewOverlay() }" title="−1°">−</button>
                  <input type="range" v-model.number="activeOverlay.rotation" min="-180" max="180" step="1" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="() => { activeOverlay.rotation = Math.min(180, activeOverlay.rotation + 1); redrawPreviewOverlay() }" title="+1°">+</button>
                </div>
              </div>
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Przezroczystość</label>
                  <span class="tc-value">{{ Math.round(activeOverlay.opacity * 100) }}%</span>
                </div>
                <div class="slider-edge-row">
                  <button class="slider-edge-btn" @click="() => { activeOverlay.opacity = Math.max(0.1, +(activeOverlay.opacity - 0.05).toFixed(2)); redrawPreviewOverlay() }" title="−5%">−</button>
                  <input type="range" v-model.number="activeOverlay.opacity" min="0.1" max="1" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="() => { activeOverlay.opacity = Math.min(1, +(activeOverlay.opacity + 0.05).toFixed(2)); redrawPreviewOverlay() }" title="+5%">+</button>
                </div>
              </div>
            </template>
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
                  <button class="slider-edge-btn" @click="() => { activeOverlay.scale = Math.max(0.1, +(activeOverlay.scale - 0.25).toFixed(2)); redrawPreviewOverlay() }" title="−0.25">−</button>
                  <input type="range" v-model.number="activeOverlay.scale" min="0.1" max="5" step="0.25" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="() => { activeOverlay.scale = Math.min(5, +(activeOverlay.scale + 0.25).toFixed(2)); redrawPreviewOverlay() }" title="+0.25">+</button>
                </div>
              </div>
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Obrót</label>
                  <span class="tc-value">{{ activeOverlay.rotation }}°</span>
                  <button class="reset-small-btn" @click="() => { activeOverlay.rotation = 0; redrawPreviewOverlay() }">Reset</button>
                </div>
                <div class="slider-edge-row">
                  <button class="slider-edge-btn" @click="() => { activeOverlay.rotation = Math.max(-180, activeOverlay.rotation - 1); redrawPreviewOverlay() }" title="−1°">−</button>
                  <input type="range" v-model.number="activeOverlay.rotation" min="-180" max="180" step="1" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="() => { activeOverlay.rotation = Math.min(180, activeOverlay.rotation + 1); redrawPreviewOverlay() }" title="+1°">+</button>
                </div>
              </div>
              <div class="tc-field-group">
                <div class="tc-label-row">
                  <label class="tc-label">Przezroczystość</label>
                  <span class="tc-value">{{ Math.round(activeOverlay.opacity * 100) }}%</span>
                </div>
                <div class="slider-edge-row">
                  <button class="slider-edge-btn" @click="() => { activeOverlay.opacity = Math.max(0.1, +(activeOverlay.opacity - 0.05).toFixed(2)); redrawPreviewOverlay() }" title="−5%">−</button>
                  <input type="range" v-model.number="activeOverlay.opacity" min="0.1" max="1" step="0.05" class="tc-range" @input="redrawPreviewOverlay" />
                  <button class="slider-edge-btn" @click="() => { activeOverlay.opacity = Math.min(1, +(activeOverlay.opacity + 0.05).toFixed(2)); redrawPreviewOverlay() }" title="+5%">+</button>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <!-- UNIFIED PREVIEW CANVAS -->
      <div class="preview-section">
        <p class="preview-label" v-if="previewFrame">
          Podgląd — przeciągnij tekst/obrazek lub ramkę kadru palcem/myszą
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
            :class="{ 'crop-dragging': isCropDraggingActive }"
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

  <!-- ===== SCHOWEK - KLIPBOARD ===== -->
  <div class="clipboard-section">
    <button
      class="clipboard-toggle-btn"
      :class="{ active: clipboardOpen }"
      @click="clipboardOpen = !clipboardOpen"
    >
      📋 {{ clipboardOpen ? 'Zwiń schowek' : 'Rozwiń schowek' }}
    </button>

    <div v-if="clipboardOpen" class="clipboard-panel">
      <div class="clipboard-info">
        <p><strong>📌 Instrukcja:</strong> Schowek służy do tworzenia własnego tekstu, który zostanie skopiowany po kliknięciu "Skopiuj informacje". Użyj przycisków poniżej, aby wstawić dynamiczne parametry z konwersji.</p>
        <p><strong>💡 Przykład:</strong> <code>Po konwersji plik ma {conv_size} i {conv_fps} FPS</code> → <code>Po konwersji plik ma 2.45 MB i 20 FPS</code></p>
        <p><strong>💾 Zapisywanie:</strong> Twoja treść jest automatycznie zapisywana w przeglądarce i będzie dostępna przy następnej wizycie.</p>
      </div>

      <div class="clipboard-editor">
        <label class="clipboard-label">Twoja treść:</label>
        <textarea
          ref="clipboardTextarea"
          v-model="clipboardText"
          class="clipboard-textarea"
          placeholder="Wpisz tutaj swój tekst, używając przycisków poniżej do wstawiania parametrów..."
          @focus="saveSelection"
          @click="saveSelection"
          @keyup="saveSelection"
        ></textarea>
        <button class="clipboard-clear-btn" @click="clipboardText = ''" :disabled="!clipboardText">🗑 Wyczyść</button>
      </div>

      <div class="clipboard-insert-section">
        <label class="clipboard-label">Wstaw parametry:</label>
        
        <div class="insert-group">
          <div class="insert-group-label">📁 Źródło - pełne bloki:</div>
          <div class="insert-buttons">
            <button class="insert-btn" @click="insertToken('src_full')" title="Wstaw wszystkie informacje o źródle">Wszystko o źródle</button>
          </div>
        </div>

        <div class="insert-group">
          <div class="insert-group-label">📁 Źródło - pojedyncze:</div>
          <div class="insert-buttons">
            <button class="insert-btn" @click="insertToken('src_format')">Format</button>
            <button class="insert-btn" @click="insertToken('src_size')">Rozmiar</button>
            <button class="insert-btn" @click="insertToken('src_dimensions')">Wymiary</button>
            <button class="insert-btn" @click="insertToken('src_fps')">FPS</button>
            <button class="insert-btn" @click="insertToken('src_duration')">Czas trwania</button>
            <button class="insert-btn" @click="insertToken('src_link')">Link do źródła</button>
          </div>
        </div>

        <div class="insert-group">
          <div class="insert-group-label">🎞️ Konwersja - pełne bloki:</div>
          <div class="insert-buttons">
            <button class="insert-btn" @click="insertToken('conv_full')" title="Wstaw wszystkie informacje o konwersji">Wszystko o konwersji</button>
            <button class="insert-btn" @click="insertToken('conv_comparison')" title="Wstaw porównanie procentowe parametrów">% porównanie parametrów</button>
          </div>
        </div>

        <div class="insert-group">
          <div class="insert-group-label">🎞️ Konwersja - pojedyncze:</div>
          <div class="insert-buttons">
            <button class="insert-btn" @click="insertToken('conv_format')">Format</button>
            <button class="insert-btn" @click="insertToken('conv_size')">Rozmiar</button>
            <button class="insert-btn" @click="insertToken('conv_dimensions')">Wymiary</button>
            <button class="insert-btn" @click="insertToken('conv_fps')">FPS</button>
            <button class="insert-btn" @click="insertToken('conv_duration')">Czas trwania</button>
            <button class="insert-btn" @click="insertToken('conv_compression')">% Kompresji</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="isConverting" class="loader-container">
    <div class="spinner"></div>
    <p class="loader-text">{{ conversionStage || 'Trwa przetwarzanie...' }}</p>
  </div>
  <div v-if="error" class="error">{{ error }}</div>

  <!-- ===== WYNIK KONWERSJI ===== -->
  <div v-if="resultUrl" class="result-area">
    <h3>Wynik:</h3>
    <video v-if="outputFormat === 'mp4'" :src="resultUrl" controls playsinline></video>
    <img v-else :src="resultUrl" :alt="'Wynikowy ' + outputFormat.toUpperCase()" />
    <div class="result-meta-row">
      <div class="result-meta-box">
        <h4>📁 Źródło</h4>
        <div class="meta-grid">
          <div><span>Format:</span> {{ inputExt.toUpperCase() }}</div>
          <div><span>Rozmiar:</span> {{ formatFileSize(originalSize) }}</div>
          <div><span>Wymiary:</span> {{ originalWidth }}×{{ originalHeight }} px</div>
          <div><span>FPS:</span> {{ originalFps }}</div>
          <div><span>Czas trwania:</span> {{ originalDuration?.toFixed(2) }} s</div>
          <div><span>% Kompresji:</span> 0%</div>
        </div>
      </div>
      <div class="result-meta-box">
        <h4>🎞️ Konwersja</h4>
        <div class="meta-grid">
          <div><span>Format:</span> {{ outputFormat.toUpperCase() }}</div>
          <div><span>Rozmiar:</span> {{ formatFileSize(resultBlob?.size || 0) }}</div>
          <div><span>Wymiary:</span> {{ resultWidth }}×{{ resultHeight }} px</div>
          <div><span>FPS:</span> {{ fps }}</div>
          <div><span>Czas trwania:</span> {{ resultDuration?.toFixed(2) }} s</div>
          <div><span>% Kompresji:</span> {{ 100 - quality }}%</div>
        </div>
      </div>
    </div>
    <div class="result-actions">
      <button class="download-btn" @click="downloadResult">⬇ Pobierz {{ outputFormat.toUpperCase() }}</button>
      <button class="copy-info-btn" @click="copyClipboard">{{ infoCopied ? '✅ Skopiowano!' : '📋 Skopiuj informacje' }}</button>
    </div>
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
// Jedno źródło domyślnych parametrów — używane także po pobraniu nowego pliku.
const DEFAULT_FPS = 15;
const DEFAULT_WIDTH = 310;
const DEFAULT_QUALITY = 50;
const fps        = ref(DEFAULT_FPS);
const width      = ref(DEFAULT_WIDTH);
const quality    = ref(DEFAULT_QUALITY);
const useOriginalWidth = ref(false);
const outputFormat = ref('webp');
const limitSizeEnabled = ref(false);
const targetSizeMB     = ref(10);
const isConverting    = ref(false);
const conversionStage = ref('');
const isFetching      = ref(false);
const error           = ref('');
const resultUrl       = ref(null);
const resultBlob      = ref(null);
const estimatedSize  = ref(null);
const sizeConfidence = ref(null);
const sizeEstimationCorrection = ref(1.0);
const cachedFileData = ref(null);
const cachedUrl      = ref('');
const inputExt = ref('mp4');
const originalSize     = ref(null);
const originalWidth    = ref(null);
const originalHeight   = ref(null);
const originalFps      = ref(null);
const originalDuration = ref(null);

// Wynik konwersji – metadane
const resultWidth    = ref(0);
const resultHeight   = ref(0);
const resultDuration = ref(0);

// Crop
const cropEnabled = ref(false);
const cropTop     = ref(0);
const cropBottom  = ref(0);
const cropLeft    = ref(0);
const cropRight   = ref(0);
const syncVertical   = ref(true);
const syncHorizontal = ref(true);

// Flip / Transform
const flipHorizontal = ref(false);
const flipVertical   = ref(false);
const rotate90       = ref(0);

// Panel open states
const editPanelOpen     = ref(false);
const textPanelOpen     = ref(false);
const cropPanelOpen     = ref(true);
const transformPanelOpen = ref(false);

// Podgląd klatki
const previewFrame         = ref(null);
const previewNaturalWidth  = ref(0);
const previewNaturalHeight = ref(0);
const isLoadingPreview     = ref(false);

// Crop dragging state
const isCropDraggingActive = ref(false);
let cropDragStartX = 0;
let cropDragStartY = 0;
let cropDragStartLeft = 0;
let cropDragStartTop = 0;
let cropDragStartRight = 0;
let cropDragStartBottom = 0;
let suppressCropSync = false;

// Template refs
const previewImg     = ref(null);
const unifiedCanvas  = ref(null);
const previewWrapper = ref(null);
const fileInput      = ref(null);
const imageFileInput = ref(null);

let ffmpeg = null;

// ---- SCHOWEK / CLIPBOARD ----
const clipboardOpen = ref(false);
const clipboardText = ref('');
const clipboardTextarea = ref(null);
const infoCopied = ref(false);
let textareaSelection = { start: 0, end: 0 };

function saveSelection() {
  if (clipboardTextarea.value) {
    textareaSelection.start = clipboardTextarea.value.selectionStart;
    textareaSelection.end = clipboardTextarea.value.selectionEnd;
  }
}

function insertToken(token) {
  const tokenStr = `{${token}}`;
  const start = textareaSelection.start;
  const end = textareaSelection.end;
  
  clipboardText.value = 
    clipboardText.value.slice(0, start) + 
    tokenStr + 
    clipboardText.value.slice(end);
  
  nextTick(() => {
    if (clipboardTextarea.value) {
      const newCursorPos = start + tokenStr.length;
      clipboardTextarea.value.selectionStart = newCursorPos;
      clipboardTextarea.value.selectionEnd = newCursorPos;
      clipboardTextarea.value.focus();
      textareaSelection.start = newCursorPos;
      textareaSelection.end = newCursorPos;
    }
  });
}

function generateComparisonText() {
  const srcSize = originalSize.value || 0;
  const convSize = resultBlob.value?.size || 0;
  const srcW = originalWidth.value || 0;
  const srcH = originalHeight.value || 0;
  const convW = resultWidth.value || 0;
  const convH = resultHeight.value || 0;
  const srcFpsVal = originalFps.value || 0;
  const convFpsVal = fps.value || 0;
  const srcDur = originalDuration.value || 0;
  const convDur = resultDuration.value || 0;

  // Rozmiar
  let sizeText = '';
  if (srcSize > 0 && convSize > 0) {
    const sizeDiffPct = Math.round(((convSize - srcSize) / srcSize) * 100);
    if (sizeDiffPct > 0) {
      sizeText = `${sizeDiffPct}% większy`;
    } else if (sizeDiffPct < 0) {
      sizeText = `${Math.abs(sizeDiffPct)}% mniejszy`;
    } else {
      sizeText = 'taki sam rozmiar';
    }
  } else {
    sizeText = '—';
  }

  // Wymiary (piksele)
  let dimText = '';
  const srcPixels = srcW * srcH;
  const convPixels = convW * convH;
  if (srcPixels > 0 && convPixels > 0) {
    const dimDiffPct = Math.round(((convPixels - srcPixels) / srcPixels) * 100);
    if (dimDiffPct > 0) {
      dimText = `${dimDiffPct}% większe`;
    } else if (dimDiffPct < 0) {
      dimText = `${Math.abs(dimDiffPct)}% mniejsze`;
    } else {
      dimText = 'takie same';
    }
  } else {
    dimText = '—';
  }

  // FPS
  let fpsText = '';
  if (srcFpsVal > 0 && convFpsVal > 0) {
    const fpsDiffPct = Math.round(((convFpsVal - srcFpsVal) / srcFpsVal) * 100);
    if (fpsDiffPct > 0) {
      fpsText = `${fpsDiffPct}% więcej`;
    } else if (fpsDiffPct < 0) {
      fpsText = `${Math.abs(fpsDiffPct)}% mniej`;
    } else {
      fpsText = 'tyle samo';
    }
  } else {
    fpsText = '—';
  }

  // Czas trwania
  let durText = '';
  if (srcDur > 0 && convDur > 0) {
    const durDiff = convDur - srcDur;
    if (Math.abs(durDiff) < 0.01) {
      durText = 'taki sam czas';
    } else if (durDiff > 0) {
      durText = `${durDiff.toFixed(2)} s dłużej`;
    } else {
      durText = `${Math.abs(durDiff).toFixed(2)} s krócej`;
    }
  } else {
    durText = '—';
  }

  const lines = [
    `!Format: ${outputFormat.value.toUpperCase()}`,
    `!Rozmiar: ${formatFileSize(convSize)} (${sizeText})`,
    `!Wymiary: ${convW}×${convH} px (${dimText})`,
    `!FPS: ${convFpsVal} (${fpsText})`,
    `!Czas trwania: ${convDur.toFixed(2)} s (${durText})`,
    `!% Kompresji: ${100 - quality.value}%`,
  ];
  return lines.join('\n');
}

function replaceTokens(text) {
  const replacements = {
    '{src_full}': `!Format: ${inputExt.value.toUpperCase()}\n!Rozmiar: ${formatFileSize(originalSize.value)}\n!Wymiary: ${originalWidth.value}×${originalHeight.value} px\n!FPS: ${originalFps.value}\n!Czas trwania: ${originalDuration.value?.toFixed(2)} s\n!% Kompresji: 0%`,
    '{conv_full}': `!Format: ${outputFormat.value.toUpperCase()}\n!Rozmiar: ${formatFileSize(resultBlob.value?.size || 0)}\n!Wymiary: ${resultWidth.value}×${resultHeight.value} px\n!FPS: ${fps.value}\n!Czas trwania: ${resultDuration.value?.toFixed(2)} s\n!% Kompresji: ${100 - quality.value}%`,
    '{conv_comparison}': generateComparisonText(),
    '{src_format}': inputExt.value.toUpperCase(),
    '{src_size}': formatFileSize(originalSize.value),
    '{src_dimensions}': `${originalWidth.value}×${originalHeight.value} px`,
    '{src_fps}': `${originalFps.value}`,
    '{src_duration}': `${originalDuration.value?.toFixed(2)} s`,
    '{src_link}': `[Link do źródła](${videoUrl.value.trim()})`,
    '{conv_format}': outputFormat.value.toUpperCase(),
    '{conv_size}': formatFileSize(resultBlob.value?.size || 0),
    '{conv_dimensions}': `${resultWidth.value}×${resultHeight.value} px`,
    '{conv_fps}': `${fps.value}`,
    '{conv_duration}': `${resultDuration.value?.toFixed(2)} s`,
    '{conv_compression}': `${100 - quality.value}%`,
  };

  let result = text;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.replaceAll(token, value || '');
  }
  return result;
}

async function copyClipboard() {
  if (!clipboardText.value.trim()) {
    error.value = 'Schowek jest pusty. Dodaj treść przed skopiowaniem.';
    return;
  }

  const processedText = replaceTokens(clipboardText.value);
  
  try {
    await navigator.clipboard.writeText(processedText);
  } catch (e) {
    // Fallback dla przeglądarek/kontekstów bez dostępu do Clipboard API
    const ta = document.createElement('textarea');
    ta.value = processedText;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  
  infoCopied.value = true;
  setTimeout(() => { infoCopied.value = false; }, 2000);
}

// ---- TEXT EDITOR STATE ----
const textInputRef = ref(null);
const showEmojiPicker = ref(false);
const activeCat = ref('Popularne');

const emojiCategories = [
  { name: 'Popularne', icon: '⭐', emojis: ['😂','😍','🔥','❤️','👍','😭','🙏','😊','🤣','💀','😎','🤔','💯','🎉','👀','😅','🥺','😩','😤','🤩','😇','🥰','😆','😋','🤗','😏','😒','😞','😠','🤬','😱','😨','😰','😥','😓','🤯','😳','🥵','🥶','😴','🤤','🤮','🤧','🥸','🤡','🤠'] },
  { name: 'Gest', icon: '👋', emojis: ['👋','🤚','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🤲','🙏','✍️','💅','🤳','💪','🦾','🖕','👐','🫶','🫂'] },
  { name: 'Natura', icon: '🌿', emojis: ['🌸','🌺','🌻','🌹','🌷','🌼','🌵','🎋','🎍','🍀','🌿','☘️','🍃','🍂','🍁','🍄','🌾','🌱','🌲','🌳','🌴','🪴','🌊','🌈','⭐','🌟','✨','💫','❄️','🔥','💧','🌙','☀️','⛅','🌤️','🌦️','⛈️','🌪️','🌫️'] },
  { name: 'Jedzenie', icon: '🍕', emojis: ['🍕','🍔','🌮','🌯','🍜','🍣','🍱','🍩','🍪','🎂','🍰','🍫','🍬','🍭','🍦','🥤','☕','🧋','🍺','🥂','🍷','🥃','🫖','🍵','🧃','🥛','🍶','🍾','🍸','🍹','🧉','🥃','🍻','🍮','🍯','🥞','🧈','🥓','🥚'] },
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

function addTextOverlay() {
  if (overlays.value.length >= 10) return;
  const newYPct = Math.min(0.95, 0.2 + (overlays.value.length * 0.08));
  overlays.value.push(createTextOverlay(newYPct));
  activeOverlayIdx.value = overlays.value.length - 1;
  nextTick(redrawPreviewOverlay);
}

// ---- IMAGE OVERLAY ----
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
  return Math.min(3, Math.max(0.02, targetWidth / longestSide));
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

// ---- DRAG STATE (overlays + crop) ----
let dragTextIdx = null;
let dragStartClientX = 0;
let dragStartClientY = 0;
let dragStartXPct = 0;
let dragStartYPct = 0;

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

function hitTestCrop(clientX, clientY) {
  const c = unifiedCanvas.value;
  const img = previewImg.value;
  if (!c || !img || !img.complete) return false;
  const hasCrop = (cropTop.value || cropBottom.value || cropLeft.value || cropRight.value);
  if (!hasCrop) return false;

  const bounds = c.getBoundingClientRect();
  const px = clientX - bounds.left;
  const py = clientY - bounds.top;

  const scaleX = c.width / img.naturalWidth;
  const scaleY = c.height / img.naturalHeight;
  const x = cropLeft.value * scaleX;
  const y = cropTop.value * scaleY;
  const w = c.width - (cropLeft.value + cropRight.value) * scaleX;
  const h = c.height - (cropTop.value + cropBottom.value) * scaleY;

  return px >= x && px <= x + w && py >= y && py <= y + h;
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
    return;
  }
  // Check crop drag
  if (hitTestCrop(e.clientX, e.clientY)) {
    isCropDraggingActive.value = true;
    cropDragStartX = e.clientX;
    cropDragStartY = e.clientY;
    cropDragStartLeft = cropLeft.value;
    cropDragStartTop = cropTop.value;
    cropDragStartRight = cropRight.value;
    cropDragStartBottom = cropBottom.value;
  }
}

function onCanvasMouseMove(e) {
  if (dragTextIdx !== null) {
    const c = unifiedCanvas.value;
    if (!c) return;
    const bounds = c.getBoundingClientRect();
    const dx = (e.clientX - dragStartClientX) / bounds.width;
    const dy = (e.clientY - dragStartClientY) / bounds.height;
    overlays.value[dragTextIdx].xPct = Math.max(0, Math.min(1, dragStartXPct + dx));
    overlays.value[dragTextIdx].yPct = Math.max(0, Math.min(1, dragStartYPct + dy));
    redrawPreviewOverlay();
    return;
  }
  if (isCropDraggingActive.value) {
    const c = unifiedCanvas.value;
    const img = previewImg.value;
    if (!c || !img) return;
    const bounds = c.getBoundingClientRect();
    const scaleX = img.naturalWidth / bounds.width;
    const scaleY = img.naturalHeight / bounds.height;
    const dxNative = (e.clientX - cropDragStartX) * scaleX;
    const dyNative = (e.clientY - cropDragStartY) * scaleY;

    const maxDx = cropDragStartRight;
    const minDx = -cropDragStartLeft;
    const maxDy = cropDragStartBottom;
    const minDy = -cropDragStartTop;

    const clampedDx = Math.max(minDx, Math.min(maxDx, dxNative));
    const clampedDy = Math.max(minDy, Math.min(maxDy, dyNative));

    suppressCropSync = true;
    cropLeft.value = Math.round(cropDragStartLeft + clampedDx);
    cropTop.value = Math.round(cropDragStartTop + clampedDy);
    cropRight.value = Math.round(cropDragStartRight - clampedDx);
    cropBottom.value = Math.round(cropDragStartBottom - clampedDy);
    suppressCropSync = false;
    nextTick(redrawPreviewOverlay);
  }
}

function onCanvasMouseUp() {
  dragTextIdx = null;
  isCropDraggingActive.value = false;
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
    return;
  }
  if (hitTestCrop(touch.clientX, touch.clientY)) {
    isCropDraggingActive.value = true;
    cropDragStartX = touch.clientX;
    cropDragStartY = touch.clientY;
    cropDragStartLeft = cropLeft.value;
    cropDragStartTop = cropTop.value;
    cropDragStartRight = cropRight.value;
    cropDragStartBottom = cropBottom.value;
  }
}

function onCanvasTouchMove(e) {
  const touch = e.touches[0];
  if (dragTextIdx !== null) {
    const c = unifiedCanvas.value;
    if (!c) return;
    const bounds = c.getBoundingClientRect();
    const dx = (touch.clientX - dragStartClientX) / bounds.width;
    const dy = (touch.clientY - dragStartClientY) / bounds.height;
    overlays.value[dragTextIdx].xPct = Math.max(0, Math.min(1, dragStartXPct + dx));
    overlays.value[dragTextIdx].yPct = Math.max(0, Math.min(1, dragStartYPct + dy));
    redrawPreviewOverlay();
    return;
  }
  if (isCropDraggingActive.value) {
    const c = unifiedCanvas.value;
    const img = previewImg.value;
    if (!c || !img) return;
    const bounds = c.getBoundingClientRect();
    const scaleX = img.naturalWidth / bounds.width;
    const scaleY = img.naturalHeight / bounds.height;
    const dxNative = (touch.clientX - cropDragStartX) * scaleX;
    const dyNative = (touch.clientY - cropDragStartY) * scaleY;

    const maxDx = cropDragStartRight;
    const minDx = -cropDragStartLeft;
    const maxDy = cropDragStartBottom;
    const minDy = -cropDragStartTop;

    const clampedDx = Math.max(minDx, Math.min(maxDx, dxNative));
    const clampedDy = Math.max(minDy, Math.min(maxDy, dyNative));

    suppressCropSync = true;
    cropLeft.value = Math.round(cropDragStartLeft + clampedDx);
    cropTop.value = Math.round(cropDragStartTop + clampedDy);
    cropRight.value = Math.round(cropDragStartRight - clampedDx);
    cropBottom.value = Math.round(cropDragStartBottom - clampedDy);
    suppressCropSync = false;
    nextTick(redrawPreviewOverlay);
  }
}

function onCanvasTouchEnd() {
  dragTextIdx = null;
  isCropDraggingActive.value = false;
}

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

  // Apply flip/rotate to preview
  ctx.save();
  if (flipHorizontal.value || flipVertical.value || rotate90.value !== 0) {
    ctx.translate(dw / 2, dh / 2);
    if (rotate90.value === 90) ctx.rotate(Math.PI / 2);
    else if (rotate90.value === 180) ctx.rotate(Math.PI);
    else if (rotate90.value === 270) ctx.rotate(-Math.PI / 2);
    ctx.scale(flipHorizontal.value ? -1 : 1, flipVertical.value ? -1 : 1);
    ctx.translate(-dw / 2, -dh / 2);
  }
  ctx.drawImage(img, 0, 0, dw, dh);
  ctx.restore();

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

    // Move indicator
    if (isCropDraggingActive.value) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✥', x + w/2, y + h/2);
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

// ---- WEBP PARSER ----
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
  startTime.value = 0; endTime.value = 20;
  fps.value = DEFAULT_FPS; width.value = DEFAULT_WIDTH; quality.value = DEFAULT_QUALITY;
  cropEnabled.value = false;
  cropTop.value = 0; cropBottom.value = 0; cropLeft.value = 0; cropRight.value = 0;
  syncVertical.value = true; syncHorizontal.value = true;
  flipHorizontal.value = false; flipVertical.value = false; rotate90.value = 0;
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
  resultWidth.value = 0; resultHeight.value = 0; resultDuration.value = 0;
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

function buildVfFilter() {
  const parts = [];
  const cl = cropLeft.value||0, cr = cropRight.value||0, ct = cropTop.value||0, cb = cropBottom.value||0;
  if (cropEnabled.value && (cl+cr+ct+cb > 0)) parts.push(`crop=iw-${cl+cr}:ih-${ct+cb}:${cl}:${ct}`);
  if (flipHorizontal.value) parts.push('hflip');
  if (flipVertical.value) parts.push('vflip');
  if (rotate90.value === 90) parts.push('transpose=1');
  else if (rotate90.value === 180) parts.push('transpose=1,transpose=1');
  else if (rotate90.value === 270) parts.push('transpose=2');
  parts.push(`fps=${fps.value}`);
  parts.push(`scale=${width.value}:trunc(ow/a/2)*2`);
  return parts.join(',');
}

function mimeForFormat(fmt) {
  if (fmt === 'gif') return 'image/gif';
  if (fmt === 'webp') return 'image/webp';
  return 'video/mp4';
}

// Mapuje suwak Jakość (0-100, wyżej = lepiej) na CRF h264 (0-51, niżej = lepiej).
// Zachowuje tę samą "logikę" co przy GIF/WebP: wyższa jakość = większy plik.
function qualityToCrf() {
  return Math.round(51 - (quality.value / 100) * 33);
}

// Dolna granica pasma tolerancji: rozmiar w przedziale [SIZE_TOLERANCE * target, target]
// uznajemy za "wystarczająco blisko celu" i przestajemy dalej dostrajać.
const SIZE_TOLERANCE = 0.95;

// Szacowany narzut nagłówków/kontenerów per format (bajty).
// Przy krótkiej próbce ten stały narzut jest proporcjonalnie duży i zawyża
// ekstrapolację liniową — odejmujemy go przed skalowaniem, dodajemy raz na końcu.
const CONTAINER_OVERHEAD = { gif: 800, webp: 500, mp4: 5000 };

// Dostosowuje Szerokość / FPS / Jakość w stronę celu — w OBIE strony.
// remainingAttempts: ile prób zostało ŁĄCZNIE (włącznie z tą) — używane do skalowania
// agresywności: jeśli zostały 3 próby, a brakuje 2MB, każda próba musi zrobić krok
// odpowiadający ~1/3 tej odległości (a nie 10% jak przy stałym tłumieniu).
function adjustParamsToTarget(actualBytes, targetBytes, growing, remainingAttempts = 1) {
  const ratio = targetBytes / actualBytes;
  const gap   = Math.abs(1 - ratio); // jak daleko jesteśmy od celu (0 = cel, 1 = 2× dalej)

  // Wymagany postęp w tej iteracji: rozłóż odległość równo na pozostałe próby,
  // ale nie rób mniejszego kroku niż 60% odległości (żeby nie "dreptać w miejscu")
  // i nie większego niż 1.0 (cała odległość naraz — zawsze z marginesem w fazie shrink).
  const stepShare = Math.min(1.0, Math.max(0.8, 1 / Math.max(1, remainingAttempts)));

  // Docelowy ratio po tej iteracji — interpolacja między actual a target
  const targetRatio = growing
    ? 1 + gap * stepShare        // w górę: zmierzamy do celu o stepShare drogi
    : 1 - gap * stepShare;       // w dół:  j.w.

  // rawFactor to ile razy muszą wzrosnąć/spaść parametry (kombinacja Szerokość×FPS×Jakość)
  // żeby osiągnąć targetRatio. Używamy pierwiastka 4. stopnia bo rozmiar ≈ (w^2 * fps * q).
  const rawFactor = Math.pow(targetRatio, 0.25);

  // Margines bezpieczeństwa: przy zmniejszaniu dokładamy 3% zapasu "w dół",
  // żeby nigdy nie wylądować tuż ponad limitem.
  const factor = growing ? rawFactor : rawFactor * 0.97;

  const FINE = gap < 0.25; // czy jesteśmy blisko celu?

  if (FINE) {
    // --- FAZA PRECYZYJNA ---
    // Blisko celu zmieniamy parametry POJEDYNCZO (Jakość → FPS → Szerokość),
    // żeby mnożnikowy efekt trzech suwaków jednocześnie nie powodował oscylacji.
    // Gwarancja minimalnego kroku +/-1: jeśli matematyka zaokrągliłaby do zera,
    // wymuszamy przynajmniej jednostkową zmianę — ważne zwłaszcza gdy gap jest mały
    // ale remainingAttempts też małe (trzeba zrobić większy krok niż "normalnie").
    if (growing) {
      let nq = Math.round(quality.value * factor);
      if (nq === quality.value && quality.value < 100) nq = quality.value + Math.max(1, Math.ceil(gap * quality.value * stepShare));
      if (nq <= 100 && nq !== quality.value) { quality.value = nq; return true; }

      let nf = Math.round(fps.value * factor);
      if (nf === fps.value && fps.value < 30) nf = fps.value + 1;
      if (nf <= 30 && nf !== fps.value) { fps.value = nf; return true; }

      let nw = Math.round((width.value * factor) / 10) * 10;
      if (nw === width.value && width.value < 1280) nw = width.value + 10;
      if (nw <= 1280 && nw !== width.value) { width.value = nw; return true; }
    } else {
      let nq = Math.round(quality.value * factor);
      if (nq === quality.value && quality.value > 1) nq = quality.value - Math.max(1, Math.ceil(gap * quality.value * stepShare));
      if (nq >= 1 && nq !== quality.value) { quality.value = nq; return true; }

      let nf = Math.round(fps.value * factor);
      if (nf === fps.value && fps.value > 1) nf = fps.value - 1;
      if (nf >= 1 && nf !== fps.value) { fps.value = nf; return true; }

      let nw = Math.round((width.value * factor) / 10) * 10;
      if (nw === width.value && width.value > 100) nw = width.value - 10;
      if (nw >= 100 && nw !== width.value) { width.value = nw; return true; }
    }
  } else {
    // --- FAZA ZGRUBNA ---
    // Daleko od celu wszystkie trzy parametry zmieniamy jednocześnie.
    const newWidth   = Math.min(1280, Math.max(100, Math.round((width.value   * factor) / 10) * 10));
    const newFps     = Math.min(30,   Math.max(1,   Math.round(fps.value     * factor)));
    const newQuality = Math.min(100,  Math.max(1,   Math.round(quality.value * factor)));

    let changed = false;
    if (newWidth   !== width.value)   { width.value   = newWidth;   changed = true; }
    if (newFps     !== fps.value)     { fps.value     = newFps;     changed = true; }
    if (newQuality !== quality.value) { quality.value = newQuality; changed = true; }
    if (changed) return true;

    // Zabezpieczenie: zaokrąglenia wyzerowały wszystkie zmiany — wymuszamy krok ręcznie
    if (growing) {
      if (quality.value < 100) { quality.value = Math.min(100, quality.value + 3); return true; }
      if (fps.value     < 30)  { fps.value     = Math.min(30,  fps.value + 1);     return true; }
      if (width.value   < 1280){ width.value   = Math.min(1280,width.value + 10);  return true; }
    } else {
      if (quality.value > 1)   { quality.value = Math.max(1,   quality.value - 3); return true; }
      if (fps.value     > 1)   { fps.value     = Math.max(1,   fps.value - 1);     return true; }
      if (width.value   > 100) { width.value   = Math.max(100, width.value - 10);  return true; }
    }
  }
  return false;
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
  try { localStorage.setItem('animconverter-theme', val ? 'dark' : 'light'); } catch (e) {}
});

// ---- FFmpeg INIT ----
onMounted(async () => {
  try {
    const savedTheme = localStorage.getItem('animconverter-theme');
    if (savedTheme) {
      isDarkMode.value = savedTheme === 'dark';
    } else {
      isDarkMode.value = false;
    }
  } catch (e) {}
  applyDarkModeClass();

  // Load clipboard from localStorage
  try {
    const savedClipboard = localStorage.getItem('animconverter-clipboard');
    if (savedClipboard) {
      clipboardText.value = savedClipboard;
    }
  } catch (e) {}

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

// Save clipboard to localStorage on change
watch(clipboardText, (newText) => {
  try {
    localStorage.setItem('animconverter-clipboard', newText);
  } catch (e) {}
});

// ---- FETCH VIDEO ----
async function fetchVideo(url) {
  const trimmed = url.trim();
  if (cachedUrl.value === trimmed && cachedFileData.value) return new Uint8Array(cachedFileData.value.slice().buffer);
  const needsProxy = trimmed.includes('x.com') || trimmed.includes('twitter.com') || trimmed.includes('video.twimg.com') || trimmed.includes('tiktok.com');
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
      originalFps.value = (meta && meta.duration >0) ? Math.round((meta.frameCount/meta.duration)*10)/10 : (meta ? meta.frameCount : null);
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
async function analyzeAndEstimate(attempt = 0, preloadedFileData = null) {
  if (!videoUrl.value.trim() || inputExt.value === 'webp') {
    if (inputExt.value === 'webp') error.value = 'Analiza rozmiaru dla WebP nie jest obsługiwana.';
    return;
  }
  error.value = '';
  if (attempt === 0) { estimatedSize.value = null; sizeConfidence.value = null; }
  if (isConverting.value) conversionStage.value = `Dopasowywanie parametrów do limitu rozmiaru (próba ${attempt + 1}/8)...`;
  try {
    const fileData = preloadedFileData || await fetchVideo(videoUrl.value);
    await ffmpeg.writeFile('analyze.mp4', new Uint8Array(fileData.slice().buffer));
    const duration = endTime.value - startTime.value;
    // Dłuższa próbka (2.5s / 25% filmu) daje bardziej reprezentatywną ekstrapolację
    const testDuration = Math.min(2.5, duration * 0.25);
    const testStart = startTime.value + duration * 0.4;
    const fmt = outputFormat.value;
    const overhead = CONTAINER_OVERHEAD[fmt] || 1000;

    if (fmt === 'gif') {
      const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
      await ffmpeg.exec(['-i','analyze.mp4','-ss',testStart.toFixed(2),'-t',testDuration.toFixed(2),'-vf',buildVfFilter()+`,split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,'-loop','0','sample.gif']);
      const sampleSize = (await ffmpeg.readFile('sample.gif')).length;
      await ffmpeg.deleteFile('sample.gif');
      const testFrames = Math.floor(testDuration * fps.value);
      const totalFrames = Math.floor(duration * fps.value);
      if (testFrames > 0) {
        // Odejmujemy narzut kontenera przed ekstrapolacją, dodajemy raz na końcu.
        // Bez tego krótka próbka zawyża prognozę (narzut skaluje się × ilość klatek).
        const dataOnly = Math.max(0, sampleSize - overhead);
        const rawEstimate = overhead + (dataOnly / testFrames) * totalFrames;
        estimatedSize.value = Math.round(rawEstimate * sizeEstimationCorrection.value);
        sizeConfidence.value = 0.85;
      } else { estimatedSize.value = sampleSize; sizeConfidence.value = 0.5; }
    } else if (fmt === 'webp') {
      await ffmpeg.exec(['-i','analyze.mp4','-ss',testStart.toFixed(2),'-t',testDuration.toFixed(2),'-vf',buildVfFilter(),'-c:v','webp','-q:v',quality.value.toString(),'-loop','0','-preset','default','-an','sample.webp']);
      const sampleSize = (await ffmpeg.readFile('sample.webp')).length;
      await ffmpeg.deleteFile('sample.webp');
      const dataOnly = Math.max(0, sampleSize - overhead);
      const rawEstimate = overhead + (dataOnly / testDuration) * duration;
      estimatedSize.value = Math.round(rawEstimate * sizeEstimationCorrection.value);
      sizeConfidence.value = 0.9;
    } else {
      // MP4 — próbka kodowana tym samym libx264/CRF co finalny plik.
      await ffmpeg.exec(['-i','analyze.mp4','-ss',testStart.toFixed(2),'-t',testDuration.toFixed(2),'-vf',buildVfFilter(),'-c:v','libx264','-pix_fmt','yuv420p','-crf',qualityToCrf().toString(),'-c:a','aac','-b:a','128k','-movflags','+faststart','sample.mp4']);
      const sampleSize = (await ffmpeg.readFile('sample.mp4')).length;
      await ffmpeg.deleteFile('sample.mp4');
      const dataOnly = Math.max(0, sampleSize - overhead);
      const rawEstimate = overhead + (dataOnly / testDuration) * duration;
      estimatedSize.value = Math.round(rawEstimate * sizeEstimationCorrection.value);
      sizeConfidence.value = 0.85;
    }
    await ffmpeg.deleteFile('analyze.mp4');

    if (limitSizeEnabled.value && attempt < 8) {
      const targetBytes = targetSizeMB.value * 1024 * 1024;
      const tooBig   = estimatedSize.value > targetBytes;
      const tooSmall = estimatedSize.value < targetBytes * SIZE_TOLERANCE;
      if (tooBig || tooSmall) {
        const remaining = 8 - attempt; // ile prób zostało ŁĄCZNIE (włącznie z tą)
        const changed = adjustParamsToTarget(estimatedSize.value, targetBytes, tooSmall, remaining);
        // Przekazujemy dalej ten sam fileData, żeby rekurencja nie pobierała wideo ponownie z sieci.
        if (changed) await analyzeAndEstimate(attempt + 1, fileData);
      }
      // W przeciwnym razie estymata mieści się w paśmie [95%-100% celu] — wystarczająco blisko.
    }
  } catch(e) { error.value = `Błąd analizy: ${e.message}`; console.error(e); }
}

// ---- KONWERSJA ----
let outputFrameCount_actual = 0;

async function convertViaCanvas(fileData, srcExt) {
  const userStart  = startTime.value;
  const userEnd    = endTime.value;
  const userFps    = fps.value;
  const targetDuration = Math.max(0.1, userEnd - userStart);
  const outputFrameCount = Math.max(1, Math.floor(targetDuration * userFps));

  const cl = cropLeft.value||0, cr = cropRight.value||0, ct = cropTop.value||0, cb = cropBottom.value||0;
  const hasCrop = cropEnabled.value && (cl+cr+ct+cb > 0);
  const hasFlip = flipHorizontal.value || flipVertical.value || rotate90.value !== 0;
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

  resultWidth.value = outW;
  resultHeight.value = outH;
  resultDuration.value = targetDuration;

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

      ctx.save();
      if (hasFlip) {
        ctx.translate(outW/2, outH/2);
        if (rotate90.value === 90) ctx.rotate(Math.PI/2);
        else if (rotate90.value === 180) ctx.rotate(Math.PI);
        else if (rotate90.value === 270) ctx.rotate(-Math.PI/2);
        ctx.scale(flipHorizontal.value ? -1 : 1, flipVertical.value ? -1 : 1);
        ctx.translate(-outW/2, -outH/2);
      }
      if (hasCrop) {
        ctx.drawImage(frame, cl, ct, cropW, cropH, 0, 0, outW, outH);
      } else {
        ctx.drawImage(frame, 0, 0, outW, outH);
      }
      ctx.restore();

      if (hasOverlays) drawOverlaysOnCanvas(ctx, outW, outH);
      frame.close();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const buf = await blob.arrayBuffer();
      await ffmpeg.writeFile(`frame_${String(i).padStart(5,'0')}.png`, new Uint8Array(buf));
    }
    decoder.close();
  } else {
    await ffmpeg.writeFile('conv_input.mp4', new Uint8Array(fileData.slice().buffer));
    await ffmpeg.exec([
      '-i', 'conv_input.mp4',
      '-ss', userStart.toString(),
      '-to', userEnd.toString(),
      '-vf', (hasCrop ? `crop=${srcW-cl-cr}:${srcH-ct-cb}:${cl}:${ct},` : '') + `fps=${userFps}`,
      '-f', 'image2',
      'rawframe_%05d.png',
    ]);

    let frameIdx = 0;
    for (let i = 0; i < outputFrameCount; i++) {
      const fname = `rawframe_${String(i+1).padStart(5,'0')}.png`;
      let rawData;
      try { rawData = await ffmpeg.readFile(fname); } catch(e) {
        outputFrameCount_actual = i;
        break;
      }
      const imgBlob = new Blob([rawData.buffer], { type: 'image/png' });
      const imgBitmap = await createImageBitmap(imgBlob);
      ctx.clearRect(0, 0, outW, outH);

      ctx.save();
      if (hasFlip) {
        ctx.translate(outW/2, outH/2);
        if (rotate90.value === 90) ctx.rotate(Math.PI/2);
        else if (rotate90.value === 180) ctx.rotate(Math.PI);
        else if (rotate90.value === 270) ctx.rotate(-Math.PI/2);
        ctx.scale(flipHorizontal.value ? -1 : 1, flipVertical.value ? -1 : 1);
        ctx.translate(-outW/2, -outH/2);
      }
      ctx.drawImage(imgBitmap, 0, 0, outW, outH);
      ctx.restore();

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

  const actualFrameCount = srcExt === 'webp' ? outputFrameCount : (outputFrameCount_actual ?? outputFrameCount);

  if (outputFormat.value === 'gif') {
    const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
    await ffmpeg.exec([
      '-f','image2','-framerate',userFps.toString(),'-i','frame_%05d.png',
      '-vf',`split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,
      '-loop','0','output.gif',
    ]);
  } else if (outputFormat.value === 'webp') {
    await ffmpeg.exec([
      '-f','image2','-framerate',userFps.toString(),'-i','frame_%05d.png',
      '-c:v','libwebp','-q:v',quality.value.toString(),'-loop','0','-preset','default','-an','output.webp',
    ]);
  } else {
    // MP4 z tej ścieżki (kadrowanie/nakładki/odbicie) powstaje wyłącznie z wyekstrahowanych
    // klatek PNG, więc — tak jak dotychczasowy GIF/WebP z tego pipeline'u — wynik jest BEZ DŹWIĘKU.
    await ffmpeg.exec([
      '-f','image2','-framerate',userFps.toString(),'-i','frame_%05d.png',
      '-c:v','libx264','-pix_fmt','yuv420p','-crf',qualityToCrf().toString(),
      '-movflags','+faststart','-an','output.mp4',
    ]);
  }

  for (let i = 0; i < actualFrameCount; i++) {
    try { await ffmpeg.deleteFile(`frame_${String(i).padStart(5,'0')}.png`); } catch(e) {}
  }

  const outExt = outputFormat.value;
  const data = await ffmpeg.readFile('output.' + outExt);
  resultBlob.value = new Blob([data.buffer], { type: mimeForFormat(outExt) });
  resultUrl.value = URL.createObjectURL(resultBlob.value);
  await ffmpeg.deleteFile('output.' + outExt);
}

async function performEncode(fileData) {
  const hasCrop = cropEnabled.value && (cropLeft.value+cropRight.value+cropTop.value+cropBottom.value > 0);
  const hasFlip = flipHorizontal.value || flipVertical.value || rotate90.value !== 0;
  const hasOverlays = overlays.value.some(item =>
    (item.type === 'text' && item.text.trim() !== '') ||
    (item.type === 'image' && !!item.imageSrc)
  );

  const cl = cropLeft.value||0, cr = cropRight.value||0, ct = cropTop.value||0, cb = cropBottom.value||0;
  const srcW = originalWidth.value || width.value;
  const srcH = originalHeight.value || Math.round(width.value * 9 / 16);
  const cropW = Math.max(1, srcW - cl - cr);
  const cropH = Math.max(1, srcH - ct - cb);
  resultWidth.value = width.value;
  resultHeight.value = Math.round(width.value * cropH / cropW);
  resultDuration.value = Math.max(0.1, endTime.value - startTime.value);

  if (inputExt.value === 'webp') {
    await convertViaCanvas(fileData, 'webp');
  } else if (hasCrop || hasOverlays || hasFlip) {
    await convertViaCanvas(fileData, 'mp4');
  } else {
    await ffmpeg.writeFile('input.mp4', new Uint8Array(fileData.slice().buffer));
    if (outputFormat.value === 'gif') {
      const gifMaxColors = Math.max(2, Math.min(256, Math.round(quality.value * 2.56)));
      await ffmpeg.exec(['-i','input.mp4','-ss',startTime.value.toString(),'-to',endTime.value.toString(),'-vf',buildVfFilter()+`,split[s0][s1];[s0]palettegen=max_colors=${gifMaxColors}[p];[s1][p]paletteuse=dither=bayer`,'-loop','0','output.gif']);
    } else if (outputFormat.value === 'webp') {
      await ffmpeg.exec(['-i','input.mp4','-ss',startTime.value.toString(),'-to',endTime.value.toString(),'-vf',buildVfFilter(),'-c:v','webp','-q:v',quality.value.toString(),'-loop','0','-preset','default','-an','output.webp']);
    } else {
      // MP4 z tej ścieżki (bez kadrowania/nakładek) koduje się bezpośrednio z oryginalnego
      // pliku, więc — w odróżnieniu od ścieżki z canvasu — ZACHOWUJE dźwięk źródła.
      await ffmpeg.exec(['-i','input.mp4','-ss',startTime.value.toString(),'-to',endTime.value.toString(),'-vf',buildVfFilter(),'-c:v','libx264','-pix_fmt','yuv420p','-crf',qualityToCrf().toString(),'-c:a','aac','-b:a','128k','-movflags','+faststart','output.mp4']);
    }
    const outExt = outputFormat.value;
    const data = await ffmpeg.readFile('output.' + outExt);
    resultBlob.value = new Blob([data.buffer], { type: mimeForFormat(outExt) });
    resultUrl.value = URL.createObjectURL(resultBlob.value);
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('output.' + outExt);
  }
}

async function convert() {
  if (!videoUrl.value.trim()) { error.value = 'Wprowadź link do wideo lub wgraj plik.'; return; }
  error.value = ''; resultUrl.value = null; resultBlob.value = null; isConverting.value = true;
  conversionStage.value = '';

  try {
    const fileData = await fetchVideo(videoUrl.value);
    const targetBytes = targetSizeMB.value * 1024 * 1024;

    // KROK 1: jeśli włączony limit rozmiaru, próba "w tle" na krótkiej próbce —
    // dostosowuje Szerokość / FPS / Jakość (w OBIE strony — patrz analyzeAndEstimate),
    // zanim wygenerujemy pełny plik. (Dla wejścia WebP analiza próbki nie jest wspierana.)
    if (limitSizeEnabled.value && inputExt.value !== 'webp') {
      await analyzeAndEstimate(0, fileData);
    }

    // KROK 2: generujemy właściwy plik.
    conversionStage.value = 'Generowanie pliku...';
    await performEncode(fileData);

    // Uczenie współczynnika korekcji: porównujemy realny rozmiar z prognozą
    // i zapamiętujemy stosunek, żeby następne estymacje były celniejsze.
    if (estimatedSize.value && estimatedSize.value > 0 && resultBlob.value) {
      const correctionFromThisEncode = resultBlob.value.size / estimatedSize.value;
      // Wygładzone uśrednianie: 30% starej wartości + 70% nowego pomiaru
      sizeEstimationCorrection.value = 0.3 * sizeEstimationCorrection.value + 0.7 * correctionFromThisEncode;
    }

    // KROK 3: realna weryfikacja PO wygenerowaniu — próbka to tylko przybliżenie, więc
    // dociągamy jeszcze raz na podstawie PRAWDZIWEGO rozmiaru: jeśli plik jest za duży,
    // zmniejszamy parametry; jeśli jest wyraźnie MNIEJSZY niż limit, zwiększamy je, żeby
    // zbliżyć się do zadanego rozmiaru (a nie zostawiać niepotrzebny zapas) — ale zawsze
    // z marginesem bezpieczeństwa, żeby nigdy nie przekroczyć limitu.
    if (limitSizeEnabled.value) {
      const MAX_FINAL_ATTEMPTS = 4;
      let finalAttempt = 0;
      while (resultBlob.value && finalAttempt < MAX_FINAL_ATTEMPTS) {
        const size = resultBlob.value.size;
        const tooBig   = size > targetBytes;
        const tooSmall = size < targetBytes * SIZE_TOLERANCE;
        if (!tooBig && !tooSmall) break; // w paśmie tolerancji — wystarczająco blisko celu

        finalAttempt++;
        // Przekazujemy ile prób zostało — funkcja skaluje agresywność kroku proporcjonalnie.
        // Przy ostatniej próbie krok będzie "brał wszystko naraz" zamiast oszczędzać na kolejne.
        const remaining = MAX_FINAL_ATTEMPTS - finalAttempt + 1;
        const changed = adjustParamsToTarget(size, targetBytes, tooSmall, remaining);
        if (!changed) break; // parametry utknęły na granicy (min. lub maks.) — dalsze próby nic nie dadzą

        conversionStage.value = tooBig
          ? `Plik za duży (${formatFileSize(size)}) — zmniejszam parametry i generuję ponownie (próba ${finalAttempt}/${MAX_FINAL_ATTEMPTS})...`
          : `Plik mniejszy niż limit (${formatFileSize(size)}) — zwiększam parametry, by zbliżyć się do ${targetSizeMB.value} MB (próba ${finalAttempt}/${MAX_FINAL_ATTEMPTS})...`;
        await performEncode(fileData);
      }
    }
  } catch(e) { error.value = `Błąd konwersji: ${e.message}`; console.error(e); }
  finally { isConverting.value = false; conversionStage.value = ''; }
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
    sizeConfidence.value = null; sizeEstimationCorrection.value = 1.0; inputExt.value = 'mp4';
    originalSize.value = null; originalWidth.value = null; originalHeight.value = null;
    originalFps.value = null; originalDuration.value = null;
    resultWidth.value = 0; resultHeight.value = 0; resultDuration.value = 0;
    clearPreview();
  }
});

watch(cropTop,    (val) => { if (syncVertical.value && !suppressCropSync)   cropBottom.value = val; nextTick(redrawPreviewOverlay); }, { flush: 'sync' });
watch(cropBottom, (val) => { if (syncVertical.value && !suppressCropSync)   cropTop.value    = val; nextTick(redrawPreviewOverlay); }, { flush: 'sync' });
watch(cropLeft,   (val) => { if (syncHorizontal.value && !suppressCropSync) cropRight.value  = val; nextTick(redrawPreviewOverlay); }, { flush: 'sync' });
watch(cropRight,  (val) => { if (syncHorizontal.value && !suppressCropSync) cropLeft.value   = val; nextTick(redrawPreviewOverlay); }, { flush: 'sync' });

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
  height: 2.3rem;
  border-radius: 1.15rem;
  border: none;
  background-color: #eef1f5;
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0 0.9rem;
  transition: background-color 0.2s, transform 0.15s;
  touch-action: manipulation;
  z-index: 5;
}
.theme-toggle-btn:hover { background-color: #dde3ea; transform: scale(1.04); }
.theme-toggle-btn:active { transform: scale(0.96); }
.theme-icon { font-size: 1.15rem; line-height: 1; }
.theme-label { white-space: nowrap; }

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

/* ===== CROP CONTROLS ===== */
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

.crop-drag-hint {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: #888;
  font-style: italic;
}

.wide-btn {
  min-width: 2.8rem;
  padding: 0 0.8rem;
}

/* ===== TRANSFORM CONTROLS ===== */
.transform-controls {
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

.transform-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.transform-btn {
  padding: 0.55rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #444;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  touch-action: manipulation;
  text-align: center;
}
.transform-btn:hover:not(:disabled) {
  background: #e3f2fd;
  border-color: #1da1f2;
  color: #0c63e4;
}
.transform-btn.active {
  background: #1da1f2;
  border-color: #1da1f2;
  color: white;
}
.transform-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== TEXT CONTROLS ===== */
.text-controls {
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

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

.textbox-controls {
  background: white;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

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

.tc-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.88rem;
  background: white;
  color: #213547;
}

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

.tc-range {
  width: 100%;
  accent-color: #1da1f2;
}

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
.unified-canvas.crop-dragging {
  cursor: move;
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
  margin-bottom: 1.25rem;
  background: #f9f9f9;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  border: 1px solid #e0e0e0;
}
.original-meta h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #213547;
  font-weight: 700;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #555;
}
.meta-grid div {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}
.meta-grid div span {
  font-weight: 600;
  color: #213547;
  white-space: nowrap;
  min-width: 7.5rem;
}

/* ===== RESULT AREA ===== */
.result-area {
  margin-top: 1.5rem;
  text-align: center;
}
.result-area img,
.result-area video {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.result-meta-row {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  text-align: left;
}

.result-meta-box {
  flex: 1;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 0.75rem 1rem;
}
.result-meta-box h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #213547;
  font-weight: 700;
}

.result-meta-box .meta-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #555;
}
.result-meta-box .meta-grid div {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}
.result-meta-box .meta-grid div span {
  font-weight: 600;
  color: #213547;
  white-space: nowrap;
  min-width: 7.5rem;
}

.result-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.download-btn {
  padding: 0.65rem 1.4rem;
  border: none;
  border-radius: 8px;
  background-color: #1da1f2;
  color: white;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s;
}
.download-btn:hover { background-color: #1a91da; }

.copy-info-btn {
  padding: 0.65rem 1.4rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: white;
  color: #213547;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.copy-info-btn:hover { background: #f0f0f0; border-color: #bbb; }

/* ===== CLIPBOARD / SCHOWEK ===== */
.clipboard-section {
  margin: 1.5rem 0;
}

.clipboard-toggle-btn {
  width: 100%;
  padding: 0.75rem 1.2rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: white;
  color: #213547;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
}
.clipboard-toggle-btn:hover {
  background: #f0f0f0;
  border-color: #bbb;
}
.clipboard-toggle-btn.active {
  background: #e3f2fd;
  border-color: #1da1f2;
  color: #0c63e4;
}

.clipboard-panel {
  margin-top: 0.75rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
}

.clipboard-info {
  background: white;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #ddd;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  line-height: 1.5;
}
.clipboard-info p {
  margin: 0.4rem 0;
}
.clipboard-info code {
  background: #f5f5f5;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.82rem;
}

.clipboard-editor {
  margin-bottom: 1rem;
}

.clipboard-label {
  display: block;
  font-weight: 700;
  font-size: 0.9rem;
  color: #213547;
  margin-bottom: 0.5rem;
}

.clipboard-textarea {
  width: 100%;
  min-height: 120px;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  resize: vertical;
  box-sizing: border-box;
}
.clipboard-textarea:focus {
  outline: none;
  border-color: #1da1f2;
  box-shadow: 0 0 0 3px rgba(29,161,242,0.15);
}

.clipboard-clear-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #d32f2f;
  border-radius: 6px;
  background: #fce4e4;
  color: #d32f2f;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.clipboard-clear-btn:hover:not(:disabled) {
  background: #d32f2f;
  color: white;
}
.clipboard-clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clipboard-insert-section {
  background: white;
  padding: 0.75rem;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.insert-group {
  margin-bottom: 1rem;
}
.insert-group:last-child {
  margin-bottom: 0;
}

.insert-group-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: #213547;
  margin-bottom: 0.5rem;
}

.insert-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.insert-btn {
  padding: 0.45rem 0.85rem;
  border: 1px solid #4caf50;
  border-radius: 6px;
  background: #e8f5e9;
  color: #2e7d32;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  touch-action: manipulation;
}
.insert-btn:hover {
  background: #4caf50;
  color: white;
}

/* ===== IMAGE PREVIEW ===== */
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

/* ===== RESPONSIVE ===== */
@media (max-width: 600px) {
  .meta-grid,
  .result-meta-box .meta-grid {
    grid-template-columns: 1fr;
  }
  .format-options {
    flex-direction: column;
  }
  .unified-preview-wrapper {
    width: 100%;
  }
  .result-meta-row {
    flex-direction: column;
  }
  .transform-grid {
    grid-template-columns: 1fr;
  }

  .textbox-tabs-row {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.2rem;
  }
  .textbox-tabs {
    flex-wrap: nowrap;
  }

  .tc-field-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  .tc-field-group {
    width: 100%;
  }

  .style-color-row {
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 0.5rem;
    padding-bottom: 0.2rem;
  }
  .style-color-row .tc-field-group {
    width: auto;
    flex: 0 0 auto;
  }
  .style-color-row .tc-label {
    white-space: nowrap;
  }

  .tc-select,
  .text-input {
    width: 100%;
    max-width: 100%;
  }

  .btn-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .tc-num-input,
  .tc-num-input-sm {
    min-width: 0;
    flex: 1;
    max-width: 100%;
  }
  .num-btn {
    flex-shrink: 0;
  }

  .color-row {
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .color-hex {
    font-size: 0.75rem;
    word-break: break-all;
  }

  .style-toggles {
    gap: 0.3rem;
  }
  .style-btn {
    min-width: 2.2rem;
    height: 2.2rem;
    font-size: 0.9rem;
  }

  .emoji-grid {
    grid-template-columns: repeat(auto-fill, minmax(1.8rem, 1fr));
    max-height: 140px;
  }
  .emoji-btn {
    font-size: 1.2rem;
    padding: 0.2rem;
  }

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
  .theme-toggle-btn {
    padding: 0 0.6rem;
    font-size: 0.75rem;
  }
  .theme-label {
    display: none;
  }
}

/* ===== DARK MODE ===== */
.dark-mode .container {
  background-color: #181a1f;
  color: #e8e8e8;
}
.dark-mode .section-label { color: #e8e8e8; border-bottom-color: #3a3d44; }
.dark-mode .crop-controls,
.dark-mode .text-controls,
.dark-mode .transform-controls { background: #23262c; border-color: #3a3d44; }

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

.dark-mode input[type="text"],
.dark-mode input[type="number"] {
  background-color: #2a2d34;
  border: 1px solid #3a3d44;
  color: #e8e8e8;
}
.dark-mode input[type="text"]::placeholder,
.dark-mode input[type="number"]::placeholder {
  color: #8a8d94;
}
.dark-mode input[type="text"]:focus,
.dark-mode input[type="number"]:focus {
  outline: none;
  border-color: #1da1f2;
}

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
.dark-mode .crop-drag-hint { color: #777; }

.dark-mode .format-selector { background: #23262c; border-color: #3a3d44; }
.dark-mode .format-label { color: #e8e8e8; }
.dark-mode .format-btn { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .format-btn:hover:not(:disabled) { background: #3a3d44; border-color: #555; }
.dark-mode .format-btn.active { background: #16415e; border-color: #1da1f2; color: #8fd0ff; }

.dark-mode .original-meta,
.dark-mode .result-meta-box { background: #23262c; border-color: #3a3d44; }
.dark-mode .original-meta h4,
.dark-mode .result-meta-box h4 { color: #e8e8e8; }
.dark-mode .meta-grid,
.dark-mode .result-meta-box .meta-grid { color: #b0b0b0; }
.dark-mode .meta-grid div span,
.dark-mode .result-meta-box .meta-grid div span {color: #e8e8e8; }
.dark-mode .size-estimate label { color: #b0b0b0; }
.dark-mode .estimate-display { color: #e8e8e8; }
.dark-mode .estimate-value { color: #5ec1f7; }
.dark-mode .estimate-note { color: #999; }
.dark-mode .estimate-confidence { color: #aaa; }

.dark-mode .download-btn { background-color: #1da1f2; color: #fff; }
.dark-mode .download-btn:hover { background-color: #1a91da; }
.dark-mode .copy-info-btn { background: #2a2d34; border-color: #3a3d44; color: #e8e8e8; }
.dark-mode .copy-info-btn:hover { background: #3a3d44; border-color: #555; }

.dark-mode .image-preview-box { background: #2a2d34; }
.dark-mode .change-img-btn { background: #2a2d34; border-color: #3a3d44; color: #e8e8e8; }
.dark-mode .change-img-btn:hover { background: #3a3d44; }

.dark-mode .theme-toggle-btn { background-color: #2a2d34; color: #e8e8e8; }
.dark-mode .theme-toggle-btn:hover { background-color: #3a3d44; }

.dark-mode .transform-btn { background: #2a2d34; border-color: #3a3d44; color: #cfcfcf; }
.dark-mode .transform-btn:hover:not(:disabled) { background: #16415e; border-color: #1da1f2; color: #8fd0ff; }
.dark-mode .transform-btn.active { background: #1da1f2; border-color: #1da1f2; color: #fff; }
.dark-mode .transform-btn:disabled { background: #2a2d34; color: #6a6d74; }

.dark-mode .clipboard-toggle-btn {
  background: #2a2d34;
  border-color: #3a3d44;
  color: #e8e8e8;
}
.dark-mode .clipboard-toggle-btn:hover {
  background: #3a3d44;
  border-color: #555;
}
.dark-mode .clipboard-toggle-btn.active {
  background: #16415e;
  border-color: #1da1f2;
  color: #8fd0ff;
}

.dark-mode .clipboard-panel {
  background: #23262c;
  border-color: #3a3d44;
}

.dark-mode .clipboard-info {
  background: #1f2228;
  border-color: #3a3d44;
}
.dark-mode .clipboard-info code {
  background: #2a2d34;
  color: #5ec1f7;
}

.dark-mode .clipboard-label {
  color: #e8e8e8;
}

.dark-mode .clipboard-textarea {
  background: #2a2d34;
  border-color: #3a3d44;
  color: #e8e8e8;
}
.dark-mode .clipboard-textarea:focus {
  border-color: #1da1f2;
}

.dark-mode .clipboard-clear-btn {
  background: #3a1f1f;
  border-color: #ff9a9a;
  color: #ff9a9a;
}
.dark-mode .clipboard-clear-btn:hover:not(:disabled) {
  background: #d32f2f;
  color: white;
}

.dark-mode .clipboard-insert-section {
  background: #1f2228;
  border-color: #3a3d44;
}

.dark-mode .insert-group-label {
  color: #e8e8e8;
}

.dark-mode .insert-btn {
  background: #1f3a26;
  border-color: #4caf50;
  color: #8fd99f;
}
.dark-mode .insert-btn:hover {
  background: #4caf50;
  color: white;
}
</style>

<style>
html.dark-mode,
html.dark-mode body,
html.dark-mode #app {
  background-color: #181a1f !important;
  color: #e8e8e8 !important;
}
</style>
