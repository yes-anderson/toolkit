// renderer.js

// Get DOM elements
const uploadInput = document.getElementById("upload");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const ditherToggle = document.getElementById("dither-toggle");
const ditherTools = document.getElementById("dither-tools");
const ditherType = document.getElementById("dither-type");
const ditherSlider = document.getElementById("dither-scale");
const patternSlider = document.getElementById("pattern-scale");
const ditherBar = document.getElementById("dither-bar");
const patternBar = document.getElementById("pattern-bar");

const saveButton = document.getElementById("save-image");
const resetButton = document.getElementById("reset-canvas");
const toggleCheckbox = document.getElementById("toggle-mode");
const recolorCheckbox = document.getElementById("recolor-checkbox");

// Halftone elements
const halftoneToggle = document.getElementById("halftone-toggle");
const halftoneTools = document.getElementById("halftone-tools");
const halftoneBar = document.getElementById("halftone-bar");
const halftoneScale = document.getElementById("halftone-scale");
const halftonePattern = document.getElementById("halftone-pattern");

// Outline elements
const outlineToggle = document.getElementById("outline-toggle");
const outlineTools = document.getElementById("outline-tools");
const outlineSlider = document.getElementById("outline-thickness");
const outlineBar = document.getElementById("outline-bar");

// Blur elements
const blurToggle = document.getElementById("blur-toggle");
const blurTools = document.getElementById("blur-tools");
const blurBar = document.getElementById("blur-bar");
const blurAmountSlider = document.getElementById("blur-amount");

// IMAGE ADJUSTMENTS elements
const adjustmentToggle = document.getElementById("adjustment-toggle");
const adjustmentTools = document.getElementById("adjustment-tools");
const brightnessSlider = document.getElementById("brightness-slider");
const contrastSlider = document.getElementById("contrast-slider");
const saturationSlider = document.getElementById("saturation-slider");
const brightnessBar = document.getElementById("brightness-bar");
const contrastBar = document.getElementById("contrast-bar");
const saturationBar = document.getElementById("saturation-bar");

// Paint elements
const paintToggle = document.getElementById("paint-toggle");
const paintTools = document.getElementById("paint-tools");
const paintColor = document.getElementById("paint-color");

// Undo/Redo elements
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");

// History management
let historyStack = [];
let historyIndex = -1;

let originalImageData = null;
let ditherAnimationFrame = null;

// Zoom level for canvas (default zoom = 1)
let zoomLevel = 1;

// Hide effect tools by default
ditherToggle.checked = false;
ditherTools.style.display = "none";
halftoneToggle.checked = false;
halftoneTools.style.display = "none";
outlineToggle.checked = false;
outlineTools.style.display = "none";
blurToggle.checked = false;
blurTools.style.display = "none";
adjustmentToggle.checked = false;
adjustmentTools.style.display = "none";
paintToggle.checked = false;
paintTools.style.display = "none";

// Draw placeholder if no image loaded.
function drawPlaceholder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#888";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("(drag and drop your image here_)", canvas.width / 2, canvas.height / 2);
}

// Set up default canvas.
function setupDefaultCanvas() {
  canvas.width = 1024;
  canvas.height = 768;
  drawPlaceholder();
}

window.addEventListener("load", () => {
  if (!originalImageData) {
    setupDefaultCanvas();
  }
});

/* --- State Management for Undo/Redo --- */
function getCurrentState() {
  return {
    ditherToggle: ditherToggle.checked,
    ditherScale: ditherSlider.value,
    patternScale: patternSlider.value,
    ditherType: ditherType.value,
    halftoneToggle: halftoneToggle.checked,
    halftoneScale: halftoneScale.value,
    halftonePattern: halftonePattern.value,
    outlineToggle: outlineToggle.checked,
    outlineThickness: outlineSlider.value,
    blurToggle: blurToggle.checked,
    blurAmount: blurAmountSlider.value,
    adjustmentToggle: adjustmentToggle.checked,
    brightness: brightnessSlider.value,
    contrast: contrastSlider.value,
    saturation: saturationSlider.value,
    paintToggle: paintToggle.checked,
    paintColor: paintColor.value,
    imageData: new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height)
  };
}

