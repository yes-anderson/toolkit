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

let originalImageData = null;
let ditherAnimationFrame = null;

// Hide effect tools by default
ditherToggle.checked = false;
ditherTools.style.display = "none";
halftoneToggle.checked = false;
halftoneTools.style.display = "none";

// Draw a placeholder if no image is loaded.
function drawPlaceholder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#888";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("(drag and drop your image here_)", canvas.width / 2, canvas.height / 2);
}

// Set up a default canvas.
function setupDefaultCanvas() {
  canvas.width = 800;
  canvas.height = 600;
  drawPlaceholder();
}

window.addEventListener("load", () => {
  if (!originalImageData) {
    setupDefaultCanvas();
  }
});

// Immediately reapply effects when toggles or sliders change.
function scheduleDither() {
  applyAllEffects();
}

/*
  Mapping for Dither Pattern Scale slider (1–6) to block size.
  New mapping: 1 → 2.24×1 – 0.24 = 2px; 6 → 2.24×6 – 0.24 = 13.2px.
*/
function getDitherBlockSize(val) {
  return 2.24 * val - 0.24;
}

/*
  Mapping for Halftone slider (1–6) to dot size.
  Maps 1 → 5px, 6 → 30px.
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
        integral[y * width] = integral[(y-1) * width] + lum;
      } else {
        integral[y * width + x] = integral[y * width + x - 1] +
          integral[(y-1) * width + x] -
          integral[(y-1) * width + x - 1] + lum;
      }
    }
  }
  return integral;
}

/* --- Standard Halftone Effect --- */
// Applies the halftone effect directly to the image data.
function applyHalftoneEffect(blockSize) {
  // Create a fresh grayscale copy from the original image data.
  let imageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);
  convertToGrayscale(imageData);
  
  // Compute the luminance integral.
  const integral = computeLuminanceIntegral(imageData.data, imageData.width, imageData.height);
  
  // Clear the canvas to replace the image with the halftone pattern.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw halftone dots (circles) directly onto the canvas.
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
// Applies a horizontal halftone effect by drawing horizontal bars.
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
// Applies a vertical halftone effect by drawing vertical bars.
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

/* --- Downscaled Dither --- */
function applyDownscaledDither(algorithm, blockSize) {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = Math.ceil(canvas.width / blockSize);
  offCanvas.height = Math.ceil(canvas.height / blockSize);
  const offCtx = offCanvas.getContext("2d");
  offCtx.imageSmoothingEnabled = false;
  
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(originalImageData, 0, 0);
  
  offCtx.drawImage(tempCanvas, 0, 0, offCanvas.width, offCanvas.height);
  const downscaledData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
  
  // For dither, if "Recolor artwork" is off, convert to grayscale.
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

/* --- Main Dither Application --- */
function applyDither() {
  if (!originalImageData) return;
  if (!ditherToggle.checked) {
    ctx.putImageData(originalImageData, 0, 0);
    return;
  }
  ctx.putImageData(originalImageData, 0, 0);
  const blockSize = getDitherBlockSize(parseFloat(patternSlider.value));
  applyDownscaledDither(ditherType.value, blockSize);
}

/* --- Combined Effects Pipeline --- */
function applyAllEffects() {
  if (!originalImageData) return;
  if (halftoneToggle.checked) {
    const blockSize = getHalftoneBlockSize(parseFloat(halftoneScale.value));
    // Create a fresh grayscale copy.
    let imageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);
    convertToGrayscale(imageData);
    // Get the selected halftone pattern.
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
    applyDownscaledDither(ditherType.value, blockSize);
  } else {
    ctx.putImageData(originalImageData, 0, 0);
  }
}

/* --- Event Listeners --- */
ditherToggle.addEventListener("change", () => {
  ditherTools.style.display = ditherToggle.checked ? "block" : "none";
  scheduleDither();
});

halftoneToggle.addEventListener("change", () => {
  halftoneTools.style.display = halftoneToggle.checked ? "block" : "none";
  scheduleDither();
});

ditherSlider.addEventListener("input", function () {
  let fillPercent = ((parseFloat(this.value) - 1) / 9) * 100;
  ditherBar.style.width = fillPercent + "%";
  scheduleDither();
});

patternSlider.addEventListener("input", function () {
  let fillPercent = ((parseFloat(this.value) - 1) / 5) * 100;
  patternBar.style.width = fillPercent + "%";
  scheduleDither();
});

halftoneScale.addEventListener("input", function () {
  let fillPercent = ((parseFloat(this.value) - 1) / 5) * 100;
  halftoneBar.style.width = fillPercent + "%";
  scheduleDither();
});

ditherType.addEventListener("change", scheduleDither());

saveButton.addEventListener("click", function () {
  const link = document.createElement("a");
  link.download = "dithered-image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

resetButton.addEventListener("click", function () {
  if (originalImageData) {
    ctx.putImageData(originalImageData, 0, 0);
  }
});

toggleCheckbox.addEventListener("change", () => {
  document.body.classList.toggle("light-mode");
});

/* --- Image Upload & Scaling --- */
function loadImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  img.onload = () => {
    const maxDim = 800;
    const ratio = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
    const newWidth = img.naturalWidth * ratio;
    const newHeight = img.naturalHeight * ratio;
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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

function setupDefaultCanvas() {
  canvas.width = 800;
  canvas.height = 600;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlaceholder();
}

function drawPlaceholder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#888";
  ctx.font = "20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("(drag and drop your image here_)", canvas.width / 2, canvas.height / 2);
}

/* --- Vertical Halftone Effect --- */
// Applies a vertical halftone effect by drawing vertical bars.
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