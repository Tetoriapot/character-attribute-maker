(() => {
  "use strict";

  const MAP_SIZE = 800;
  const DEFAULT_CHARACTER_SIZE = 112;
  const MIN_CHARACTER_SIZE = 64;
  const MAX_CHARACTER_SIZE = 240;
  const CAPTION_SPACE = 34;
  const HISTORY_LIMIT = 60;
  const PREFERENCES_KEY = "character-attribute-maker-preferences-v1";
  const UPDATES_SEEN_KEY = "character-attribute-maker-updates-seen-v1";
  const CURRENT_UPDATE_VERSION = "2026-08-30-help-theme-color";
  const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
  const SUPPORTED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
  const BACKGROUND_MODES = new Set(["solid", "gradient", "image", "transparent"]);
  const LABEL_LAYOUTS = new Set(["inside", "outside"]);
  const AXIS_LENGTH_MIN = 50;
  const AXIS_LENGTH_MAX = 90;
  const AXIS_ARROW_SIZE_MIN = 6;
  const AXIS_ARROW_SIZE_MAX = 32;
  const AXIS_LINE_WIDTH_MIN = 1;
  const AXIS_LINE_WIDTH_MAX = 12;
  const AXIS_OPACITY_MIN = 0;
  const AXIS_OPACITY_MAX = 100;
  const BACKGROUND_OPACITY_MIN = 0;
  const BACKGROUND_OPACITY_MAX = 100;
  const MAP_ZOOM_MIN = 25;
  const MAP_ZOOM_MAX = 200;
  const MAP_ZOOM_STEP = 10;
  const MAP_VIEWPORT_MIN_HEIGHT = 280;
  const MAP_VIEWPORT_MAX_HEIGHT = 832;
  const MAP_VIEWPORT_MOBILE_MAX_HEIGHT = 620;
  const MAP_VIEWPORT_MOBILE_RATIO = 0.72;
  const OUTSIDE_VERTICAL_LABEL_MAX_CHARACTERS = 11;
  const OUTSIDE_PLOT_RECT = Object.freeze({ x: 100, y: 134, size: 600 });
  const OUTSIDE_PLOT_BOUNDARY_COLOR = "#71827c";
  const TRANSPARENCY_GRID =
    "linear-gradient(45deg, #e4e9e7 25%, transparent 25%), " +
    "linear-gradient(-45deg, #e4e9e7 25%, transparent 25%), " +
    "linear-gradient(45deg, transparent 75%, #e4e9e7 75%), " +
    "linear-gradient(-45deg, transparent 75%, #e4e9e7 75%)";

  const FONT_OPTIONS = Object.freeze({
    "yu-gothic-ui": '"Yu Gothic UI", "Yu Gothic", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
    "yu-gothic": '"Yu Gothic", "Yu Gothic UI", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
    meiryo: 'Meiryo, "Yu Gothic UI", "Hiragino Kaku Gothic ProN", sans-serif',
    "biz-ud-gothic": '"BIZ UDPGothic", "Yu Gothic UI", Meiryo, sans-serif',
    "ms-pgothic": '"MS PGothic", "Yu Gothic UI", Meiryo, sans-serif',
    rounded: '"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", Meiryo, sans-serif',
    "yu-mincho": '"Yu Mincho", "Hiragino Mincho ProN", "MS PMincho", serif',
    "biz-ud-mincho": '"BIZ UDPMincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
    "ms-pmincho": '"MS PMincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
    monospace: '"BIZ UDGothic", "MS Gothic", Consolas, monospace',
  });

  const PRESETS = {
    white: {
      backgroundMode: "solid",
      backgroundColor: "#fffdf8",
      gradientStart: "#fffdf8",
      gradientEnd: "#fffdf8",
    },
    beige: {
      backgroundMode: "solid",
      backgroundColor: "#f7f0df",
      gradientStart: "#f7f0df",
      gradientEnd: "#f7f0df",
    },
    blue: {
      backgroundMode: "solid",
      backgroundColor: "#eef8fb",
      gradientStart: "#eef8fb",
      gradientEnd: "#eef8fb",
    },
    green: {
      backgroundMode: "solid",
      backgroundColor: "#eff8f2",
      gradientStart: "#eff8f2",
      gradientEnd: "#eff8f2",
    },
    gradient: {
      backgroundMode: "gradient",
      backgroundColor: "#fff4cf",
      gradientStart: "#fff4cf",
      gradientEnd: "#d9eff2",
    },
  };

  const dom = {
    helpButton: document.querySelector("#helpButton"),
    updatesButton: document.querySelector("#updatesButton"),
    updatesNewBadge: document.querySelector("#updatesNewBadge"),
    helpDialog: document.querySelector("#helpDialog"),
    updatesDialog: document.querySelector("#updatesDialog"),
    undoButton: document.querySelector("#undoButton"),
    redoButton: document.querySelector("#redoButton"),
    resetButton: document.querySelector("#resetButton"),
    mapTitleInput: document.querySelector("#mapTitleInput"),
    mapTitleDisplay: document.querySelector("#mapTitleDisplay"),
    insideLabelLayoutButton: document.querySelector("#insideLabelLayoutButton"),
    outsideLabelLayoutButton: document.querySelector("#outsideLabelLayoutButton"),
    outsideLabelOptions: document.querySelector("#outsideLabelOptions"),
    verticalSideLabelsInput: document.querySelector("#verticalSideLabelsInput"),
    topLabelInput: document.querySelector("#topLabelInput"),
    bottomLabelInput: document.querySelector("#bottomLabelInput"),
    leftLabelInput: document.querySelector("#leftLabelInput"),
    rightLabelInput: document.querySelector("#rightLabelInput"),
    topAxisLabel: document.querySelector("#topAxisLabel"),
    bottomAxisLabel: document.querySelector("#bottomAxisLabel"),
    leftAxisLabel: document.querySelector("#leftAxisLabel"),
    rightAxisLabel: document.querySelector("#rightAxisLabel"),
    chooseFilesButton: document.querySelector("#chooseFilesButton"),
    fileInput: document.querySelector("#fileInput"),
    dropZone: document.querySelector("#dropZone"),
    imageLibrary: document.querySelector("#imageLibrary"),
    libraryEmpty: document.querySelector("#libraryEmpty"),
    imageCount: document.querySelector("#imageCount"),
    libraryActions: document.querySelector("#libraryActions"),
    libraryDefaultActions: document.querySelector("#libraryDefaultActions"),
    librarySelectionActions: document.querySelector("#librarySelectionActions"),
    librarySelectionCount: document.querySelector("#librarySelectionCount"),
    librarySelectionHelp: document.querySelector("#librarySelectionHelp"),
    startLibrarySelectionButton: document.querySelector("#startLibrarySelectionButton"),
    cancelLibrarySelectionButton: document.querySelector("#cancelLibrarySelectionButton"),
    selectAllLibraryButton: document.querySelector("#selectAllLibraryButton"),
    deleteSelectedLibraryButton: document.querySelector("#deleteSelectedLibraryButton"),
    deleteAllLibraryButton: document.querySelector("#deleteAllLibraryButton"),
    selectionEmpty: document.querySelector("#selectionEmpty"),
    characterSettings: document.querySelector("#characterSettings"),
    characterNameInput: document.querySelector("#characterNameInput"),
    characterSizeInput: document.querySelector("#characterSizeInput"),
    characterSizeOutput: document.querySelector("#characterSizeOutput"),
    borderColorInput: document.querySelector("#borderColorInput"),
    borderColorValue: document.querySelector("#borderColorValue"),
    borderWidthInput: document.querySelector("#borderWidthInput"),
    squareShapeButton: document.querySelector("#squareShapeButton"),
    circleShapeButton: document.querySelector("#circleShapeButton"),
    showNameInput: document.querySelector("#showNameInput"),
    applyStyleToAllButton: document.querySelector("#applyStyleToAllButton"),
    applyStyleToAllHelp: document.querySelector("#applyStyleToAllHelp"),
    duplicateButton: document.querySelector("#duplicateButton"),
    deleteButton: document.querySelector("#deleteButton"),
    backgroundModeInput: document.querySelector("#backgroundModeInput"),
    backgroundSolidFields: document.querySelector("#backgroundSolidFields"),
    backgroundGradientFields: document.querySelector("#backgroundGradientFields"),
    backgroundColorInput: document.querySelector("#backgroundColorInput"),
    backgroundColorValue: document.querySelector("#backgroundColorValue"),
    gradientStartInput: document.querySelector("#gradientStartInput"),
    gradientStartValue: document.querySelector("#gradientStartValue"),
    gradientEndInput: document.querySelector("#gradientEndInput"),
    gradientEndValue: document.querySelector("#gradientEndValue"),
    backgroundImageFields: document.querySelector("#backgroundImageFields"),
    backgroundImageInput: document.querySelector("#backgroundImageInput"),
    chooseBackgroundImageButton: document.querySelector("#chooseBackgroundImageButton"),
    backgroundImageEmpty: document.querySelector("#backgroundImageEmpty"),
    backgroundImagePreview: document.querySelector("#backgroundImagePreview"),
    backgroundImageThumbnail: document.querySelector("#backgroundImageThumbnail"),
    backgroundImageName: document.querySelector("#backgroundImageName"),
    removeBackgroundImageButton: document.querySelector("#removeBackgroundImageButton"),
    backgroundTransparentHint: document.querySelector("#backgroundTransparentHint"),
    backgroundOpacityField: document.querySelector("#backgroundOpacityField"),
    backgroundOpacityInput: document.querySelector("#backgroundOpacityInput"),
    backgroundOpacityOutput: document.querySelector("#backgroundOpacityOutput"),
    outerBackgroundGroup: document.querySelector("#outerBackgroundGroup"),
    outerBackgroundModeInput: document.querySelector("#outerBackgroundModeInput"),
    outerBackgroundSolidFields: document.querySelector("#outerBackgroundSolidFields"),
    outerBackgroundGradientFields: document.querySelector("#outerBackgroundGradientFields"),
    outerBackgroundColorInput: document.querySelector("#outerBackgroundColorInput"),
    outerBackgroundColorValue: document.querySelector("#outerBackgroundColorValue"),
    outerGradientStartInput: document.querySelector("#outerGradientStartInput"),
    outerGradientStartValue: document.querySelector("#outerGradientStartValue"),
    outerGradientEndInput: document.querySelector("#outerGradientEndInput"),
    outerGradientEndValue: document.querySelector("#outerGradientEndValue"),
    outerBackgroundImageFields: document.querySelector("#outerBackgroundImageFields"),
    outerBackgroundImageInput: document.querySelector("#outerBackgroundImageInput"),
    chooseOuterBackgroundImageButton: document.querySelector(
      "#chooseOuterBackgroundImageButton",
    ),
    outerBackgroundImageEmpty: document.querySelector("#outerBackgroundImageEmpty"),
    outerBackgroundImagePreview: document.querySelector("#outerBackgroundImagePreview"),
    outerBackgroundImageThumbnail: document.querySelector("#outerBackgroundImageThumbnail"),
    outerBackgroundImageName: document.querySelector("#outerBackgroundImageName"),
    removeOuterBackgroundImageButton: document.querySelector(
      "#removeOuterBackgroundImageButton",
    ),
    outerBackgroundTransparentHint: document.querySelector(
      "#outerBackgroundTransparentHint",
    ),
    axisModeInput: document.querySelector("#axisModeInput"),
    axisSolidFields: document.querySelector("#axisSolidFields"),
    axisGradientFields: document.querySelector("#axisGradientFields"),
    axisColorInput: document.querySelector("#axisColorInput"),
    axisColorValue: document.querySelector("#axisColorValue"),
    axisGradientStartInput: document.querySelector("#axisGradientStartInput"),
    axisGradientStartValue: document.querySelector("#axisGradientStartValue"),
    axisGradientEndInput: document.querySelector("#axisGradientEndInput"),
    axisGradientEndValue: document.querySelector("#axisGradientEndValue"),
    axisLengthInput: document.querySelector("#axisLengthInput"),
    axisLengthOutput: document.querySelector("#axisLengthOutput"),
    axisArrowSizeInput: document.querySelector("#axisArrowSizeInput"),
    axisArrowSizeOutput: document.querySelector("#axisArrowSizeOutput"),
    axisLineWidthInput: document.querySelector("#axisLineWidthInput"),
    axisLineWidthOutput: document.querySelector("#axisLineWidthOutput"),
    axisOpacityInput: document.querySelector("#axisOpacityInput"),
    axisOpacityOutput: document.querySelector("#axisOpacityOutput"),
    fontFamilyInput: document.querySelector("#fontFamilyInput"),
    textColorInput: document.querySelector("#textColorInput"),
    textColorValue: document.querySelector("#textColorValue"),
    includeBackgroundInput: document.querySelector("#includeBackgroundInput"),
    exportScaleInput: document.querySelector("#exportScaleInput"),
    exportButton: document.querySelector("#exportButton"),
    canvasPanel: document.querySelector(".canvas-panel"),
    canvasPanelHeader: document.querySelector(".canvas-panel-header"),
    mapViewToolbar: document.querySelector(".map-view-toolbar"),
    zoomOutButton: document.querySelector("#zoomOutButton"),
    mapZoomInput: document.querySelector("#mapZoomInput"),
    mapZoomOutput: document.querySelector("#mapZoomOutput"),
    zoomInButton: document.querySelector("#zoomInButton"),
    actualSizeButton: document.querySelector("#actualSizeButton"),
    fitMapButton: document.querySelector("#fitMapButton"),
    mapViewport: document.querySelector("#mapViewport"),
    mapFrame: document.querySelector("#mapFrame"),
    mapZoomStatus: document.querySelector("#mapZoomStatus"),
    mapComposition: document.querySelector("#mapComposition"),
    mapStage: document.querySelector("#mapStage"),
    mapInnerBackground: document.querySelector("#mapInnerBackground"),
    placementLayer: document.querySelector("#placementLayer"),
    mapEmptyHint: document.querySelector("#mapEmptyHint"),
    selectionStatus: document.querySelector("#selectionStatus"),
    toast: document.querySelector("#toast"),
    presetButtons: Array.from(document.querySelectorAll("[data-preset]")),
  };

  const assets = new Map();
  const undoStack = [];
  const redoStack = [];

  let state = createDefaultState();
  let selectedId = null;
  let idCounter = 0;
  let interaction = null;
  let pendingEdit = null;
  let toastTimer = 0;
  let preferenceTimer = 0;
  let resetEpoch = 0;
  let libraryLoadGeneration = 0;
  let libraryLoadRequestId = 0;
  let librarySelectionMode = false;
  let mapViewZoom = 100;
  let mapViewMode = "fit";
  let mapViewLayoutFrame = 0;
  let mapViewScrollFrame = 0;
  let pendingMapViewCenterRatio = null;
  const selectedLibraryAssetIds = new Set();
  const backgroundLoadRequests = { inner: 0, outer: 0 };
  const mapViewObservers = [];
  const dialogOpeners = new WeakMap();

  function createDefaultState() {
    return {
      mapTitle: "",
      backgroundAssetId: null,
      outerBackgroundAssetId: null,
      axis: {
        top: "善",
        bottom: "悪",
        left: "混沌",
        right: "秩序",
      },
      appearance: {
        backgroundMode: "solid",
        backgroundColor: "#fffdf8",
        gradientStart: "#fff4cf",
        gradientEnd: "#d9eff2",
        backgroundOpacity: 100,
        outerBackgroundMode: "solid",
        outerBackgroundColor: "#eef2f0",
        outerGradientStart: "#f4eee2",
        outerGradientEnd: "#dfeeea",
        axisMode: "solid",
        axisColor: "#71827c",
        axisGradientStart: "#71827c",
        axisGradientEnd: "#4e9f92",
        axisLength: 84,
        axisArrowSize: 12,
        axisLineWidth: 2.5,
        axisOpacity: 100,
        textColor: "#26332f",
        fontFamily: "yu-gothic-ui",
        labelLayout: "inside",
        verticalSideLabels: true,
        activePreset: "white",
      },
      libraryIds: [],
      placements: [],
    };
  }

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null");
      if (!saved || typeof saved !== "object") return;

      if (typeof saved.mapTitle === "string") {
        state.mapTitle = saved.mapTitle.slice(0, 80);
      }

      for (const key of ["top", "bottom", "left", "right"]) {
        if (typeof saved.axis?.[key] === "string") {
          state.axis[key] = saved.axis[key].slice(0, 80);
        }
      }

      const appearance = saved.appearance || {};
      if (BACKGROUND_MODES.has(appearance.backgroundMode) && appearance.backgroundMode !== "image") {
        state.appearance.backgroundMode = appearance.backgroundMode;
      }
      if (
        BACKGROUND_MODES.has(appearance.outerBackgroundMode) &&
        appearance.outerBackgroundMode !== "image"
      ) {
        state.appearance.outerBackgroundMode = appearance.outerBackgroundMode;
      }
      if (appearance.axisMode === "solid" || appearance.axisMode === "gradient") {
        state.appearance.axisMode = appearance.axisMode;
      }
      if (LABEL_LAYOUTS.has(appearance.labelLayout)) {
        state.appearance.labelLayout = appearance.labelLayout;
      }
      if (typeof appearance.verticalSideLabels === "boolean") {
        state.appearance.verticalSideLabels = appearance.verticalSideLabels;
      }
      for (const key of [
        "backgroundColor",
        "gradientStart",
        "gradientEnd",
        "outerBackgroundColor",
        "outerGradientStart",
        "outerGradientEnd",
        "axisColor",
        "axisGradientStart",
        "axisGradientEnd",
        "textColor",
      ]) {
        if (isHexColor(appearance[key])) state.appearance[key] = appearance[key].toLowerCase();
      }
      if (!Object.prototype.hasOwnProperty.call(appearance, "outerBackgroundMode")) {
        state.appearance.outerBackgroundMode = state.appearance.backgroundMode;
        state.appearance.outerBackgroundColor = state.appearance.backgroundColor;
        state.appearance.outerGradientStart = state.appearance.gradientStart;
        state.appearance.outerGradientEnd = state.appearance.gradientEnd;
      }
      const axisLength = Number(appearance.axisLength);
      if (Number.isFinite(axisLength)) {
        state.appearance.axisLength = clamp(
          Math.round(axisLength),
          AXIS_LENGTH_MIN,
          AXIS_LENGTH_MAX,
        );
      }
      const axisArrowSize = normalizeRangeValue(
        appearance.axisArrowSize,
        AXIS_ARROW_SIZE_MIN,
        AXIS_ARROW_SIZE_MAX,
      );
      if (axisArrowSize !== null) state.appearance.axisArrowSize = axisArrowSize;
      const axisLineWidth = normalizeRangeValue(
        appearance.axisLineWidth,
        AXIS_LINE_WIDTH_MIN,
        AXIS_LINE_WIDTH_MAX,
        0.5,
      );
      if (axisLineWidth !== null) state.appearance.axisLineWidth = axisLineWidth;
      const axisOpacity = normalizeRangeValue(
        appearance.axisOpacity,
        AXIS_OPACITY_MIN,
        AXIS_OPACITY_MAX,
        5,
      );
      if (axisOpacity !== null) state.appearance.axisOpacity = axisOpacity;
      const backgroundOpacity = Number(appearance.backgroundOpacity);
      if (Number.isFinite(backgroundOpacity)) {
        state.appearance.backgroundOpacity = clamp(
          Math.round(backgroundOpacity),
          BACKGROUND_OPACITY_MIN,
          BACKGROUND_OPACITY_MAX,
        );
      }
      if (isFontOption(appearance.fontFamily)) {
        state.appearance.fontFamily = appearance.fontFamily;
      }
      if (typeof appearance.activePreset === "string") {
        state.appearance.activePreset = appearance.activePreset;
      }
    } catch {
      // Preferences are optional. Invalid or unavailable storage should never block the app.
    }
  }

  function savePreferencesSoon() {
    window.clearTimeout(preferenceTimer);
    preferenceTimer = window.setTimeout(savePreferences, 180);
  }

  function savePreferences() {
    try {
      const appearance = {
        ...state.appearance,
        backgroundMode:
          state.appearance.backgroundMode === "image" ? "solid" : state.appearance.backgroundMode,
        outerBackgroundMode:
          state.appearance.outerBackgroundMode === "image"
            ? "solid"
            : state.appearance.outerBackgroundMode,
      };
      localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({
          mapTitle: state.mapTitle,
          axis: state.axis,
          appearance,
        }),
      );
    } catch {
      // Storage may be disabled or full. Images and placements are intentionally not stored.
    }
  }

  function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function isFontOption(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(FONT_OPTIONS, value);
  }

  function nextId(prefix) {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function captureSnapshot() {
    return cloneData(state);
  }

  function snapshotSignature(snapshot) {
    return JSON.stringify(snapshot);
  }

  function commitBefore(before) {
    if (!before || snapshotSignature(before) === snapshotSignature(state)) return false;
    undoStack.push(before);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    pruneUnusedAssets();
    updateHistoryButtons();
    savePreferencesSoon();
    return true;
  }

  function pruneUnusedAssets() {
    const referencedIds = new Set();
    const collect = (snapshot) => {
      for (const id of snapshot.libraryIds || []) referencedIds.add(id);
      for (const placement of snapshot.placements || []) referencedIds.add(placement.assetId);
      if (snapshot.backgroundAssetId) referencedIds.add(snapshot.backgroundAssetId);
      if (snapshot.outerBackgroundAssetId) referencedIds.add(snapshot.outerBackgroundAssetId);
    };

    collect(state);
    undoStack.forEach(collect);
    redoStack.forEach(collect);
    for (const id of assets.keys()) {
      if (!referencedIds.has(id)) assets.delete(id);
    }
  }

  function restoreSnapshot(snapshot) {
    state = cloneData(snapshot);
    resetLibrarySelectionState();
    const defaults = createDefaultState();
    if (!BACKGROUND_MODES.has(state.appearance.backgroundMode)) {
      state.appearance.backgroundMode = defaults.appearance.backgroundMode;
    }
    if (!BACKGROUND_MODES.has(state.appearance.outerBackgroundMode)) {
      state.appearance.outerBackgroundMode = defaults.appearance.outerBackgroundMode;
    }
    for (const key of [
      "outerBackgroundColor",
      "outerGradientStart",
      "outerGradientEnd",
    ]) {
      if (!isHexColor(state.appearance[key])) {
        state.appearance[key] = defaults.appearance[key];
      }
    }
    const backgroundOpacity = Number(state.appearance.backgroundOpacity);
    state.appearance.backgroundOpacity = Number.isFinite(backgroundOpacity)
      ? clamp(
          Math.round(backgroundOpacity),
          BACKGROUND_OPACITY_MIN,
          BACKGROUND_OPACITY_MAX,
        )
      : defaults.appearance.backgroundOpacity;
    state.appearance.axisArrowSize =
      normalizeRangeValue(
        state.appearance.axisArrowSize,
        AXIS_ARROW_SIZE_MIN,
        AXIS_ARROW_SIZE_MAX,
      ) ?? defaults.appearance.axisArrowSize;
    state.appearance.axisLineWidth =
      normalizeRangeValue(
        state.appearance.axisLineWidth,
        AXIS_LINE_WIDTH_MIN,
        AXIS_LINE_WIDTH_MAX,
        0.5,
      ) ?? defaults.appearance.axisLineWidth;
    state.appearance.axisOpacity =
      normalizeRangeValue(
        state.appearance.axisOpacity,
        AXIS_OPACITY_MIN,
        AXIS_OPACITY_MAX,
        5,
      ) ?? defaults.appearance.axisOpacity;
    if (!LABEL_LAYOUTS.has(state.appearance.labelLayout)) {
      state.appearance.labelLayout = "inside";
    }
    if (typeof state.appearance.verticalSideLabels !== "boolean") {
      state.appearance.verticalSideLabels = true;
    }
    state.libraryIds = state.libraryIds.filter((id) => assets.has(id));
    state.placements = state.placements.filter((placement) => assets.has(placement.assetId));
    if (!assets.has(state.backgroundAssetId)) state.backgroundAssetId = null;
    if (!assets.has(state.outerBackgroundAssetId)) state.outerBackgroundAssetId = null;
    if (state.appearance.backgroundMode === "image" && !state.backgroundAssetId) {
      state.appearance.backgroundMode = "solid";
    }
    if (
      state.appearance.outerBackgroundMode === "image" &&
      !state.outerBackgroundAssetId
    ) {
      state.appearance.outerBackgroundMode = "solid";
    }
    if (!state.placements.some((placement) => placement.id === selectedId)) selectedId = null;
    renderAll();
    savePreferencesSoon();
  }

  function undo() {
    finishPendingEdit();
    const previous = undoStack.pop();
    if (!previous) return;
    redoStack.push(captureSnapshot());
    restoreSnapshot(previous);
    showToast("ひとつ前の状態に戻しました");
  }

  function redo() {
    finishPendingEdit();
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(captureSnapshot());
    restoreSnapshot(next);
    showToast("操作をやり直しました");
  }

  function beginPendingEdit(element) {
    if (pendingEdit?.element === element) return;
    finishPendingEdit();
    pendingEdit = { element, before: captureSnapshot() };
  }

  function finishPendingEdit(element = null) {
    if (!pendingEdit) return;
    if (element && pendingEdit.element !== element) return;
    const { before } = pendingEdit;
    pendingEdit = null;
    commitBefore(before);
  }

  function bindStatefulControl(element, apply, refresh, eventName = "input") {
    const begin = () => beginPendingEdit(element);
    element.addEventListener("focus", begin);
    element.addEventListener("pointerdown", begin);
    element.addEventListener(eventName, () => {
      begin();
      apply();
      refresh();
      if (eventName === "change") finishPendingEdit(element);
    });
    if (eventName !== "change") {
      element.addEventListener("change", () => finishPendingEdit(element));
    }
    element.addEventListener("blur", () => finishPendingEdit(element));
  }

  function getSelectedPlacement() {
    return state.placements.find((placement) => placement.id === selectedId) || null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function pixelValue(style, property) {
    return Number.parseFloat(style[property]) || 0;
  }

  function updateMapScale(width = dom.mapStage.clientWidth) {
    const measuredWidth = width || dom.mapStage.clientWidth || MAP_SIZE;
    dom.mapStage.style.setProperty("--map-scale", String(measuredWidth / MAP_SIZE));
  }

  function getMapViewCenterRatio() {
    const mapRect = dom.mapComposition.getBoundingClientRect();
    const viewportRect = dom.mapViewport.getBoundingClientRect();
    if (!mapRect.width || !mapRect.height) return { x: 0.5, y: 0.5 };
    const viewportCenterX =
      viewportRect.left + dom.mapViewport.clientLeft + dom.mapViewport.clientWidth / 2;
    const viewportCenterY =
      viewportRect.top + dom.mapViewport.clientTop + dom.mapViewport.clientHeight / 2;
    return {
      x: clamp((viewportCenterX - mapRect.left) / mapRect.width, 0, 1),
      y: clamp((viewportCenterY - mapRect.top) / mapRect.height, 0, 1),
    };
  }

  function restoreMapViewCenter(centerRatio) {
    window.cancelAnimationFrame(mapViewScrollFrame);
    pendingMapViewCenterRatio = centerRatio;
    mapViewScrollFrame = window.requestAnimationFrame(() => {
      mapViewScrollFrame = 0;
      const mapRect = dom.mapComposition.getBoundingClientRect();
      const viewportRect = dom.mapViewport.getBoundingClientRect();
      const viewportCenterX =
        viewportRect.left + dom.mapViewport.clientLeft + dom.mapViewport.clientWidth / 2;
      const viewportCenterY =
        viewportRect.top + dom.mapViewport.clientTop + dom.mapViewport.clientHeight / 2;
      const mapPointX = mapRect.left + mapRect.width * centerRatio.x;
      const mapPointY = mapRect.top + mapRect.height * centerRatio.y;
      dom.mapViewport.scrollLeft += mapPointX - viewportCenterX;
      dom.mapViewport.scrollTop += mapPointY - viewportCenterY;
      if (pendingMapViewCenterRatio === centerRatio) pendingMapViewCenterRatio = null;
    });
  }

  function renderMapViewControls() {
    const roundedZoom = Math.round(mapViewZoom);
    const zoomText = `${roundedZoom}%`;
    dom.mapZoomInput.value = String(roundedZoom);
    dom.mapZoomInput.setAttribute("aria-valuetext", `${roundedZoom}パーセント`);
    dom.mapZoomOutput.textContent = zoomText;
    dom.zoomOutButton.disabled = roundedZoom <= MAP_ZOOM_MIN;
    dom.zoomInButton.disabled = roundedZoom >= MAP_ZOOM_MAX;
    dom.fitMapButton.setAttribute("aria-pressed", String(mapViewMode === "fit"));
    dom.mapViewport.setAttribute(
      "aria-label",
      `属性マップの表示領域、現在${zoomText}${mapViewMode === "fit" ? "、ウィンドウに合わせて表示中" : ""}`,
    );
  }

  function announceMapView(message) {
    dom.mapZoomStatus.textContent = "";
    window.requestAnimationFrame(() => {
      dom.mapZoomStatus.textContent = message;
    });
  }

  function setMapViewZoom(
    zoom,
    { mode = "manual", announce = false, preserveCenter = true } = {},
  ) {
    const nextZoom = clamp(Math.round(Number(zoom) || 100), MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    const centerRatio = preserveCenter
      ? pendingMapViewCenterRatio || getMapViewCenterRatio()
      : { x: 0.5, y: 0.5 };
    mapViewZoom = nextZoom;
    mapViewMode = mode;
    const scale = nextZoom / 100;
    dom.mapComposition.style.setProperty("--map-display-size", `${MAP_SIZE * scale}px`);
    dom.mapComposition.style.setProperty("--map-view-scale", String(scale));
    renderMapViewControls();
    updateMapScale();
    restoreMapViewCenter(centerRatio);
    if (announce) {
      const message =
        mode === "fit"
          ? `属性マップをウィンドウに合わせました。表示倍率は${nextZoom}パーセントです。`
          : `属性マップの表示倍率を${nextZoom}パーセントにしました。`;
      announceMapView(message);
    }
  }

  function calculateMapViewportHeight() {
    const visualViewport = window.visualViewport;
    const visibleHeight = visualViewport?.height || document.documentElement.clientHeight;
    if (window.matchMedia("(max-width: 880px)").matches) {
      return clamp(
        Math.floor(visibleHeight * MAP_VIEWPORT_MOBILE_RATIO),
        MAP_VIEWPORT_MIN_HEIGHT,
        MAP_VIEWPORT_MOBILE_MAX_HEIGHT,
      );
    }

    const visibleBottom = visualViewport
      ? visualViewport.offsetTop + visualViewport.height
      : document.documentElement.clientHeight;
    const viewportTop = dom.mapViewport.getBoundingClientRect().top;
    const statusStyle = window.getComputedStyle(dom.selectionStatus);
    const panelStyle = window.getComputedStyle(dom.canvasPanel);
    const reservedBelow =
      dom.selectionStatus.offsetHeight +
      pixelValue(statusStyle, "marginTop") +
      pixelValue(statusStyle, "marginBottom") +
      pixelValue(panelStyle, "paddingBottom") +
      pixelValue(panelStyle, "borderBottomWidth") +
      4;
    return clamp(
      Math.floor(visibleBottom - viewportTop - reservedBelow),
      MAP_VIEWPORT_MIN_HEIGHT,
      MAP_VIEWPORT_MAX_HEIGHT,
    );
  }

  function calculateFitZoom() {
    const frameStyle = window.getComputedStyle(dom.mapFrame);
    const viewportWidth = dom.mapViewport.clientWidth;
    const viewportHeight = dom.mapViewport.clientHeight;
    const frameChromeWidth =
      pixelValue(frameStyle, "paddingLeft") +
      pixelValue(frameStyle, "paddingRight") +
      pixelValue(frameStyle, "borderLeftWidth") +
      pixelValue(frameStyle, "borderRightWidth");
    const frameChromeHeight =
      pixelValue(frameStyle, "paddingTop") +
      pixelValue(frameStyle, "paddingBottom") +
      pixelValue(frameStyle, "borderTopWidth") +
      pixelValue(frameStyle, "borderBottomWidth");
    const widthScale = Math.max(0, viewportWidth - frameChromeWidth - 2) / MAP_SIZE;
    const heightScale = Math.max(0, viewportHeight - frameChromeHeight - 2) / MAP_SIZE;
    return clamp(
      Math.floor(Math.min(widthScale, heightScale, 1) * 100),
      MAP_ZOOM_MIN,
      100,
    );
  }

  function refreshMapView({ announce = false } = {}) {
    dom.mapViewport.style.height = `${calculateMapViewportHeight()}px`;
    if (mapViewMode === "fit") {
      setMapViewZoom(calculateFitZoom(), {
        mode: "fit",
        announce,
        preserveCenter: false,
      });
    } else {
      renderMapViewControls();
    }
  }

  function scheduleMapViewRefresh() {
    if (mapViewLayoutFrame) return;
    mapViewLayoutFrame = window.requestAnimationFrame(() => {
      mapViewLayoutFrame = 0;
      refreshMapView();
    });
  }

  function adjustMapViewZoom(amount) {
    setMapViewZoom(mapViewZoom + amount, { mode: "manual", announce: true });
  }

  function normalizeRangeValue(value, min, max, step = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const snapped = Math.round(number / step) * step;
    return clamp(Number(snapped.toFixed(4)), min, max);
  }

  function captionIsVisible(placement) {
    return placement.showName && Boolean(placement.name.trim());
  }

  function constrainPlacement(placement) {
    placement.size = clamp(Math.round(placement.size), MIN_CHARACTER_SIZE, MAX_CHARACTER_SIZE);
    const extraHeight = captionIsVisible(placement) ? CAPTION_SPACE : 0;
    placement.x = clamp(placement.x, 0, MAP_SIZE - placement.size);
    placement.y = clamp(placement.y, 0, MAP_SIZE - placement.size - extraHeight);
    placement.x = Math.round(placement.x * 10) / 10;
    placement.y = Math.round(placement.y * 10) / 10;
    return placement;
  }

  function createPlacement(assetId, x, y) {
    return constrainPlacement({
      id: nextId("placement"),
      assetId,
      x,
      y,
      size: DEFAULT_CHARACTER_SIZE,
      name: "",
      borderColor: "#ffffff",
      borderWidth: 3,
      shape: "square",
      showName: true,
    });
  }

  function suggestedPlacementPosition(index = state.placements.length) {
    const offsets = [
      [0, 0],
      [-72, -52],
      [78, 54],
      [82, -70],
      [-88, 74],
      [0, 104],
      [-116, 4],
      [116, 4],
    ];
    const [offsetX, offsetY] = offsets[index % offsets.length];
    return {
      x: MAP_SIZE / 2 - DEFAULT_CHARACTER_SIZE / 2 + offsetX,
      y: MAP_SIZE / 2 - DEFAULT_CHARACTER_SIZE / 2 + offsetY,
    };
  }

  function addPlacement(assetId, position = null, before = null) {
    if (!assets.has(assetId)) return null;
    const snapshot = before || captureSnapshot();
    const point = position || suggestedPlacementPosition();
    const placement = createPlacement(
      assetId,
      point.x - (position ? DEFAULT_CHARACTER_SIZE / 2 : 0),
      point.y - (position ? DEFAULT_CHARACTER_SIZE / 2 : 0),
    );
    state.placements.push(placement);
    selectedId = placement.id;
    commitBefore(snapshot);
    renderAll();
    const node = dom.placementLayer.querySelector(`[data-placement-id="${placement.id}"]`);
    node?.focus({ preventScroll: true });
    return placement;
  }

  function addPlacementWithoutCommit(assetId, position, offsetIndex = 0) {
    if (!assets.has(assetId)) return null;
    const base = position || suggestedPlacementPosition(state.placements.length + offsetIndex);
    const placement = createPlacement(
      assetId,
      base.x - (position ? DEFAULT_CHARACTER_SIZE / 2 : 0) + offsetIndex * 16,
      base.y - (position ? DEFAULT_CHARACTER_SIZE / 2 : 0) + offsetIndex * 16,
    );
    state.placements.push(placement);
    selectedId = placement.id;
    return placement;
  }

  function deleteSelected() {
    const index = state.placements.findIndex((placement) => placement.id === selectedId);
    if (index < 0) return;
    const before = captureSnapshot();
    state.placements.splice(index, 1);
    selectedId = null;
    commitBefore(before);
    renderAll();
    showToast("キャラクターを削除しました");
  }

  function duplicateSelected() {
    const source = getSelectedPlacement();
    if (!source) return;
    const before = captureSnapshot();
    const copy = cloneData(source);
    copy.id = nextId("placement");
    copy.x += 22;
    copy.y += 22;
    constrainPlacement(copy);
    state.placements.push(copy);
    selectedId = copy.id;
    commitBefore(before);
    renderAll();
    const node = dom.placementLayer.querySelector(`[data-placement-id="${copy.id}"]`);
    node?.focus({ preventScroll: true });
    showToast("キャラクターを複製しました");
  }

  function selectPlacement(id, bringToFront = false, before = null) {
    const index = state.placements.findIndex((placement) => placement.id === id);
    if (index < 0) return;
    selectedId = id;

    if (bringToFront && index !== state.placements.length - 1) {
      const placement = state.placements.splice(index, 1)[0];
      state.placements.push(placement);
      const node = dom.placementLayer.querySelector(`[data-placement-id="${id}"]`);
      if (node) dom.placementLayer.append(node);
      if (before) commitBefore(before);
    }

    updateSelectionVisuals();
    syncCharacterSettings();
    updateSelectionStatus();
  }

  function clearSelection() {
    if (!selectedId) return;
    selectedId = null;
    updateSelectionVisuals();
    syncCharacterSettings();
    updateSelectionStatus();
  }

  async function handleFiles(fileList, options = {}) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const validFiles = files.filter(
      (file) => SUPPORTED_TYPES.has(file.type) || SUPPORTED_EXTENSIONS.test(file.name),
    );
    const rejectedCount = files.length - validFiles.length;
    if (!validFiles.length) {
      showToast("PNG・JPEG・WebPの画像を選んでください", true);
      return;
    }

    const epoch = resetEpoch;
    const generation = libraryLoadGeneration;
    const requestId = ++libraryLoadRequestId;
    dom.chooseFilesButton.disabled = true;
    dom.chooseFilesButton.textContent = "読み込み中…";

    try {
      const results = await Promise.allSettled(validFiles.map(readImageFile));
      if (epoch !== resetEpoch || generation !== libraryLoadGeneration) return;

      const before = captureSnapshot();
      const loadedAssets = [];
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const asset = result.value;
        assets.set(asset.id, asset);
        state.libraryIds.push(asset.id);
        loadedAssets.push(asset);
      }

      if (options.placeAt && loadedAssets.length) {
        loadedAssets.forEach((asset, index) => addPlacementWithoutCommit(asset.id, options.placeAt, index));
      }

      if (loadedAssets.length) {
        commitBefore(before);
        renderAll();
        const suffix = rejectedCount || results.some((result) => result.status === "rejected")
          ? "（読み込めないファイルは除外しました）"
          : "";
        showToast(`${loadedAssets.length}枚の画像を追加しました${suffix}`);
      } else {
        showToast("画像を読み込めませんでした。ファイルを確認してください", true);
      }
    } finally {
      if (requestId === libraryLoadRequestId) {
        dom.chooseFilesButton.disabled = false;
        dom.chooseFilesButton.textContent = "ファイルを選択";
        dom.fileInput.value = "";
      }
    }
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"));
      reader.onload = () => {
        const src = String(reader.result || "");
        const image = new Image();
        image.onload = () => {
          resolve({
            id: nextId("asset"),
            src,
            fileName: file.name || "画像",
            width: image.naturalWidth,
            height: image.naturalHeight,
            image,
          });
        };
        image.onerror = () => reject(new Error("画像をデコードできませんでした"));
        image.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  function getBackgroundUploadTarget(layer) {
    const isOuter = layer === "outer";
    return {
      assetKey: isOuter ? "outerBackgroundAssetId" : "backgroundAssetId",
      buttonText: isOuter ? "外側の画像を選択" : "内側の画像を選択",
      input: isOuter ? dom.outerBackgroundImageInput : dom.backgroundImageInput,
      label: isOuter ? "外側背景" : "内側背景",
      modeKey: isOuter ? "outerBackgroundMode" : "backgroundMode",
      removeButton: isOuter
        ? dom.removeOuterBackgroundImageButton
        : dom.removeBackgroundImageButton,
      chooseButton: isOuter
        ? dom.chooseOuterBackgroundImageButton
        : dom.chooseBackgroundImageButton,
    };
  }

  async function handleBackgroundFile(fileList, layer = "inner") {
    const file = Array.from(fileList || [])[0];
    if (!file) return;
    const target = getBackgroundUploadTarget(layer);
    if (!SUPPORTED_TYPES.has(file.type) && !SUPPORTED_EXTENSIONS.test(file.name)) {
      target.input.value = "";
      showToast("背景にはPNG・JPEG・WebPの画像を選んでください", true);
      return;
    }

    const epoch = resetEpoch;
    const requestId = ++backgroundLoadRequests[layer];
    target.chooseButton.disabled = true;
    target.removeButton.disabled = true;
    target.chooseButton.textContent = "読み込み中…";

    try {
      const asset = await readImageFile(file);
      if (epoch !== resetEpoch || requestId !== backgroundLoadRequests[layer]) return;

      const before = captureSnapshot();
      assets.set(asset.id, asset);
      state[target.assetKey] = asset.id;
      state.appearance[target.modeKey] = "image";
      if (layer === "inner") state.appearance.activePreset = "custom";
      commitBefore(before);
      renderAppearance();
      showToast(`${target.label}画像「${asset.fileName}」を設定しました`);
    } catch {
      if (requestId === backgroundLoadRequests[layer]) {
        showToast(`${target.label}画像を読み込めませんでした。ファイルを確認してください`, true);
      }
    } finally {
      if (requestId === backgroundLoadRequests[layer]) {
        target.chooseButton.disabled = false;
        target.chooseButton.textContent = target.buttonText;
        target.input.value = "";
        renderAppearance();
      }
    }
  }

  function removeBackgroundImage(layer = "inner") {
    const target = getBackgroundUploadTarget(layer);
    if (!state[target.assetKey] || target.chooseButton.disabled) return;
    const before = captureSnapshot();
    state[target.assetKey] = null;
    if (state.appearance[target.modeKey] === "image") {
      state.appearance[target.modeKey] = "solid";
    }
    if (layer === "inner") state.appearance.activePreset = "custom";
    commitBefore(before);
    renderAppearance();
    showToast(`${target.label}画像を削除しました`);
  }

  function renderAll() {
    renderAxis();
    renderAppearance();
    renderLibrary();
    renderPlacements();
    syncCharacterSettings();
    updateHistoryButtons();
    updateSelectionStatus();
    updateMapEmptyHint();
  }

  function truncateCharacters(text, maxCharacters) {
    const characters = Array.from(text);
    if (characters.length <= maxCharacters) return text;
    return `${characters.slice(0, Math.max(0, maxCharacters - 1)).join("")}…`;
  }

  function renderAxisLabel(label, key, value) {
    const useVerticalLimit =
      state.appearance.labelLayout === "outside" &&
      state.appearance.verticalSideLabels &&
      (key === "left" || key === "right");
    label.textContent = useVerticalLimit
      ? truncateCharacters(value, OUTSIDE_VERTICAL_LABEL_MAX_CHARACTERS)
      : value;
    if (value.trim()) label.title = value;
    else label.removeAttribute("title");
  }

  function renderAxis() {
    const title = state.mapTitle.trim();
    dom.mapTitleInput.value = state.mapTitle;
    dom.mapTitleDisplay.textContent = title;
    dom.mapTitleDisplay.hidden = !title;
    if (title) dom.mapTitleDisplay.title = state.mapTitle;
    else dom.mapTitleDisplay.removeAttribute("title");

    const bindings = [
      [dom.topLabelInput, dom.topAxisLabel, "top", state.axis.top],
      [dom.bottomLabelInput, dom.bottomAxisLabel, "bottom", state.axis.bottom],
      [dom.leftLabelInput, dom.leftAxisLabel, "left", state.axis.left],
      [dom.rightLabelInput, dom.rightAxisLabel, "right", state.axis.right],
    ];
    for (const [input, label, key, value] of bindings) {
      input.value = value;
      renderAxisLabel(label, key, value);
    }
  }

  function getFontStack() {
    return FONT_OPTIONS[state.appearance.fontFamily] || FONT_OPTIONS["yu-gothic-ui"];
  }

  function resetPreviewBackground(element) {
    element.style.backgroundColor = "transparent";
    element.style.backgroundImage = "none";
    element.style.backgroundPosition = "center";
    element.style.backgroundSize = "auto";
    element.style.backgroundRepeat = "no-repeat";
  }

  function getBackgroundSettings(layer) {
    if (layer === "outer") {
      return {
        mode: state.appearance.outerBackgroundMode,
        color: state.appearance.outerBackgroundColor,
        gradientStart: state.appearance.outerGradientStart,
        gradientEnd: state.appearance.outerGradientEnd,
        assetId: state.outerBackgroundAssetId,
      };
    }
    return {
      mode: state.appearance.backgroundMode,
      color: state.appearance.backgroundColor,
      gradientStart: state.appearance.gradientStart,
      gradientEnd: state.appearance.gradientEnd,
      assetId: state.backgroundAssetId,
    };
  }

  function applyPreviewBackground(element, settings, showTransparencyGrid) {
    const asset = assets.get(settings.assetId);
    resetPreviewBackground(element);

    if (settings.mode === "solid") {
      element.style.backgroundColor = settings.color;
      return;
    }

    if (settings.mode === "gradient") {
      element.style.backgroundImage =
        `linear-gradient(135deg, ${settings.gradientStart}, ${settings.gradientEnd})`;
      element.style.backgroundSize = "cover";
      return;
    }

    if (settings.mode === "image" && asset && !showTransparencyGrid) {
      element.style.backgroundImage = `url("${asset.src}")`;
      element.style.backgroundPosition = "center";
      element.style.backgroundSize = "cover";
      return;
    }

    if (!showTransparencyGrid) return;
    const imageLayer = settings.mode === "image" && asset ? `url("${asset.src}"), ` : "";
    element.style.backgroundColor = "#ffffff";
    element.style.backgroundImage = `${imageLayer}${TRANSPARENCY_GRID}`;
    element.style.backgroundPosition = imageLayer
      ? "center, 0 0, 0 8px, 8px -8px, -8px 0"
      : "0 0, 0 8px, 8px -8px, -8px 0";
    element.style.backgroundSize = imageLayer
      ? "cover, 16px 16px, 16px 16px, 16px 16px, 16px 16px"
      : "16px 16px";
    element.style.backgroundRepeat = imageLayer
      ? "no-repeat, repeat, repeat, repeat, repeat"
      : "repeat";
  }

  function applyMapBackground() {
    const isOutsideLayout = state.appearance.labelLayout === "outside";
    resetPreviewBackground(dom.mapStage);
    applyPreviewBackground(
      dom.mapComposition,
      isOutsideLayout ? getBackgroundSettings("outer") : { mode: "transparent" },
      true,
    );
    applyPreviewBackground(dom.mapInnerBackground, getBackgroundSettings("inner"), false);
    dom.mapInnerBackground.style.opacity = String(state.appearance.backgroundOpacity / 100);
  }

  function getAxisColors() {
    if (state.appearance.axisMode === "gradient") {
      return {
        start: state.appearance.axisGradientStart,
        end: state.appearance.axisGradientEnd,
      };
    }
    return {
      start: state.appearance.axisColor,
      end: state.appearance.axisColor,
    };
  }

  function backgroundSettingsHasContent(settings) {
    if (settings.mode === "solid" || settings.mode === "gradient") return true;
    if (settings.mode === "image") return assets.has(settings.assetId);
    return false;
  }

  function renderAppearance() {
    const axisColors = getAxisColors();
    const backgroundAsset = assets.get(state.backgroundAssetId);
    const outerBackgroundAsset = assets.get(state.outerBackgroundAssetId);
    const axisInset = (100 - state.appearance.axisLength) / 2;
    const isOutsideLayout = state.appearance.labelLayout === "outside";
    dom.mapComposition.classList.toggle("is-layout-outside", isOutsideLayout);
    dom.mapComposition.classList.toggle(
      "is-side-labels-vertical",
      isOutsideLayout && state.appearance.verticalSideLabels,
    );
    applyMapBackground();
    dom.mapComposition.style.setProperty("--map-axis-color", state.appearance.axisColor);
    dom.mapComposition.style.setProperty("--map-axis-start-color", axisColors.start);
    dom.mapComposition.style.setProperty("--map-axis-end-color", axisColors.end);
    dom.mapComposition.style.setProperty(
      "--map-axis-horizontal",
      `linear-gradient(90deg, ${axisColors.start}, ${axisColors.end})`,
    );
    dom.mapComposition.style.setProperty(
      "--map-axis-vertical",
      `linear-gradient(180deg, ${axisColors.start}, ${axisColors.end})`,
    );
    dom.mapComposition.style.setProperty("--map-axis-inset", `${axisInset}%`);
    dom.mapComposition.style.setProperty(
      "--map-axis-arrow-size",
      `${state.appearance.axisArrowSize}px`,
    );
    dom.mapComposition.style.setProperty(
      "--map-axis-arrow-base-size",
      `${Number(((state.appearance.axisArrowSize * 7) / 6).toFixed(4))}px`,
    );
    dom.mapComposition.style.setProperty(
      "--map-axis-line-width",
      `${state.appearance.axisLineWidth}px`,
    );
    dom.mapComposition.style.setProperty(
      "--map-axis-opacity",
      String(state.appearance.axisOpacity / 100),
    );
    dom.mapComposition.style.setProperty("--map-text-color", state.appearance.textColor);
    dom.mapComposition.style.setProperty("--map-font-family", getFontStack());

    dom.insideLabelLayoutButton.setAttribute("aria-pressed", String(!isOutsideLayout));
    dom.outsideLabelLayoutButton.setAttribute("aria-pressed", String(isOutsideLayout));
    dom.outsideLabelOptions.hidden = !isOutsideLayout;
    dom.verticalSideLabelsInput.checked = state.appearance.verticalSideLabels;
    dom.outerBackgroundGroup.disabled = !isOutsideLayout;

    dom.backgroundModeInput.value = state.appearance.backgroundMode;
    dom.backgroundSolidFields.hidden = state.appearance.backgroundMode !== "solid";
    dom.backgroundGradientFields.hidden = state.appearance.backgroundMode !== "gradient";
    dom.backgroundImageFields.hidden = state.appearance.backgroundMode !== "image";
    dom.backgroundTransparentHint.hidden = state.appearance.backgroundMode !== "transparent";
    dom.backgroundImageEmpty.hidden = Boolean(backgroundAsset);
    dom.backgroundImagePreview.hidden = !backgroundAsset;
    if (backgroundAsset) dom.backgroundImageThumbnail.src = backgroundAsset.src;
    else dom.backgroundImageThumbnail.removeAttribute("src");
    dom.backgroundImageName.textContent = backgroundAsset?.fileName || "";
    dom.removeBackgroundImageButton.disabled =
      !backgroundAsset || dom.chooseBackgroundImageButton.disabled;
    dom.backgroundColorInput.value = state.appearance.backgroundColor;
    dom.gradientStartInput.value = state.appearance.gradientStart;
    dom.gradientEndInput.value = state.appearance.gradientEnd;
    dom.backgroundOpacityInput.value = String(state.appearance.backgroundOpacity);
    dom.backgroundOpacityOutput.textContent = `${state.appearance.backgroundOpacity}%`;
    const backgroundOpacityIsDisabled = state.appearance.backgroundMode === "transparent";
    dom.backgroundOpacityInput.disabled = backgroundOpacityIsDisabled;
    dom.backgroundOpacityField.classList.toggle("is-disabled", backgroundOpacityIsDisabled);

    dom.outerBackgroundModeInput.value = state.appearance.outerBackgroundMode;
    dom.outerBackgroundSolidFields.hidden = state.appearance.outerBackgroundMode !== "solid";
    dom.outerBackgroundGradientFields.hidden =
      state.appearance.outerBackgroundMode !== "gradient";
    dom.outerBackgroundImageFields.hidden = state.appearance.outerBackgroundMode !== "image";
    dom.outerBackgroundTransparentHint.hidden =
      state.appearance.outerBackgroundMode !== "transparent";
    dom.outerBackgroundImageEmpty.hidden = Boolean(outerBackgroundAsset);
    dom.outerBackgroundImagePreview.hidden = !outerBackgroundAsset;
    if (outerBackgroundAsset) {
      dom.outerBackgroundImageThumbnail.src = outerBackgroundAsset.src;
    } else {
      dom.outerBackgroundImageThumbnail.removeAttribute("src");
    }
    dom.outerBackgroundImageName.textContent = outerBackgroundAsset?.fileName || "";
    dom.removeOuterBackgroundImageButton.disabled =
      !outerBackgroundAsset || dom.chooseOuterBackgroundImageButton.disabled;
    dom.outerBackgroundColorInput.value = state.appearance.outerBackgroundColor;
    dom.outerGradientStartInput.value = state.appearance.outerGradientStart;
    dom.outerGradientEndInput.value = state.appearance.outerGradientEnd;

    dom.axisModeInput.value = state.appearance.axisMode;
    dom.axisSolidFields.hidden = state.appearance.axisMode !== "solid";
    dom.axisGradientFields.hidden = state.appearance.axisMode !== "gradient";
    dom.axisColorInput.value = state.appearance.axisColor;
    dom.axisGradientStartInput.value = state.appearance.axisGradientStart;
    dom.axisGradientEndInput.value = state.appearance.axisGradientEnd;
    dom.axisLengthInput.value = String(state.appearance.axisLength);
    dom.axisLengthOutput.textContent = `${state.appearance.axisLength}%`;
    dom.axisArrowSizeInput.value = String(state.appearance.axisArrowSize);
    dom.axisArrowSizeOutput.textContent = `${state.appearance.axisArrowSize} px`;
    dom.axisArrowSizeInput.setAttribute(
      "aria-valuetext",
      `${state.appearance.axisArrowSize}ピクセル`,
    );
    dom.axisLineWidthInput.value = String(state.appearance.axisLineWidth);
    dom.axisLineWidthOutput.textContent = `${state.appearance.axisLineWidth} px`;
    dom.axisLineWidthInput.setAttribute(
      "aria-valuetext",
      `${state.appearance.axisLineWidth}ピクセル`,
    );
    dom.axisOpacityInput.value = String(state.appearance.axisOpacity);
    dom.axisOpacityOutput.textContent = `${state.appearance.axisOpacity}%`;
    dom.axisOpacityInput.setAttribute(
      "aria-valuetext",
      `${state.appearance.axisOpacity}パーセント`,
    );
    dom.fontFamilyInput.value = state.appearance.fontFamily;
    dom.textColorInput.value = state.appearance.textColor;
    dom.backgroundColorValue.textContent = state.appearance.backgroundColor.toUpperCase();
    dom.gradientStartValue.textContent = state.appearance.gradientStart.toUpperCase();
    dom.gradientEndValue.textContent = state.appearance.gradientEnd.toUpperCase();
    dom.outerBackgroundColorValue.textContent =
      state.appearance.outerBackgroundColor.toUpperCase();
    dom.outerGradientStartValue.textContent = state.appearance.outerGradientStart.toUpperCase();
    dom.outerGradientEndValue.textContent = state.appearance.outerGradientEnd.toUpperCase();
    dom.axisColorValue.textContent = state.appearance.axisColor.toUpperCase();
    dom.axisGradientStartValue.textContent = state.appearance.axisGradientStart.toUpperCase();
    dom.axisGradientEndValue.textContent = state.appearance.axisGradientEnd.toUpperCase();
    dom.textColorValue.textContent = state.appearance.textColor.toUpperCase();
    const innerBackgroundIsVisible =
      state.appearance.backgroundOpacity > 0 &&
      backgroundSettingsHasContent(getBackgroundSettings("inner"));
    const currentBackgroundIsVisible = isOutsideLayout
      ? innerBackgroundIsVisible || backgroundSettingsHasContent(getBackgroundSettings("outer"))
      : innerBackgroundIsVisible;
    dom.includeBackgroundInput.disabled = !currentBackgroundIsVisible;
    dom.includeBackgroundInput.closest(".checkbox-row")?.classList.toggle(
      "is-disabled",
      !currentBackgroundIsVisible,
    );

    for (const button of dom.presetButtons) {
      const isActive = button.dataset.preset === state.appearance.activePreset;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    }
  }

  function resetLibrarySelectionState() {
    librarySelectionMode = false;
    selectedLibraryAssetIds.clear();
  }

  function setLibrarySelectionMode(enabled) {
    librarySelectionMode = Boolean(enabled && state.libraryIds.length);
    selectedLibraryAssetIds.clear();
    renderLibrary();

    if (librarySelectionMode) {
      dom.imageLibrary.querySelector(".library-card")?.focus();
    } else if (state.libraryIds.length) {
      dom.startLibrarySelectionButton.focus();
    }
  }

  function toggleLibraryAssetSelection(assetId) {
    if (!librarySelectionMode || !state.libraryIds.includes(assetId)) return;
    if (selectedLibraryAssetIds.has(assetId)) selectedLibraryAssetIds.delete(assetId);
    else selectedLibraryAssetIds.add(assetId);
    renderLibrary();
    dom.imageLibrary.querySelector(`[data-asset-id="${assetId}"]`)?.focus();
  }

  function toggleAllLibraryAssets() {
    if (!librarySelectionMode || !state.libraryIds.length) return;
    const allSelected = selectedLibraryAssetIds.size === state.libraryIds.length;
    selectedLibraryAssetIds.clear();
    if (!allSelected) {
      for (const assetId of state.libraryIds) selectedLibraryAssetIds.add(assetId);
    }
    renderLibrary();
    dom.selectAllLibraryButton.focus();
  }

  function deleteLibraryAssets(assetIds, deleteAll = false) {
    const requestedIds = new Set(assetIds || []);
    const existingIds = state.libraryIds.filter((assetId) => requestedIds.has(assetId));
    if (!existingIds.length) return false;

    const deletingIds = new Set(existingIds);
    const placementCount = state.placements.filter((placement) =>
      deletingIds.has(placement.assetId),
    ).length;
    const imageDescription = deleteAll
      ? `追加した${existingIds.length}枚をすべて削除します。`
      : `選択した${existingIds.length}枚を画像一覧から削除します。`;
    const placementDescription = placementCount
      ? `マップ上の${placementCount}個の配置も削除されます。`
      : "マップ上の配置は削除されません。";
    const settingsDescription = deleteAll
      ? "軸・背景・タイトルなどの設定は残ります。\n\n"
      : "";
    const confirmed = window.confirm(
      `${imageDescription}\n${placementDescription}\n${settingsDescription}「元に戻す」で復元できます。よろしいですか？`,
    );
    if (!confirmed) return false;

    finishPendingEdit();
    const before = captureSnapshot();
    if (existingIds.length === state.libraryIds.length) {
      libraryLoadGeneration += 1;
      libraryLoadRequestId += 1;
      dom.fileInput.value = "";
      dom.chooseFilesButton.disabled = false;
      dom.chooseFilesButton.textContent = "ファイルを選択";
    }
    state.libraryIds = state.libraryIds.filter((assetId) => !deletingIds.has(assetId));
    state.placements = state.placements.filter(
      (placement) => !deletingIds.has(placement.assetId),
    );
    if (!state.placements.some((placement) => placement.id === selectedId)) selectedId = null;
    resetLibrarySelectionState();
    commitBefore(before);
    renderAll();

    const message = placementCount
      ? `${existingIds.length}枚の画像とマップ上の${placementCount}個の配置を削除しました`
      : `${existingIds.length}枚の画像を削除しました`;
    showToast(message);
    if (state.libraryIds.length) dom.startLibrarySelectionButton.focus();
    else dom.chooseFilesButton.focus();
    return true;
  }

  function renderLibrary() {
    const currentLibraryIds = new Set(state.libraryIds);
    for (const assetId of selectedLibraryAssetIds) {
      if (!currentLibraryIds.has(assetId)) selectedLibraryAssetIds.delete(assetId);
    }
    if (!state.libraryIds.length) resetLibrarySelectionState();

    const hasImages = state.libraryIds.length > 0;
    const allSelected =
      hasImages && selectedLibraryAssetIds.size === state.libraryIds.length;
    dom.libraryActions.hidden = !hasImages;
    dom.libraryDefaultActions.hidden = librarySelectionMode;
    dom.librarySelectionActions.hidden = !librarySelectionMode;
    dom.librarySelectionCount.textContent = `${selectedLibraryAssetIds.size}枚選択中`;
    dom.selectAllLibraryButton.textContent = allSelected ? "すべて解除" : "すべて選択";
    dom.deleteSelectedLibraryButton.disabled = selectedLibraryAssetIds.size === 0;
    dom.deleteSelectedLibraryButton.textContent = selectedLibraryAssetIds.size
      ? `選択を削除（${selectedLibraryAssetIds.size}）`
      : "選択を削除";
    dom.imageLibrary.classList.toggle("is-selecting", librarySelectionMode);
    dom.imageLibrary.setAttribute(
      "aria-label",
      librarySelectionMode ? "削除する画像を選択" : "アップロードした画像",
    );
    if (librarySelectionMode) {
      dom.imageLibrary.setAttribute("aria-describedby", "librarySelectionHelp");
    } else {
      dom.imageLibrary.removeAttribute("aria-describedby");
    }

    dom.imageLibrary.textContent = "";
    const fragment = document.createDocumentFragment();

    for (const assetId of state.libraryIds) {
      const asset = assets.get(assetId);
      if (!asset) continue;

      const item = document.createElement("div");
      item.setAttribute("role", "listitem");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "library-card";
      const isSelected = selectedLibraryAssetIds.has(assetId);
      button.classList.toggle("is-selection-mode", librarySelectionMode);
      button.classList.toggle("is-selected", isSelected);
      button.draggable = !librarySelectionMode;
      button.dataset.assetId = assetId;
      if (librarySelectionMode) {
        const action = isSelected ? "の選択を解除" : "を削除対象に選択";
        button.title = `${asset.fileName}${action}`;
        button.setAttribute("aria-label", `${asset.fileName}${action}`);
        button.setAttribute("aria-pressed", String(isSelected));
      } else {
        button.title = `${asset.fileName}をマップへ配置`;
        button.setAttribute("aria-label", `${asset.fileName}をマップへ配置`);
      }

      const image = document.createElement("img");
      image.src = asset.src;
      image.alt = "";
      image.draggable = false;

      const cardMark = document.createElement("span");
      cardMark.className = librarySelectionMode ? "library-card-select" : "library-card-add";
      cardMark.textContent = librarySelectionMode ? "✓" : "+";
      cardMark.setAttribute("aria-hidden", "true");

      button.append(image, cardMark);
      item.append(button);
      fragment.append(item);
    }

    dom.imageLibrary.append(fragment);
    dom.libraryEmpty.hidden = hasImages;
    dom.imageCount.textContent = `${state.libraryIds.length}枚`;
  }

  function getCaptionMetrics(placement) {
    const characterCount = Array.from(placement.name.trim()).length;
    const estimated = characterCount * 13 + 24;
    const width = clamp(estimated, Math.min(72, placement.size), Math.min(180, MAP_SIZE - 8));
    const centeredLeft = placement.x + placement.size / 2 - width / 2;
    const left = clamp(centeredLeft, 4, MAP_SIZE - width - 4);
    return { width, left };
  }

  function applyPlacementStyle(node, placement) {
    node.style.left = `${(placement.x / MAP_SIZE) * 100}%`;
    node.style.top = `${(placement.y / MAP_SIZE) * 100}%`;
    node.style.width = `${(placement.size / MAP_SIZE) * 100}%`;
    node.style.height = `${(placement.size / MAP_SIZE) * 100}%`;
    node.classList.toggle("is-near-right", placement.x + placement.size >= MAP_SIZE - 18);
    node.classList.toggle(
      "is-near-bottom",
      placement.y + placement.size + (captionIsVisible(placement) ? CAPTION_SPACE : 0) >= MAP_SIZE - 18,
    );

    const portrait = node.querySelector(".character-portrait");
    portrait.style.borderColor = placement.borderColor;
    portrait.style.borderWidth = `calc(${placement.borderWidth}px * var(--map-scale, 1))`;
    portrait.classList.toggle("is-circle", placement.shape === "circle");

    const caption = node.querySelector(".character-name");
    const visible = captionIsVisible(placement);
    caption.hidden = !visible;
    caption.textContent = placement.name;
    if (visible) {
      const metrics = getCaptionMetrics(placement);
      caption.style.left = `${((metrics.left - placement.x) / placement.size) * 100}%`;
      caption.style.width = `${(metrics.width / placement.size) * 100}%`;
    }
  }

  function renderPlacements() {
    dom.placementLayer.textContent = "";
    const fragment = document.createDocumentFragment();

    for (const placement of state.placements) {
      const asset = assets.get(placement.assetId);
      if (!asset) continue;

      const node = document.createElement("div");
      node.className = "character-node";
      node.dataset.placementId = placement.id;
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      node.setAttribute("aria-pressed", String(placement.id === selectedId));
      node.setAttribute(
        "aria-label",
        `${placement.name.trim() || asset.fileName}。ドラッグで移動、矢印キーで微調整`,
      );

      const portrait = document.createElement("div");
      portrait.className = "character-portrait";

      const image = document.createElement("img");
      image.src = asset.src;
      image.alt = "";
      image.draggable = false;
      portrait.append(image);

      const caption = document.createElement("span");
      caption.className = "character-name";

      const handle = document.createElement("span");
      handle.className = "resize-handle";
      handle.dataset.resizeHandle = "true";
      handle.setAttribute("aria-hidden", "true");

      node.append(portrait, caption, handle);
      node.classList.toggle("is-selected", placement.id === selectedId);
      applyPlacementStyle(node, placement);
      fragment.append(node);
    }

    dom.placementLayer.append(fragment);
    updateMapEmptyHint();
  }

  function updateSelectionVisuals() {
    for (const node of dom.placementLayer.querySelectorAll(".character-node")) {
      const selected = node.dataset.placementId === selectedId;
      node.classList.toggle("is-selected", selected);
      node.setAttribute("aria-pressed", String(selected));
    }
  }

  function syncCharacterSettings() {
    const placement = getSelectedPlacement();
    const hasSelection = Boolean(placement);
    dom.selectionEmpty.hidden = hasSelection;
    dom.characterSettings.hidden = !hasSelection;
    if (!placement) return;

    dom.characterNameInput.value = placement.name;
    dom.characterSizeInput.value = String(placement.size);
    dom.characterSizeOutput.textContent = `${placement.size} px`;
    dom.borderColorInput.value = placement.borderColor;
    dom.borderColorValue.textContent = placement.borderColor.toUpperCase();
    dom.borderWidthInput.value = String(placement.borderWidth);
    dom.showNameInput.checked = placement.showName;
    dom.squareShapeButton.setAttribute("aria-pressed", String(placement.shape === "square"));
    dom.circleShapeButton.setAttribute("aria-pressed", String(placement.shape === "circle"));
    const placementCount = state.placements.length;
    dom.applyStyleToAllButton.disabled = placementCount < 2;
    dom.applyStyleToAllButton.textContent = placementCount > 1
      ? `この見た目を全${placementCount}枚に適用`
      : "この見た目を全画像に適用";
    dom.applyStyleToAllHelp.textContent = placementCount > 1
      ? `サイズ・枠・形状・名前表示を全${placementCount}枚へ反映します。名前は維持し、端からはみ出す場合だけ位置を調整します`
      : "マップ上に2枚以上配置すると、見た目をまとめて適用できます";
  }

  function updateHistoryButtons() {
    dom.undoButton.disabled = undoStack.length === 0;
    dom.redoButton.disabled = redoStack.length === 0;
  }

  function updateMapEmptyHint() {
    dom.mapEmptyHint.hidden = state.placements.length > 0;
  }

  function updateSelectionStatus() {
    const placement = getSelectedPlacement();
    if (!state.placements.length) {
      dom.selectionStatus.textContent = "画像はまだ配置されていません。";
      return;
    }
    if (!placement) {
      dom.selectionStatus.textContent = `${state.placements.length}枚を配置中。画像を選ぶと編集できます。`;
      return;
    }
    const asset = assets.get(placement.assetId);
    const label = placement.name.trim() || asset?.fileName || "キャラクター";
    dom.selectionStatus.textContent = `「${label}」を選択中 — 右下のハンドルでもサイズを変えられます。`;
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.toggle("is-error", isError);
    dom.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
  }

  function updatesHaveBeenSeen() {
    try {
      return localStorage.getItem(UPDATES_SEEN_KEY) === CURRENT_UPDATE_VERSION;
    } catch {
      return false;
    }
  }

  function renderUpdatesBadge() {
    const hasNewUpdates = !updatesHaveBeenSeen();
    dom.updatesNewBadge.hidden = !hasNewUpdates;
    dom.updatesButton.setAttribute(
      "aria-label",
      hasNewUpdates ? "更新情報を開く（新着あり）" : "更新情報を開く",
    );
  }

  function markUpdatesSeen() {
    try {
      localStorage.setItem(UPDATES_SEEN_KEY, CURRENT_UPDATE_VERSION);
    } catch {
      // Update history still works when storage is unavailable; the NEW badge may reappear.
    }
    renderUpdatesBadge();
  }

  function isInfoDialogOpen(dialog) {
    return Boolean(dialog && (dialog.open || dialog.hasAttribute("open")));
  }

  function finishInfoDialogClose(dialog) {
    if (dialog === dom.updatesDialog) markUpdatesSeen();
    const opener = dialogOpeners.get(dialog);
    dialogOpeners.delete(dialog);
    window.requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  }

  function openInfoDialog(dialog, opener) {
    if (!dialog || isInfoDialogOpen(dialog)) return;
    dialogOpeners.set(dialog, opener);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else {
      dialog.setAttribute("open", "");
      dialog.setAttribute("aria-modal", "true");
      dialog.classList.add("is-fallback-open");
      document.body.classList.add("has-info-dialog");
      window.requestAnimationFrame(() => dialog.querySelector("[data-dialog-close]")?.focus());
    }
  }

  function closeInfoDialog(dialog) {
    if (!isInfoDialogOpen(dialog)) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else {
      dialog.removeAttribute("open");
      dialog.removeAttribute("aria-modal");
      dialog.classList.remove("is-fallback-open");
      document.body.classList.remove("has-info-dialog");
      finishInfoDialogClose(dialog);
    }
  }

  function configureInfoDialogs() {
    const dialogs = [dom.helpDialog, dom.updatesDialog];
    dom.helpButton.addEventListener("click", () => openInfoDialog(dom.helpDialog, dom.helpButton));
    dom.updatesButton.addEventListener("click", () =>
      openInfoDialog(dom.updatesDialog, dom.updatesButton),
    );

    for (const dialog of dialogs) {
      for (const closeButton of dialog.querySelectorAll("[data-dialog-close]")) {
        closeButton.addEventListener("click", () => closeInfoDialog(dialog));
      }
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isOutside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;
        if (isOutside) closeInfoDialog(dialog);
      });
      dialog.addEventListener("keydown", (event) => {
        if (!dialog.classList.contains("is-fallback-open")) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeInfoDialog(dialog);
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from(
          dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        ).filter((element) => element.getClientRects().length > 0);
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      dialog.addEventListener("close", () => {
        dialog.removeAttribute("aria-modal");
        dialog.classList.remove("is-fallback-open");
        document.body.classList.remove("has-info-dialog");
        finishInfoDialogClose(dialog);
      });
    }

    renderUpdatesBadge();
  }

  function pointOnMap(event) {
    const rect = dom.mapStage.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * MAP_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * MAP_SIZE,
    };
  }

  function updateNodeForPlacement(placement) {
    const node = dom.placementLayer.querySelector(`[data-placement-id="${placement.id}"]`);
    if (node) applyPlacementStyle(node, placement);
  }

  function handlePointerDown(event) {
    const node = event.target.closest(".character-node");
    if (!node || !dom.mapStage.contains(node)) {
      clearSelection();
      return;
    }

    const placement = state.placements.find((item) => item.id === node.dataset.placementId);
    if (!placement) return;

    event.preventDefault();
    finishPendingEdit();
    node.focus({ preventScroll: true });
    const before = captureSnapshot();
    const index = state.placements.indexOf(placement);
    if (index !== state.placements.length - 1) {
      state.placements.splice(index, 1);
      state.placements.push(placement);
      dom.placementLayer.append(node);
    }
    selectedId = placement.id;
    updateSelectionVisuals();
    syncCharacterSettings();
    updateSelectionStatus();

    const point = pointOnMap(event);
    const isResize = Boolean(event.target.closest("[data-resize-handle]"));
    const captureTarget = isResize ? event.target.closest("[data-resize-handle]") : node;
    captureTarget.setPointerCapture(event.pointerId);

    interaction = isResize
      ? {
          type: "resize",
          pointerId: event.pointerId,
          target: captureTarget,
          placementId: placement.id,
          before,
        }
      : {
          type: "move",
          pointerId: event.pointerId,
          target: captureTarget,
          placementId: placement.id,
          before,
          offsetX: point.x - placement.x,
          offsetY: point.y - placement.y,
        };
  }

  function handlePointerMove(event) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const placement = state.placements.find((item) => item.id === interaction.placementId);
    if (!placement) return;

    event.preventDefault();
    const point = pointOnMap(event);

    if (interaction.type === "move") {
      placement.x = point.x - interaction.offsetX;
      placement.y = point.y - interaction.offsetY;
      constrainPlacement(placement);
    } else {
      const extraHeight = captionIsVisible(placement) ? CAPTION_SPACE : 0;
      const available = Math.min(
        MAX_CHARACTER_SIZE,
        MAP_SIZE - placement.x,
        MAP_SIZE - placement.y - extraHeight,
      );
      const desired = Math.max(point.x - placement.x, point.y - placement.y);
      placement.size = clamp(Math.round(desired), MIN_CHARACTER_SIZE, Math.max(MIN_CHARACTER_SIZE, available));
      constrainPlacement(placement);
      dom.characterSizeInput.value = String(placement.size);
      dom.characterSizeOutput.textContent = `${placement.size} px`;
    }

    updateNodeForPlacement(placement);
  }

  function finishPointerInteraction(event) {
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const finished = interaction;
    interaction = null;
    if (finished.target.hasPointerCapture?.(event.pointerId)) {
      finished.target.releasePointerCapture(event.pointerId);
    }
    commitBefore(finished.before);
    renderAll();
  }

  function moveSelectedByKeyboard(key, amount) {
    const placement = getSelectedPlacement();
    if (!placement) return;
    const before = captureSnapshot();
    if (key === "ArrowLeft") placement.x -= amount;
    if (key === "ArrowRight") placement.x += amount;
    if (key === "ArrowUp") placement.y -= amount;
    if (key === "ArrowDown") placement.y += amount;
    constrainPlacement(placement);
    commitBefore(before);
    updateNodeForPlacement(placement);
    syncCharacterSettings();
    updateSelectionStatus();
  }

  function isTypingTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement ||
      target?.isContentEditable
    );
  }

  function handleKeyboard(event) {
    if (isInfoDialogOpen(dom.helpDialog) || isInfoDialogOpen(dom.updatesDialog)) return;

    if (event.key === "Escape" && librarySelectionMode) {
      event.preventDefault();
      setLibrarySelectionMode(false);
      return;
    }

    const typing = isTypingTarget(event.target);
    const modifier = event.ctrlKey || event.metaKey;

    if (modifier && !typing) {
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "y") {
        event.preventDefault();
        redo();
        return;
      }
    }

    if (typing) return;

    if (librarySelectionMode) {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        showToast("画像一覧の「選択を削除」ボタンを使ってください");
      }
      return;
    }

    const focusedNode = event.target.closest?.(".character-node");
    if (focusedNode && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const before = captureSnapshot();
      selectPlacement(focusedNode.dataset.placementId, true, before);
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
      event.preventDefault();
      deleteSelected();
      return;
    }

    if (
      event.target === dom.mapViewport &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selectedId) {
      event.preventDefault();
      moveSelectedByKeyboard(event.key, event.shiftKey ? 16 : 3);
      return;
    }

    if (event.key === "Escape") clearSelection();
  }

  function resetEverything() {
    const confirmed = window.confirm(
      "アップロード画像、背景、配置、ラベル、フォント、色設定をすべて初期化します。よろしいですか？",
    );
    if (!confirmed) return;

    resetEpoch += 1;
    libraryLoadGeneration += 1;
    libraryLoadRequestId += 1;
    backgroundLoadRequests.inner += 1;
    backgroundLoadRequests.outer += 1;
    finishPendingEdit();
    assets.clear();
    state = createDefaultState();
    selectedId = null;
    resetLibrarySelectionState();
    interaction = null;
    undoStack.length = 0;
    redoStack.length = 0;
    dom.fileInput.value = "";
    dom.chooseFilesButton.disabled = false;
    dom.chooseFilesButton.textContent = "ファイルを選択";
    dom.backgroundImageInput.value = "";
    dom.outerBackgroundImageInput.value = "";
    dom.chooseBackgroundImageButton.disabled = false;
    dom.chooseBackgroundImageButton.textContent = "内側の画像を選択";
    dom.chooseOuterBackgroundImageButton.disabled = false;
    dom.chooseOuterBackgroundImageButton.textContent = "外側の画像を選択";
    try {
      localStorage.removeItem(PREFERENCES_KEY);
    } catch {
      // Optional storage cleanup.
    }
    renderAll();
    showToast("すべて初期化しました");
  }

  function setPlacementShape(shape) {
    const placement = getSelectedPlacement();
    if (!placement || placement.shape === shape) return;
    const before = captureSnapshot();
    placement.shape = shape;
    commitBefore(before);
    renderPlacements();
    syncCharacterSettings();
  }

  function applySelectedStyleToAll() {
    finishPendingEdit();
    const source = getSelectedPlacement();
    const placementCount = state.placements.length;
    if (!source || placementCount < 2) return;

    const confirmed = window.confirm(
      `選択中の見た目を、マップ上の${placementCount}枚すべてに適用します。\n\n` +
        "キャラクター名、基本の配置位置、重なり順は変更しません。サイズや名前表示によって端からはみ出す場合だけ、配置位置を内側へ調整します。よろしいですか？",
    );
    if (!confirmed) return;

    const style = {
      size: source.size,
      borderColor: source.borderColor,
      borderWidth: source.borderWidth,
      shape: source.shape,
      showName: source.showName,
    };
    const before = captureSnapshot();
    for (const placement of state.placements) {
      const layoutMayChange =
        placement.size !== style.size ||
        (!placement.showName && style.showName && Boolean(placement.name.trim()));
      placement.size = style.size;
      placement.borderColor = style.borderColor;
      placement.borderWidth = style.borderWidth;
      placement.shape = style.shape;
      placement.showName = style.showName;
      if (layoutMayChange) constrainPlacement(placement);
    }

    if (!commitBefore(before)) {
      showToast("すべての画像はすでに同じ見た目です");
      return;
    }
    renderAll();
    showToast(`全${placementCount}枚の画像に見た目を適用しました`);
  }

  function setLabelLayout(layout) {
    if (!LABEL_LAYOUTS.has(layout) || state.appearance.labelLayout === layout) return;
    finishPendingEdit();
    const before = captureSnapshot();
    state.appearance.labelLayout = layout;
    commitBefore(before);
    renderAxis();
    renderAppearance();
    showToast(layout === "outside" ? "文字を図の外側へ配置しました" : "文字を図の内側へ配置しました");
  }

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    const before = captureSnapshot();
    Object.assign(state.appearance, preset, { activePreset: name });
    commitBefore(before);
    renderAppearance();
  }

  function drawArrowHead(context, x, y, direction, color, size) {
    const length = size;
    const half = (size * 7) / 12;
    context.save();
    context.translate(x, y);
    context.rotate(direction);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(-length, -half);
    context.lineTo(-length, half);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.restore();
  }

  function splitTextToLines(context, text, maxWidth, maxLines) {
    const characters = Array.from(text.trim());
    const lines = [];
    let current = "";
    let consumed = 0;

    for (const character of characters) {
      const candidate = current + character;
      if (current && context.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = character;
        if (lines.length === maxLines) break;
      } else {
        current = candidate;
      }
      consumed += 1;
    }

    if (lines.length < maxLines && current) lines.push(current);
    const joinedLength = Array.from(lines.join("")).length;
    if (joinedLength < characters.length && lines.length) {
      let last = lines[lines.length - 1];
      while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last}…`;
    }
    return lines.slice(0, maxLines);
  }

  function drawAxisLabel(
    context,
    text,
    x,
    y,
    maxWidth,
    textAlign = "center",
    initialFontSize = 26,
  ) {
    if (!text.trim()) return;
    let fontSize = initialFontSize;
    context.save();
    context.fillStyle = state.appearance.textColor;
    context.textAlign = textAlign;
    context.textBaseline = "middle";
    context.font = `800 ${fontSize}px ${getFontStack()}`;
    let lines = splitTextToLines(context, text, maxWidth, 2);
    while (fontSize > 15 && lines.some((line) => context.measureText(line).width > maxWidth)) {
      fontSize -= 1;
      context.font = `800 ${fontSize}px ${getFontStack()}`;
      lines = splitTextToLines(context, text, maxWidth, 2);
    }
    const lineHeight = fontSize * 1.14;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => context.fillText(line, x, startY + index * lineHeight));
    context.restore();
  }

  function drawSingleLineAxisLabel(
    context,
    text,
    x,
    y,
    maxWidth,
    textAlign = "center",
    initialFontSize = 24,
  ) {
    if (!text.trim()) return;
    context.save();
    context.fillStyle = state.appearance.textColor;
    context.textAlign = textAlign;
    context.textBaseline = "middle";
    context.font = `800 ${initialFontSize}px ${getFontStack()}`;
    context.fillText(fitTextWithEllipsis(context, text, maxWidth), x, y);
    context.restore();
  }

  function drawVerticalAxisLabel(context, text, x, y, maxHeight, initialFontSize = 24) {
    if (!text.trim()) return;
    const characters = Array.from(
      truncateCharacters(text.trim(), OUTSIDE_VERTICAL_LABEL_MAX_CHARACTERS),
    );
    let fontSize = initialFontSize;
    let lineHeight = fontSize * 1.12;
    while (fontSize > 14 && characters.length * lineHeight > maxHeight) {
      fontSize -= 1;
      lineHeight = fontSize * 1.12;
    }

    const maxCharacters = Math.max(1, Math.floor(maxHeight / lineHeight));
    const visibleCharacters = characters.slice(0, maxCharacters);
    if (visibleCharacters.length < characters.length) {
      visibleCharacters[visibleCharacters.length - 1] = "…";
    }

    context.save();
    context.fillStyle = state.appearance.textColor;
    context.font = `800 ${fontSize}px ${getFontStack()}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const startY = y - ((visibleCharacters.length - 1) * lineHeight) / 2;
    visibleCharacters.forEach((character, index) => {
      context.fillText(character, x, startY + index * lineHeight);
    });
    context.restore();
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function drawImageCover(context, image, x, y, size, shape) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight || size <= 0) return;

    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceWidth > sourceHeight) {
      sw = sourceHeight;
      sx = (sourceWidth - sw) / 2;
    } else if (sourceHeight > sourceWidth) {
      sh = sourceWidth;
      sy = (sourceHeight - sh) / 2;
    }

    context.save();
    if (shape === "circle") {
      context.beginPath();
      context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      context.clip();
    } else {
      context.beginPath();
      context.rect(x, y, size, size);
      context.clip();
    }
    context.fillStyle = "#e8ecea";
    context.fillRect(x, y, size, size);
    context.drawImage(image, sx, sy, sw, sh, x, y, size, size);
    context.restore();
  }

  function drawBackgroundImageCover(context, image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return;

    const targetRatio = 1;
    const sourceRatio = sourceWidth / sourceHeight;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else if (sourceRatio < targetRatio) {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }
    context.drawImage(image, sx, sy, sw, sh, 0, 0, MAP_SIZE, MAP_SIZE);
  }

  function drawConfiguredBackground(context, settings, opacity = 1) {
    if (opacity <= 0) return;
    const asset = assets.get(settings.assetId);
    context.save();
    context.globalAlpha = clamp(opacity, 0, 1);

    if (settings.mode === "image" && asset) {
      drawBackgroundImageCover(context, asset.image);
    } else if (settings.mode === "gradient") {
      const gradient = context.createLinearGradient(0, 0, MAP_SIZE, MAP_SIZE);
      gradient.addColorStop(0, settings.gradientStart);
      gradient.addColorStop(1, settings.gradientEnd);
      context.fillStyle = gradient;
      context.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    } else if (settings.mode === "solid") {
      context.fillStyle = settings.color;
      context.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    }

    context.restore();
  }

  function fitTextWithEllipsis(context, text, maxWidth) {
    if (context.measureText(text).width <= maxWidth) return text;
    const characters = Array.from(text);
    while (characters.length && context.measureText(`${characters.join("")}…`).width > maxWidth) {
      characters.pop();
    }
    return `${characters.join("")}…`;
  }

  function drawPlacement(context, placement) {
    const asset = assets.get(placement.assetId);
    if (!asset) return;

    const border = clamp(placement.borderWidth, 0, placement.size / 3);
    const innerX = placement.x + border;
    const innerY = placement.y + border;
    const innerSize = Math.max(1, placement.size - border * 2);
    drawImageCover(context, asset.image, innerX, innerY, innerSize, placement.shape);

    if (border > 0) {
      context.save();
      context.strokeStyle = placement.borderColor;
      context.lineWidth = border;
      if (placement.shape === "circle") {
        context.beginPath();
        context.arc(
          placement.x + placement.size / 2,
          placement.y + placement.size / 2,
          Math.max(0, placement.size / 2 - border / 2),
          0,
          Math.PI * 2,
        );
      } else {
        context.beginPath();
        context.rect(
          placement.x + border / 2,
          placement.y + border / 2,
          Math.max(0, placement.size - border),
          Math.max(0, placement.size - border),
        );
      }
      context.stroke();
      context.restore();
    }

    if (captionIsVisible(placement)) {
      const metrics = getCaptionMetrics(placement);
      const height = 24;
      const top = placement.y + placement.size + 6;
      context.save();
      roundedRectPath(context, metrics.left, top, metrics.width, height, 12);
      context.fillStyle = "rgba(255, 255, 255, 0.93)";
      context.fill();
      context.strokeStyle = "rgba(61, 79, 73, 0.22)";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = state.appearance.textColor;
      context.font = `700 14px ${getFontStack()}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const label = fitTextWithEllipsis(context, placement.name.trim(), metrics.width - 14);
      context.fillText(label, metrics.left + metrics.width / 2, top + height / 2 + 0.5);
      context.restore();
    }
  }

  function getExportPlotRect() {
    if (state.appearance.labelLayout === "outside") return OUTSIDE_PLOT_RECT;
    return { x: 0, y: 0, size: MAP_SIZE };
  }

  function createExportCanvas(scale) {
    const canvas = document.createElement("canvas");
    canvas.width = MAP_SIZE * scale;
    canvas.height = MAP_SIZE * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvasを作成できませんでした");
    context.scale(scale, scale);

    const isOutsideLayout = state.appearance.labelLayout === "outside";
    const plotRect = getExportPlotRect();
    const plotScale = plotRect.size / MAP_SIZE;
    const includeBackground = dom.includeBackgroundInput.checked;
    if (includeBackground && isOutsideLayout) {
      drawConfiguredBackground(context, getBackgroundSettings("outer"));
    }
    const axisColors = getAxisColors();
    const axisInset = (MAP_SIZE * (100 - state.appearance.axisLength)) / 200;
    const axisStart = axisInset;
    const axisEnd = MAP_SIZE - axisInset;
    const axisArrowSize = state.appearance.axisArrowSize;
    const axisShaftStart = axisStart + axisArrowSize;
    const axisShaftEnd = axisEnd - axisArrowSize;

    context.save();
    context.translate(plotRect.x, plotRect.y);
    context.scale(plotScale, plotScale);
    if (includeBackground) {
      drawConfiguredBackground(
        context,
        getBackgroundSettings("inner"),
        state.appearance.backgroundOpacity / 100,
      );
    }
    const horizontalGradient = context.createLinearGradient(
      axisShaftStart,
      MAP_SIZE / 2,
      axisShaftEnd,
      MAP_SIZE / 2,
    );
    horizontalGradient.addColorStop(0, axisColors.start);
    horizontalGradient.addColorStop(1, axisColors.end);
    const verticalGradient = context.createLinearGradient(
      MAP_SIZE / 2,
      axisShaftStart,
      MAP_SIZE / 2,
      axisShaftEnd,
    );
    verticalGradient.addColorStop(0, axisColors.start);
    verticalGradient.addColorStop(1, axisColors.end);
    context.save();
    context.globalAlpha = state.appearance.axisOpacity / 100;
    context.lineWidth = state.appearance.axisLineWidth;
    context.lineCap = "butt";

    context.strokeStyle = horizontalGradient;
    context.beginPath();
    context.moveTo(axisShaftStart, MAP_SIZE / 2);
    context.lineTo(axisShaftEnd, MAP_SIZE / 2);
    context.stroke();

    context.strokeStyle = verticalGradient;
    context.beginPath();
    context.moveTo(MAP_SIZE / 2, axisShaftStart);
    context.lineTo(MAP_SIZE / 2, axisShaftEnd);
    context.stroke();
    drawArrowHead(
      context,
      axisStart,
      MAP_SIZE / 2,
      Math.PI,
      axisColors.start,
      axisArrowSize,
    );
    drawArrowHead(
      context,
      axisEnd,
      MAP_SIZE / 2,
      0,
      axisColors.end,
      axisArrowSize,
    );
    drawArrowHead(
      context,
      MAP_SIZE / 2,
      axisStart,
      -Math.PI / 2,
      axisColors.start,
      axisArrowSize,
    );
    drawArrowHead(
      context,
      MAP_SIZE / 2,
      axisEnd,
      Math.PI / 2,
      axisColors.end,
      axisArrowSize,
    );
    context.restore();

    if (!isOutsideLayout) {
      drawAxisLabel(context, state.mapTitle, 18, 36, 220, "left", 22);
      drawAxisLabel(context, state.axis.top, MAP_SIZE / 2, 27, 300);
      drawAxisLabel(context, state.axis.bottom, MAP_SIZE / 2, MAP_SIZE - 27, 300);
      drawAxisLabel(context, state.axis.left, 18, MAP_SIZE / 2, 220, "left");
      drawAxisLabel(context, state.axis.right, MAP_SIZE - 18, MAP_SIZE / 2, 220, "right");
    }

    for (const placement of state.placements) drawPlacement(context, placement);
    context.restore();

    if (isOutsideLayout) {
      context.save();
      context.globalAlpha = 0.72;
      context.strokeStyle = OUTSIDE_PLOT_BOUNDARY_COLOR;
      context.lineWidth = 2;
      context.strokeRect(
        plotRect.x + 1,
        plotRect.y + 1,
        plotRect.size - 2,
        plotRect.size - 2,
      );
      context.restore();

      drawSingleLineAxisLabel(context, state.mapTitle, MAP_SIZE / 2, 29, 672, "center", 34);
      drawSingleLineAxisLabel(context, state.axis.top, MAP_SIZE / 2, 108, 448);
      drawSingleLineAxisLabel(context, state.axis.bottom, MAP_SIZE / 2, 774, 448);
      if (state.appearance.verticalSideLabels) {
        drawVerticalAxisLabel(context, state.axis.left, 45, 434, 480, 24);
        drawVerticalAxisLabel(context, state.axis.right, MAP_SIZE - 45, 434, 480, 24);
      } else {
        drawSingleLineAxisLabel(context, state.axis.left, 57, 434, 76);
        drawSingleLineAxisLabel(
          context,
          state.axis.right,
          MAP_SIZE - 57,
          434,
          76,
        );
      }
    }
    return canvas;
  }

  async function exportPng() {
    finishPendingEdit();
    const originalText = dom.exportButton.textContent;
    dom.exportButton.disabled = true;
    dom.exportButton.textContent = "PNGを作成中…";
    try {
      const scale = clamp(Number(dom.exportScaleInput.value) || 2, 1, 3);
      const canvas = createExportCanvas(scale);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("PNGを生成できませんでした"));
        }, "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "character-attribute-map.png";
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(`${MAP_SIZE * scale} × ${MAP_SIZE * scale}pxのPNGを保存しました`);
    } catch {
      showToast("PNGの保存に失敗しました。もう一度お試しください", true);
    } finally {
      dom.exportButton.disabled = false;
      dom.exportButton.textContent = originalText;
    }
  }

  function configureInputs() {
    bindStatefulControl(
      dom.mapTitleInput,
      () => {
        state.mapTitle = dom.mapTitleInput.value;
      },
      () => {
        const title = state.mapTitle.trim();
        dom.mapTitleDisplay.textContent = title;
        dom.mapTitleDisplay.hidden = !title;
        savePreferencesSoon();
      },
    );

    const axisBindings = [
      [dom.topLabelInput, "top", dom.topAxisLabel],
      [dom.bottomLabelInput, "bottom", dom.bottomAxisLabel],
      [dom.leftLabelInput, "left", dom.leftAxisLabel],
      [dom.rightLabelInput, "right", dom.rightAxisLabel],
    ];
    for (const [input, key, label] of axisBindings) {
      bindStatefulControl(
        input,
        () => {
          state.axis[key] = input.value;
        },
        () => {
          renderAxisLabel(label, key, input.value);
          savePreferencesSoon();
        },
      );
    }

    bindStatefulControl(
      dom.verticalSideLabelsInput,
      () => {
        state.appearance.verticalSideLabels = dom.verticalSideLabelsInput.checked;
      },
      () => {
        renderAppearance();
        renderAxis();
        savePreferencesSoon();
      },
      "change",
    );

    bindStatefulControl(
      dom.characterNameInput,
      () => {
        const placement = getSelectedPlacement();
        if (!placement) return;
        placement.name = dom.characterNameInput.value;
        constrainPlacement(placement);
      },
      () => {
        renderPlacements();
        updateSelectionStatus();
      },
    );

    bindStatefulControl(
      dom.characterSizeInput,
      () => {
        const placement = getSelectedPlacement();
        if (!placement) return;
        placement.size = Number(dom.characterSizeInput.value);
        constrainPlacement(placement);
      },
      () => {
        const placement = getSelectedPlacement();
        if (!placement) return;
        dom.characterSizeOutput.textContent = `${placement.size} px`;
        renderPlacements();
      },
    );

    bindStatefulControl(
      dom.borderColorInput,
      () => {
        const placement = getSelectedPlacement();
        if (placement) placement.borderColor = dom.borderColorInput.value.toLowerCase();
      },
      () => {
        dom.borderColorValue.textContent = dom.borderColorInput.value.toUpperCase();
        renderPlacements();
      },
    );

    bindStatefulControl(
      dom.borderWidthInput,
      () => {
        const placement = getSelectedPlacement();
        if (placement) placement.borderWidth = Number(dom.borderWidthInput.value);
      },
      renderPlacements,
      "change",
    );

    bindStatefulControl(
      dom.showNameInput,
      () => {
        const placement = getSelectedPlacement();
        if (!placement) return;
        placement.showName = dom.showNameInput.checked;
        constrainPlacement(placement);
      },
      renderPlacements,
      "change",
    );

    bindStatefulControl(
      dom.backgroundModeInput,
      () => {
        state.appearance.backgroundMode = dom.backgroundModeInput.value;
        state.appearance.activePreset = "custom";
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
      "change",
    );

    bindStatefulControl(
      dom.backgroundColorInput,
      () => {
        state.appearance.backgroundMode = "solid";
        state.appearance.backgroundColor = dom.backgroundColorInput.value.toLowerCase();
        state.appearance.activePreset = "custom";
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.gradientStartInput,
      () => {
        state.appearance.backgroundMode = "gradient";
        state.appearance.gradientStart = dom.gradientStartInput.value.toLowerCase();
        state.appearance.activePreset = "custom";
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.gradientEndInput,
      () => {
        state.appearance.backgroundMode = "gradient";
        state.appearance.gradientEnd = dom.gradientEndInput.value.toLowerCase();
        state.appearance.activePreset = "custom";
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.backgroundOpacityInput,
      () => {
        state.appearance.backgroundOpacity = clamp(
          Math.round(Number(dom.backgroundOpacityInput.value) || 0),
          BACKGROUND_OPACITY_MIN,
          BACKGROUND_OPACITY_MAX,
        );
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.outerBackgroundModeInput,
      () => {
        state.appearance.outerBackgroundMode = dom.outerBackgroundModeInput.value;
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
      "change",
    );

    bindStatefulControl(
      dom.outerBackgroundColorInput,
      () => {
        state.appearance.outerBackgroundMode = "solid";
        state.appearance.outerBackgroundColor =
          dom.outerBackgroundColorInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.outerGradientStartInput,
      () => {
        state.appearance.outerBackgroundMode = "gradient";
        state.appearance.outerGradientStart = dom.outerGradientStartInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.outerGradientEndInput,
      () => {
        state.appearance.outerBackgroundMode = "gradient";
        state.appearance.outerGradientEnd = dom.outerGradientEndInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisModeInput,
      () => {
        state.appearance.axisMode = dom.axisModeInput.value;
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
      "change",
    );

    bindStatefulControl(
      dom.axisColorInput,
      () => {
        state.appearance.axisColor = dom.axisColorInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisGradientStartInput,
      () => {
        state.appearance.axisMode = "gradient";
        state.appearance.axisGradientStart = dom.axisGradientStartInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisGradientEndInput,
      () => {
        state.appearance.axisMode = "gradient";
        state.appearance.axisGradientEnd = dom.axisGradientEndInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisLengthInput,
      () => {
        state.appearance.axisLength = clamp(
          Math.round(Number(dom.axisLengthInput.value) || 84),
          AXIS_LENGTH_MIN,
          AXIS_LENGTH_MAX,
        );
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisArrowSizeInput,
      () => {
        state.appearance.axisArrowSize =
          normalizeRangeValue(
            dom.axisArrowSizeInput.value,
            AXIS_ARROW_SIZE_MIN,
            AXIS_ARROW_SIZE_MAX,
          ) ?? 12;
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisLineWidthInput,
      () => {
        state.appearance.axisLineWidth =
          normalizeRangeValue(
            dom.axisLineWidthInput.value,
            AXIS_LINE_WIDTH_MIN,
            AXIS_LINE_WIDTH_MAX,
            0.5,
          ) ?? 2.5;
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.axisOpacityInput,
      () => {
        state.appearance.axisOpacity =
          normalizeRangeValue(
            dom.axisOpacityInput.value,
            AXIS_OPACITY_MIN,
            AXIS_OPACITY_MAX,
            5,
          ) ?? 100;
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );

    bindStatefulControl(
      dom.fontFamilyInput,
      () => {
        if (isFontOption(dom.fontFamilyInput.value)) {
          state.appearance.fontFamily = dom.fontFamilyInput.value;
        }
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
      "change",
    );

    bindStatefulControl(
      dom.textColorInput,
      () => {
        state.appearance.textColor = dom.textColorInput.value.toLowerCase();
      },
      () => {
        renderAppearance();
        savePreferencesSoon();
      },
    );
  }

  function configureMapView() {
    dom.zoomOutButton.addEventListener("click", () => adjustMapViewZoom(-MAP_ZOOM_STEP));
    dom.zoomInButton.addEventListener("click", () => adjustMapViewZoom(MAP_ZOOM_STEP));
    dom.actualSizeButton.addEventListener("click", () => {
      setMapViewZoom(100, { mode: "manual", announce: true });
    });
    dom.fitMapButton.addEventListener("click", () => {
      mapViewMode = "fit";
      refreshMapView({ announce: true });
    });
    dom.mapZoomInput.addEventListener("input", () => {
      setMapViewZoom(dom.mapZoomInput.value, { mode: "manual" });
    });
    dom.mapZoomInput.addEventListener("change", () => {
      announceMapView(`属性マップの表示倍率を${Math.round(mapViewZoom)}パーセントにしました。`);
    });

    if ("ResizeObserver" in window) {
      let lastViewportWidth = 0;
      const viewportObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width || 0;
        if (Math.abs(width - lastViewportWidth) < 0.5) return;
        lastViewportWidth = width;
        scheduleMapViewRefresh();
      });
      viewportObserver.observe(dom.mapViewport);
      mapViewObservers.push(viewportObserver);

      const surroundingLayoutObserver = new ResizeObserver(scheduleMapViewRefresh);
      surroundingLayoutObserver.observe(dom.canvasPanelHeader);
      surroundingLayoutObserver.observe(dom.mapViewToolbar);
      surroundingLayoutObserver.observe(dom.selectionStatus);
      mapViewObservers.push(surroundingLayoutObserver);
    }

    window.addEventListener("resize", scheduleMapViewRefresh);
    window.visualViewport?.addEventListener("resize", scheduleMapViewRefresh);
    refreshMapView();
  }

  function configureEvents() {
    configureInputs();
    configureInfoDialogs();

    dom.undoButton.addEventListener("click", undo);
    dom.redoButton.addEventListener("click", redo);
    dom.resetButton.addEventListener("click", resetEverything);
    dom.deleteButton.addEventListener("click", deleteSelected);
    dom.duplicateButton.addEventListener("click", duplicateSelected);
    dom.applyStyleToAllButton.addEventListener("click", applySelectedStyleToAll);
    dom.squareShapeButton.addEventListener("click", () => setPlacementShape("square"));
    dom.circleShapeButton.addEventListener("click", () => setPlacementShape("circle"));
    dom.insideLabelLayoutButton.addEventListener("click", () => setLabelLayout("inside"));
    dom.outsideLabelLayoutButton.addEventListener("click", () => setLabelLayout("outside"));
    dom.exportButton.addEventListener("click", exportPng);

    for (const button of dom.presetButtons) {
      button.addEventListener("click", () => applyPreset(button.dataset.preset));
    }

    dom.chooseFilesButton.addEventListener("click", () => dom.fileInput.click());
    dom.fileInput.addEventListener("change", () => handleFiles(dom.fileInput.files));
    dom.startLibrarySelectionButton.addEventListener("click", () =>
      setLibrarySelectionMode(true),
    );
    dom.cancelLibrarySelectionButton.addEventListener("click", () =>
      setLibrarySelectionMode(false),
    );
    dom.selectAllLibraryButton.addEventListener("click", toggleAllLibraryAssets);
    dom.deleteSelectedLibraryButton.addEventListener("click", () =>
      deleteLibraryAssets(selectedLibraryAssetIds),
    );
    dom.deleteAllLibraryButton.addEventListener("click", () =>
      deleteLibraryAssets(state.libraryIds, true),
    );
    dom.chooseBackgroundImageButton.addEventListener("click", () => dom.backgroundImageInput.click());
    dom.backgroundImageInput.addEventListener("change", () =>
      handleBackgroundFile(dom.backgroundImageInput.files, "inner"),
    );
    dom.removeBackgroundImageButton.addEventListener("click", () => removeBackgroundImage("inner"));
    dom.chooseOuterBackgroundImageButton.addEventListener("click", () =>
      dom.outerBackgroundImageInput.click(),
    );
    dom.outerBackgroundImageInput.addEventListener("change", () =>
      handleBackgroundFile(dom.outerBackgroundImageInput.files, "outer"),
    );
    dom.removeOuterBackgroundImageButton.addEventListener("click", () =>
      removeBackgroundImage("outer"),
    );

    dom.dropZone.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      dom.dropZone.classList.add("is-dragging");
    });
    dom.dropZone.addEventListener("dragleave", (event) => {
      if (!dom.dropZone.contains(event.relatedTarget)) dom.dropZone.classList.remove("is-dragging");
    });
    dom.dropZone.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      dom.dropZone.classList.remove("is-dragging");
      handleFiles(event.dataTransfer.files);
    });

    dom.imageLibrary.addEventListener("click", (event) => {
      const card = event.target.closest("[data-asset-id]");
      if (!card) return;
      if (librarySelectionMode) toggleLibraryAssetSelection(card.dataset.assetId);
      else addPlacement(card.dataset.assetId);
    });
    dom.imageLibrary.addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-asset-id]");
      if (!card) return;
      if (librarySelectionMode) {
        event.preventDefault();
        return;
      }
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-character-asset", card.dataset.assetId);
      event.dataTransfer.setData("text/plain", card.dataset.assetId);
    });

    dom.mapStage.addEventListener("dragover", (event) => {
      const hasAsset = event.dataTransfer?.types.includes("application/x-character-asset");
      const hasFiles = event.dataTransfer?.types.includes("Files");
      if (!hasAsset && !hasFiles) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      dom.mapStage.classList.add("is-drop-target");
    });
    dom.mapStage.addEventListener("dragleave", (event) => {
      if (!dom.mapStage.contains(event.relatedTarget)) dom.mapStage.classList.remove("is-drop-target");
    });
    dom.mapStage.addEventListener("drop", (event) => {
      event.preventDefault();
      dom.mapStage.classList.remove("is-drop-target");
      const point = pointOnMap(event);
      if (event.dataTransfer?.files.length) {
        handleFiles(event.dataTransfer.files, { placeAt: point });
        return;
      }
      const assetId =
        event.dataTransfer?.getData("application/x-character-asset") ||
        event.dataTransfer?.getData("text/plain");
      if (assetId) addPlacement(assetId, point);
    });

    document.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    });
    document.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.files.length) return;
      if (dom.dropZone.contains(event.target) || dom.mapStage.contains(event.target)) return;
      event.preventDefault();
      showToast("画像は左の追加エリア、または属性マップへドロップしてください", true);
    });

    dom.mapStage.addEventListener("pointerdown", handlePointerDown);
    dom.mapStage.addEventListener("pointermove", handlePointerMove);
    dom.mapStage.addEventListener("pointerup", finishPointerInteraction);
    dom.mapStage.addEventListener("pointercancel", finishPointerInteraction);
    dom.mapStage.addEventListener("focusin", (event) => {
      const node = event.target.closest(".character-node");
      if (node) selectPlacement(node.dataset.placementId);
    });

    document.addEventListener("keydown", handleKeyboard);

    updateMapScale();
    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver((entries) => {
        updateMapScale(entries[0]?.contentRect.width);
      });
      resizeObserver.observe(dom.mapStage);
    } else {
      window.addEventListener("resize", () => updateMapScale());
    }
  }

  loadPreferences();
  configureEvents();
  renderAll();
  configureMapView();
})();