function applyState(state) {
  ditherToggle.checked = state.ditherToggle;
  ditherTools.style.display = state.ditherToggle ? "block" : "none";
  ditherSlider.value = state.ditherScale;
  patternSlider.value = state.patternScale;
  ditherType.value = state.ditherType;
  halftoneToggle.checked = state.halftoneToggle;
  halftoneTools.style.display = state.halftoneToggle ? "block" : "none";
  halftoneScale.value = state.halftoneScale;
  halftonePattern.value = state.halftonePattern;
  outlineToggle.checked = state.outlineToggle;
  outlineTools.style.display = state.outlineToggle ? "block" : "none";
  outlineSlider.value = state.outlineThickness;
  blurToggle.checked = state.blurToggle;
  blurTools.style.display = state.blurToggle ? "block" : "none";
  blurAmountSlider.value = state.blurAmount;
  adjustmentToggle.checked = state.adjustmentToggle;
  adjustmentTools.style.display = state.adjustmentToggle ? "block" : "none";
  brightnessSlider.value = state.brightness;
  contrastSlider.value = state.contrast;
  saturationSlider.value = state.saturation;
  paintToggle.checked = state.paintToggle;
  paintTools.style.display = state.paintToggle ? "block" : "none";
  paintColor.value = state.paintColor;
  originalImageData = state.imageData;
  scheduleDither();
}

function pushHistory() {
  const state = getCurrentState();
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(state);
  historyIndex++;
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    applyState(historyStack[historyIndex]);
  }
}

function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    applyState(historyStack[historyIndex]);
  }
}

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
    e.preventDefault();
    undo();
  } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "Z" || e.key === "z")) {
    e.preventDefault();
    redo();
  }
});

/* --- Immediately reapply effects --- */
function scheduleDither() {
  applyAllEffects();
}

/*
  Mapping for Dither Pattern Scale slider (1–6) to block size.
  1 → 2.24×1 – 0.24 = 2px; 6 → 2.24×6 – 0.24 = 13.2px.
*/
function getDitherBlockSize(val) {
  return 2.24 * val - 0.24;
}

/*
  Mapping for Halftone slider (1–6) to dot size.
  1 → 5px; 6 → 30px.
*/
function getHalftoneBlockSize(val) {
  return 5 + (val - 1) * 5;
}

/* --- Helper: Clamp --- */
function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

/* --- Helper: Convert to Grayscale --- */
function convertToGrayscale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    data[i] = data[i+1] = data[i+2] = lum;
  }
}

/* --- Compute Luminance Integral for Halftone --- */
function computeLuminanceIntegral(pixels, width, height) {
  const integral = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = 0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2];
      if (x === 0 && y === 0) {
        integral[0] = lum;
      } else if (y === 0) {
        integral[x] = integral[x-1] + lum;
      } else if (x === 0) {
        integral[y * width] = integral[(y-1)*width] + lum;
      } else {
        integral[y * width + x] = integral[y * width + x - 1] +
          integral[(y-1) * width + x] -
          integral[(y-1) * width + x - 1] + lum;
      }
    }
  }
  return integral;
}

/* --- IMAGE ADJUSTMENTS: Apply via canvas filter --- */
function applyImageAdjustments() {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = canvas.width;
  offCanvas.height = canvas.height;
  const offCtx = offCanvas.getContext("2d");
  const brightness = brightnessSlider.value;
  const contrast = contrastSlider.value;
  const saturation = saturationSlider.value;
  offCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(originalImageData, 0, 0);
  offCtx.drawImage(tempCanvas, 0, 0);
  offCtx.filter = "none";
  return offCtx.getImageData(0, 0, canvas.width, canvas.height);
}

/* --- Blur Effect Helper: Apply blur to imageData --- */
function applyBlurToImageData(imageData, amount) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(imageData, 0, 0);
  
  const offCanvas = document.createElement("canvas");
  offCanvas.width = imageData.width;
  offCanvas.height = imageData.height;
  const offCtx = offCanvas.getContext("2d");
  offCtx.filter = `blur(${amount}px)`;
  offCtx.drawImage(tempCanvas, 0, 0);
  offCtx.filter = "none";
  return offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
}

