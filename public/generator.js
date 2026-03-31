/* ============================================
   CP9 SQUADRA — GENERATOR.JS
   Cover Art Generator with Canvas
   ============================================ */

const PREVIEW_SIZE = 600;
const HD_SIZE = 3000;

let uploadedImage = null;
let selectedFont = 'Permanent Marker';

// ==========================================
// HEADER SCROLL
// ==========================================
const header = document.getElementById('header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ==========================================
// BURGER MENU
// ==========================================
const burgerBtn = document.getElementById('burgerBtn');
const mobileNav = document.getElementById('mobileNav');
if (burgerBtn && mobileNav) {
  burgerBtn.addEventListener('click', () => {
    burgerBtn.classList.toggle('open');
    mobileNav.classList.toggle('open');
  });
}

// ==========================================
// UPLOAD
// ==========================================
const uploadZone = document.getElementById('uploadZone');
const imageInput = document.getElementById('imageInput');
const uploadFilename = document.getElementById('uploadFilename');

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});

imageInput.addEventListener('change', () => {
  if (imageInput.files[0]) loadImage(imageInput.files[0]);
});

function loadImage(file) {
  uploadFilename.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => { uploadedImage = img; };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================
// FONT SELECTOR
// ==========================================
document.querySelectorAll('.font-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.font-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFont = btn.dataset.font;
  });
});

// ==========================================
// CANVAS RENDER
// ==========================================
function renderCover(ctx, img, size, artistName, projectTitle, font) {
  // 1. Crop & draw image as square
  const srcSize = Math.min(img.width, img.height);
  const srcX = (img.width - srcSize) / 2;
  const srcY = (img.height - srcSize) / 2;
  ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

  // 2. Black & white + contrast + grain
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const contrastFactor = 1.6;
  const grainAmount = size === HD_SIZE ? 18 : 22;

  for (let i = 0; i < data.length; i += 4) {
    // Grayscale (perceptual)
    let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    // High contrast (S-curve approximation)
    lum = ((lum / 255 - 0.5) * contrastFactor + 0.5) * 255;
    lum = Math.min(255, Math.max(0, lum));

    // Grain / noise
    const noise = (Math.random() - 0.5) * grainAmount;
    lum = Math.min(255, Math.max(0, lum + noise));

    data[i] = data[i + 1] = data[i + 2] = lum;
    // alpha unchanged
  }
  ctx.putImageData(imageData, 0, 0);

  // 3. Dark gradient overlay (bottom 45%)
  const grad = ctx.createLinearGradient(0, size * 0.45, 0, size);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 4. Text
  const scale = size / PREVIEW_SIZE;
  ctx.textAlign = 'left';

  // Project title (smaller, above)
  if (projectTitle) {
    const titleSize = Math.round(28 * scale);
    ctx.font = `${titleSize}px "${font}"`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8 * scale;
    ctx.fillText(projectTitle.toUpperCase(), 32 * scale, size - 90 * scale);
  }

  // Artist name (large, bottom)
  if (artistName) {
    const nameSize = Math.round(54 * scale);
    ctx.font = `${nameSize}px "${font}"`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12 * scale;
    ctx.fillText(artistName, 28 * scale, size - 32 * scale);
  }

  // CP9 watermark (top right)
  ctx.textAlign = 'right';
  ctx.font = `${Math.round(13 * scale)}px monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.shadowBlur = 0;
  ctx.fillText('CP9 GENERATOR', size - 18 * scale, 28 * scale);
}

// ==========================================
// PREVIEW BUTTON
// ==========================================
const previewBtn = document.getElementById('previewBtn');
const previewCanvas = document.getElementById('previewCanvas');
const canvasPlaceholder = document.getElementById('canvasPlaceholder');

previewBtn.addEventListener('click', async () => {
  if (!uploadedImage) { alert('Importe une image d\'abord.'); return; }

  await document.fonts.ready;

  const ctx = previewCanvas.getContext('2d');
  const artistName = document.getElementById('artistName').value.trim();
  const projectTitle = document.getElementById('projectTitle').value.trim();

  previewBtn.textContent = 'Génération...';
  previewBtn.disabled = true;

  setTimeout(() => {
    renderCover(ctx, uploadedImage, PREVIEW_SIZE, artistName, projectTitle, selectedFont);
    canvasPlaceholder.style.display = 'none';
    previewBtn.textContent = 'Prévisualiser';
    previewBtn.innerHTML = 'Prévisualiser <span class="badge-free">Gratuit</span>';
    previewBtn.disabled = false;
  }, 50);
});

// ==========================================
// HD DOWNLOAD (Stripe 5€)
// ==========================================
const downloadBtn = document.getElementById('downloadBtn');

downloadBtn.addEventListener('click', async () => {
  if (!uploadedImage) { alert('Importe une image d\'abord.'); return; }
  if (!window.Stripe) { alert('Stripe non chargé.'); return; }

  const artistName = document.getElementById('artistName').value.trim();
  const projectTitle = document.getElementById('projectTitle').value.trim();

  // Store params for post-payment download
  try {
    // Compress image for sessionStorage (max 1000px, JPEG 0.8)
    const tmpCanvas = document.createElement('canvas');
    const maxDim = 1000;
    const ratio = Math.min(maxDim / uploadedImage.width, maxDim / uploadedImage.height, 1);
    tmpCanvas.width = Math.round(uploadedImage.width * ratio);
    tmpCanvas.height = Math.round(uploadedImage.height * ratio);
    tmpCanvas.getContext('2d').drawImage(uploadedImage, 0, 0, tmpCanvas.width, tmpCanvas.height);
    const compressed = tmpCanvas.toDataURL('image/jpeg', 0.8);

    sessionStorage.setItem('cp9_cover_image', compressed);
    sessionStorage.setItem('cp9_cover_artist', artistName);
    sessionStorage.setItem('cp9_cover_title', projectTitle);
    sessionStorage.setItem('cp9_cover_font', selectedFont);
  } catch (e) {
    alert('Impossible de sauvegarder l\'image. Réessaie avec une image moins lourde.');
    return;
  }

  downloadBtn.textContent = 'Chargement...';
  downloadBtn.disabled = true;

  try {
    const res = await fetch('/create-generator-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistName, projectTitle })
    });
    const data = await res.json();
    if (!data.id) { alert('Erreur serveur : ' + (data.message || 'Session introuvable.')); return; }
    const stripe = Stripe(window.STRIPE_PUBLIC_KEY);
    const result = await stripe.redirectToCheckout({ sessionId: data.id });
    if (result.error) alert(result.error.message);
  } catch (err) {
    alert('Erreur de connexion au serveur.');
  } finally {
    downloadBtn.innerHTML = 'Télécharger HD <span class="badge-paid">5 €</span>';
    downloadBtn.disabled = false;
  }
});