/* --- Standard Halftone Effect --- */
function applyHalftoneEffect(blockSize) {
  let imageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);
  convertToGrayscale(imageData);
  const integral = computeLuminanceIntegral(imageData.data, imageData.width, imageData.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < imageData.height; y += blockSize) {
    for (let x = 0; x < imageData.width; x += blockSize) {
      let x1 = x, y1 = y;
      let x2 = Math.min(x + blockSize - 1, imageData.width - 1);
      let y2 = Math.min(y + blockSize - 1, imageData.height - 1);
      let area = (x2 - x1 + 1) * (y2 - y1 + 1);
      let sum = integral[y2 * imageData.width + x2];
      if (x1 > 0) sum -= integral[y2 * imageData.width + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * imageData.width + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * imageData.width + (x1 - 1)];
      let avg = sum / area;
      let radius = (1 - avg / 255) * (blockSize / 2);
      if (radius < 2) radius = 2;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(x + blockSize / 2, y + blockSize / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* --- Horizontal Halftone Effect --- */
function applyHorizontalHalftoneEffect(blockSize) {
  let imageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);
  convertToGrayscale(imageData);
  const integral = computeLuminanceIntegral(imageData.data, imageData.width, imageData.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < imageData.height; y += blockSize) {
    for (let x = 0; x < imageData.width; x += blockSize) {
      let x1 = x, y1 = y;
      let x2 = Math.min(x + blockSize - 1, imageData.width - 1);
      let y2 = Math.min(y + blockSize - 1, imageData.height - 1);
      let area = (x2 - x1 + 1) * (y2 - y1 + 1);
      let sum = integral[y2 * imageData.width + x2];
      if (x1 > 0) sum -= integral[y2 * imageData.width + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * imageData.width + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * imageData.width + (x1 - 1)];
      let avg = sum / area;
      let barHeight = (1 - avg / 255) * blockSize;
      if (barHeight < 2) barHeight = 2;
      let yCenter = y + blockSize / 2;
      let yTop = yCenter - barHeight / 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(x, yTop, blockSize, barHeight);
    }
  }
}

/* --- Vertical Halftone Effect --- */
function applyVerticalHalftoneEffect(blockSize) {
  let imageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);
  convertToGrayscale(imageData);
  const integral = computeLuminanceIntegral(imageData.data, imageData.width, imageData.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < imageData.height; y += blockSize) {
    for (let x = 0; x < imageData.width; x += blockSize) {
      let x1 = x, y1 = y;
      let x2 = Math.min(x + blockSize - 1, imageData.width - 1);
      let y2 = Math.min(y + blockSize - 1, imageData.height - 1);
      let area = (x2 - x1 + 1) * (y2 - y1 + 1);
      let sum = integral[y2 * imageData.width + x2];
      if (x1 > 0) sum -= integral[y2 * imageData.width + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * imageData.width + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * imageData.width + (x1 - 1)];
      let avg = sum / area;
      let barWidth = (1 - avg / 255) * blockSize;
      if (barWidth < 2) barWidth = 2;
      let xCenter = x + blockSize / 2;
      let xLeft = xCenter - barWidth / 2;
      ctx.fillStyle = "#000";
      ctx.fillRect(xLeft, y, barWidth, blockSize);
    }
  }
}

/* --- Dither Algorithms --- */
function colorFloydSteinbergDither(pixels, width, height) {
  const rowWidth = width * 4;
  let intensity = parseInt(ditherSlider.value, 10) * 10;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = y * rowWidth + x * 4;
      let errors = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        let oldVal = pixels[i + c];
        let noise = (Math.random() - 0.5) * 4;
        let newVal = (oldVal + noise) > (128 + intensity) ? 255 : 0;
        errors[c] = oldVal - newVal;
        pixels[i + c] = newVal;
      }
      if (x + 1 < width) {
        let index = i + 4;
        for (let c = 0; c < 3; c++) {
          pixels[index + c] = clamp(pixels[index + c] + errors[c] * 7 / 16);
        }
      }
      if (y + 1 < height) {
        if (x > 0) {
          let index = i + rowWidth - 4;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + errors[c] * 3 / 16);
          }
        }
        {
          let index = i + rowWidth;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + errors[c] * 5 / 16);
          }
        }
        if (x + 1 < width) {
          let index = i + rowWidth + 4;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + errors[c] * 1 / 16);
          }
        }
      }
    }
  }
}

function colorAtkinsonDither(pixels, width, height) {
  const rowWidth = width * 4;
  let intensity = parseInt(ditherSlider.value, 10) * 10;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = y * rowWidth + x * 4;
      let errors = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        let oldVal = pixels[i + c];
        let noise = (Math.random() - 0.5) * 4;
        let newVal = (oldVal + noise) > (128 + intensity) ? 255 : 0;
        errors[c] = oldVal - newVal;
        pixels[i + c] = newVal;
      }
      if (x + 1 < width) {
        let index = i + 4;
        for (let c = 0; c < 3; c++) {
          pixels[index + c] = clamp(pixels[index + c] + (errors[c] >> 3));
        }
      }
      if (x + 2 < width) {
        let index = i + 8;
        for (let c = 0; c < 3; c++) {
          pixels[index + c] = clamp(pixels[index + c] + (errors[c] >> 3));
        }
      }
      if (y + 1 < height) {
        if (x > 0) {
          let index = i + rowWidth - 4;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + (errors[c] >> 3));
          }
        }
        {
          let index = i + rowWidth;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + (errors[c] >> 3));
          }
        }
        if (x + 1 < width) {
          let index = i + rowWidth + 4;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + (errors[c] >> 3));
          }
        }
        if (y + 2 < height) {
          let index = i + rowWidth * 2;
          for (let c = 0; c < 3; c++) {
            pixels[index + c] = clamp(pixels[index + c] + (errors[c] >> 3));
          }
        }
      }
    }
  }
}

function colorOrderedDither(pixels, width, height) {
  const bayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  const matrixSize = 4;
  let intensity = parseInt(ditherSlider.value, 10);
  const levels = 16 + (10 - intensity);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        let oldVal = pixels[i + c];
        let threshold = (bayerMatrix[x % matrixSize][y % matrixSize] / levels) * 255;
        let newVal = oldVal > threshold ? 255 : 0;
        pixels[i + c] = newVal;
      }
    }
  }
}

/* --- Outline Effect --- */
function applyOutlineEffect(lineThickness, baseImageData) {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = baseImageData.width;
  offCanvas.height = baseImageData.height;
  const offCtx = offCanvas.getContext("2d");
  offCtx.putImageData(baseImageData, 0, 0);
  
  // Convert the image to grayscale
  const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    data[i] = data[i+1] = data[i+2] = lum;
  }
  
  // Laplacian kernel for edge detection
  const kernel = [
    -1, -1, -1,
    -1,  8, -1,
    -1, -1, -1
  ];
  const width = offCanvas.width, height = offCanvas.height;
  const edgeData = new Uint8ClampedArray(data.length);
  
  // Initialize edgeData to transparent
  for (let i = 0; i < edgeData.length; i += 4) {
    edgeData[i] = 0;
    edgeData[i+1] = 0;
    edgeData[i+2] = 0;
    edgeData[i+3] = 0;
  }
  
  // Compute edges; mark as black (opaque) when detected
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pos = ((y + ky) * width + (x + kx)) * 4;
          const pixel = data[pos];
          const weight = kernel[(ky+1)*3 + (kx+1)];
          sum += pixel * weight;
        }
      }
      const index = (y * width + x) * 4;
      if (sum > 50) {
        edgeData[index] = 0;
        edgeData[index+1] = 0;
        edgeData[index+2] = 0;
        edgeData[index+3] = 255;
      }
    }
  }
  const edgeImageData = new ImageData(edgeData, width, height);
  
  // Draw the original image first.
  ctx.putImageData(baseImageData, 0, 0);
  
  // Prepare an off-screen canvas with the edge image.
  const edgeCanvas = document.createElement("canvas");
  edgeCanvas.width = width;
  edgeCanvas.height = height;
  const edgeCtx = edgeCanvas.getContext("2d");
  edgeCtx.putImageData(edgeImageData, 0, 0);
  
  // Draw the edge image multiple times (offset by slider value) to simulate thickness.
  ctx.globalCompositeOperation = "source-over";
  for (let dx = -lineThickness + 1; dx < lineThickness; dx++) {
    for (let dy = -lineThickness + 1; dy < lineThickness; dy++) {
      ctx.drawImage(edgeCanvas, dx, dy);
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

/* --- Downscaled Dither --- */
function applyDownscaledDither(algorithm, blockSize, baseImageData) {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = Math.ceil(canvas.width / blockSize);
  offCanvas.height = Math.ceil(canvas.height / blockSize);
  const offCtx = offCanvas.getContext("2d");
  offCtx.imageSmoothingEnabled = false;
  
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(baseImageData, 0, 0);
  
  offCtx.drawImage(tempCanvas, 0, 0, offCanvas.width, offCanvas.height);
  const downscaledData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  
  if (!recolorCheckbox.checked) {
    convertToGrayscale(downscaledData);
  }
  
  if (algorithm === "floyd") {
    colorFloydSteinbergDither(downscaledData.data, offCanvas.width, offCanvas.height);
  } else if (algorithm === "atkinson") {
    colorAtkinsonDither(downscaledData.data, offCanvas.width, offCanvas.height);
  } else if (algorithm === "ordered") {
    colorOrderedDither(downscaledData.data, offCanvas.width, offCanvas.height);
  }
  
  renderPattern(downscaledData, offCanvas.width, offCanvas.height, blockSize, algorithm);
}

/* --- Render Pattern --- */
function renderPattern(downscaledData, gridWidth, gridHeight, blockSize, algorithm) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const i = (y * gridWidth + x) * 4;
      if (recolorCheckbox.checked) {
        const r = downscaledData.data[i];
        const g = downscaledData.data[i+1];
        const b = downscaledData.data[i+2];
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      } else {
        ctx.fillStyle = "#000";
      }
      const luminance = (downscaledData.data[i] + downscaledData.data[i+1] + downscaledData.data[i+2]) / 3;
      const squareSize = Math.round((1 - luminance / 255) * blockSize);
      const offset = Math.round((blockSize - squareSize) / 2);
      ctx.fillRect(x * blockSize + offset, y * blockSize + offset, squareSize, squareSize);
    }
  }
}

/* --- Main Effects Pipeline --- */
// Order: 1. Image adjustments (and blur) -> 2. Effects (outline, halftone, dither)
function applyAllEffects() {
  if (!originalImageData) return;
  let baseImageData = originalImageData;
  if (adjustmentToggle.checked) {
    baseImageData = applyImageAdjustments();
  }
  if (blurToggle.checked) {
    baseImageData = applyBlurToImageData(baseImageData, parseInt(blurAmountSlider.value, 10));
  }
  if (outlineToggle.checked) {
    const thickness = parseInt(outlineSlider.value, 10);
    applyOutlineEffect(thickness, baseImageData);
  } else if (halftoneToggle.checked) {
    const blockSize = getHalftoneBlockSize(parseFloat(halftoneScale.value));
    let imageData = new ImageData(new Uint8ClampedArray(baseImageData.data), baseImageData.width, baseImageData.height);
    convertToGrayscale(imageData);
    const pattern = halftonePattern.value;
    if (pattern === "horizontal") {
      applyHorizontalHalftoneEffect(blockSize);
    } else if (pattern === "vertical") {
      applyVerticalHalftoneEffect(blockSize);
    } else {
      applyHalftoneEffect(blockSize);
    }
  } else if (ditherToggle.checked) {
    const blockSize = getDitherBlockSize(parseFloat(patternSlider.value));
    applyDownscaledDither(ditherType.value, blockSize, baseImageData);
  } else {
    ctx.putImageData(baseImageData, 0, 0);
  }
  
  // Apply the Paint overlay if enabled
  if (paintToggle.checked) {
    const selectedColor = paintColor.value;
    ctx.fillStyle = selectedColor;
    ctx.globalAlpha = 0.3; // Adjust overlay opacity as needed
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0; // Reset alpha to default
  }
}

/* --- Event Listeners --- */
ditherToggle.addEventListener("change", () => {
  ditherTools.style.display = ditherToggle.checked ? "block" : "none";
  pushHistory();
  scheduleDither();
});

halftoneToggle.addEventListener("change", () => {
  halftoneTools.style.display = halftoneToggle.checked ? "block" : "none";
  pushHistory();
  scheduleDither();
});

outlineToggle.addEventListener("change", () => {
  outlineTools.style.display = outlineToggle.checked ? "block" : "none";
  pushHistory();
  scheduleDither();
});

blurToggle.addEventListener("change", () => {
  blurTools.style.display = blurToggle.checked ? "block" : "none";
  pushHistory();
  scheduleDither();
});

adjustmentToggle.addEventListener("change", () => {
  adjustmentTools.style.display = adjustmentToggle.checked ? "block" : "none";
  pushHistory();
  scheduleDither();
});

paintToggle.addEventListener("change", () => {
  paintTools.style.display = paintToggle.checked ? "block" : "none";
  pushHistory();
  scheduleDither();
});

// Listen for real-time color changes on the paint tool
paintColor.addEventListener("input", scheduleDither);
paintColor.addEventListener("change", pushHistory);

ditherSlider.addEventListener("input", function () {
  let fillPercent = ((parseFloat(this.value) - 1) / 9) * 100;
  ditherBar.style.width = fillPercent + "%";
  scheduleDither();
});
ditherSlider.addEventListener("change", pushHistory);

patternSlider.addEventListener("input", function () {
  let fillPercent = ((parseFloat(this.value) - 1) / 5) * 100;
  patternBar.style.width = fillPercent + "%";
  scheduleDither();
});
patternSlider.addEventListener("change", pushHistory);

halftoneScale.addEventListener("input", function () {
  let fillPercent = ((parseFloat(this.value) - 1) / 5) * 100;
  halftoneBar.style.width = fillPercent + "%";
  scheduleDither();
});
halftoneScale.addEventListener("change", pushHistory);

blurAmountSlider.addEventListener("input", function () {
  let fillPercent = (parseFloat(this.value) / 10) * 100;
  blurBar.style.width = fillPercent + "%";
  scheduleDither();
});
blurAmountSlider.addEventListener("change", pushHistory);

brightnessSlider.addEventListener("input", function () {
  let fillPercent = (parseFloat(this.value) / 200) * 100;
  brightnessBar.style.width = fillPercent + "%";
  scheduleDither();
});
brightnessSlider.addEventListener("change", pushHistory);

contrastSlider.addEventListener("input", function () {
  let fillPercent = (parseFloat(this.value) / 200) * 100;
  contrastBar.style.width = fillPercent + "%";
  scheduleDither();
});
contrastSlider.addEventListener("change", pushHistory);

saturationSlider.addEventListener("input", function () {
  let fillPercent = (parseFloat(this.value) / 200) * 100;
  saturationBar.style.width = fillPercent + "%";
  scheduleDither();
});
saturationSlider.addEventListener("change", pushHistory);

ditherType.addEventListener("change", scheduleDither);

undoBtn.addEventListener("click", () => {
  undo();
});

redoBtn.addEventListener("click", () => {
  redo();
});

saveButton.addEventListener("click", function () {
  const link = document.createElement("a");
  link.download = "dithered-image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

resetButton.addEventListener("click", function () {
  if (originalImageData) {
    ctx.putImageData(originalImageData, 0, 0);
    ditherToggle.checked = false;
    ditherTools.style.display = "none";
    halftoneToggle.checked = false;
    halftoneTools.style.display = "none";
    outlineToggle.checked = false;
    outlineTools.style.display = "none";
    blurToggle.checked = false;
    blurTools.style.display = "none";
    adjustmentToggle.checked = false;
    adjustmentTools.style.display = "none";
    paintToggle.checked = false;
    paintTools.style.display = "none";
    pushHistory();
    scheduleDither();
  }
});

toggleCheckbox.addEventListener("change", () => {
  document.body.classList.toggle("light-mode");
  pushHistory();
});

/* --- Outline Slider Event Listeners --- */
outlineSlider.addEventListener("input", function() {
  let fillPercent = ((parseFloat(this.value) - 1) / 9) * 100;
  outlineBar.style.width = fillPercent + "%";
  scheduleDither();
});
outlineSlider.addEventListener("change", pushHistory);

/* --- Image Upload & Scaling --- */
function loadImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.onload = () => {
    // Preserve the image's aspect ratio while scaling down (if needed)
    const maxDim = 800;
    const scaleFactor = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
    const newWidth = img.naturalWidth * scaleFactor;
    const newHeight = img.naturalHeight * scaleFactor;
    
    // Resize the canvas to match the scaled image dimensions
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pushHistory();
    scheduleDither();
  };
}

uploadInput.addEventListener("change", function () {
  const file = uploadInput.files[0];
  if (file) {
    loadImage(file);
  }
});

canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});

canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    loadImage(file);
  }
});

window.addEventListener("load", () => {
  if (!originalImageData) {
    setupDefaultCanvas();
  }
});

/* --- New: Scroll Wheel Zoom Functionality --- */
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY;
  if (delta < 0) {
    zoomLevel *= 1.1; // Zoom in
  } else {
    zoomLevel /= 1.1; // Zoom out
  }
  // Clamp zoom level between 0.1 and 5
  zoomLevel = Math.min(Math.max(zoomLevel, 0.1), 5);
  canvas.style.transformOrigin = "center center";
  canvas.style.transform = `scale(${zoomLevel})`;
});
