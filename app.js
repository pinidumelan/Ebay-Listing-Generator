// Application state
let uploadedImages = [];
let analysisResults = null;

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const modelSelect = document.getElementById('modelSelect');
const connectionStatus = document.getElementById('connectionStatus');
const analyzeBtn = document.getElementById('analyzeBtn');
const analysisLoader = document.getElementById('analysisLoader');
const progressFeedback = document.getElementById('progressFeedback');
const resultsSection = document.getElementById('resultsSection');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Configuration
const CONFIG = {
    maxFileSize: 20971520, // 20MB
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    geminiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/',
    apiKey: 'AIzaSyCZWFYD-sULvz6mGUJA-WA5RiKffNl6sfw',
    // Client-side image compression settings
    imageCompression: {
        maxDimension: 800, // px, longest side
        quality: 0.8,       // 0..1 for JPEG/WEBP
        outputType: 'image/jpeg' // convert to JPEG for best size savings
    },
    // eBay description character limit
    descriptionMaxChars: 500000,
    promptTemplate: `Analyze this product image and provide detailed information in JSON format with the following fields:
    - productName: specific product name
    - brand: manufacturer/brand name
    - category: product category
    - condition: estimated condition (new, used, refurbished)
    - specifications: object with key technical specs
    - keyFeatures: array of main selling points
    - suggestedTitle: SEO-optimized eBay title (max 80 chars)
    - description: compelling product description (max 500 chars)
    - estimatedValue: price range if identifiable
    
    Focus on accuracy and detail for eBay listing purposes. Return only valid JSON.`
};

// -------- Copy handler declared early to avoid reference issues --------
function handleCopyClick(e) {
    if (!e.target.classList.contains('copy-btn')) return;
    const copyType = e.target.getAttribute('data-copy');
    let textToCopy = '';
    switch (copyType) {
        case 'title': textToCopy = document.getElementById('generatedTitle').textContent.trim(); break;
        case 'specs': textToCopy = document.getElementById('generatedSpecs').innerText; break;
        case 'description': textToCopy = document.getElementById('generatedDescription').textContent.trim(); break;
        case 'html': textToCopy = document.getElementById('generatedHTML').value; break;
    }
    copyToClipboard(textToCopy, e.target);
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateAnalyzeButton();
});

// Event listeners setup
function setupEventListeners() {
    // File upload events
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Analysis button
    analyzeBtn.addEventListener('click', analyzeImages);
    
    // Copy buttons
    document.addEventListener('click', handleCopyClick);
    
    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadHTML);
    
    // Update analyze button when images change
    document.addEventListener('imagesChanged', updateAnalyzeButton);
}

// File handling functions
function handleDragOver(e) { e.preventDefault(); uploadArea.classList.add('dragover'); }
function handleDragLeave(e) { e.preventDefault(); uploadArea.classList.remove('dragover'); }
function handleDrop(e) { e.preventDefault(); uploadArea.classList.remove('dragover'); processFiles(Array.from(e.dataTransfer.files)); }
function handleFileSelect(e) { processFiles(Array.from(e.target.files)); }

async function processFiles(files) {
    const validFiles = files.filter(file => {
        if (!CONFIG.supportedFormats.includes(file.type)) {
            showToast(`${file.name} is not a supported format`, 'error');
            return false;
        }
        if (file.size > CONFIG.maxFileSize) {
            showToast(`${file.name} is too large (max 20MB)`, 'error');
            return false;
        }
        return true;
    });
    for (const file of validFiles) {
        try {
            const compressed = await compressImageFile(file, CONFIG.imageCompression);
            uploadedImages.push({
                id: Date.now() + Math.random(),
                file: file,
                name: file.name,
                size: compressed.sizeBytes,
                base64: compressed.dataUrl,
                type: compressed.mimeType
            });
            renderImagePreview();
            document.dispatchEvent(new Event('imagesChanged'));
        } catch (err) {
            console.error('Compression failed:', err);
            showToast(`Failed to process ${file.name}`, 'error');
        }
    }
}

function renderImagePreview() {
    if (uploadedImages.length === 0) { imagePreview.classList.add('hidden'); return; }
    imagePreview.classList.remove('hidden');
    imagePreview.innerHTML = uploadedImages.map(image => `
        <div class="preview-item" data-image-id="${image.id}">
            <img src="${image.base64}" alt="${image.name}" class="preview-image">
            <button class="preview-remove" onclick="removeImage('${image.id}')">&times;</button>
            <div class="preview-info">${image.name}<br><small>${formatFileSize(image.size)}</small></div>
        </div>
    `).join('');
}
function removeImage(imageId) { uploadedImages = uploadedImages.filter(img => img.id != imageId); renderImagePreview(); document.dispatchEvent(new Event('imagesChanged')); }
function formatFileSize(bytes) { if (bytes===0) return '0 Bytes'; const k=1024; const sizes=['Bytes','KB','MB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+sizes[i]; }

function updateAnalyzeButton() {
    const hasImages = uploadedImages.length > 0;
    analyzeBtn.disabled = !hasImages;
    connectionStatus.innerHTML = hasImages
        ? '<span class="status status--success">Ready to analyze</span>'
        : '<span class="status status--warning">Upload images to continue</span>';
}

// AI Analysis functions
async function analyzeImages() {
    if (uploadedImages.length === 0) { showToast('Please upload images', 'error'); return; }
    setAnalyzing(true); showProgress('Preparing images for analysis...');
    try {
        const imageContents = uploadedImages.map(img => ({ inlineData: { mimeType: img.type, data: img.base64.split(',')[1] } }));
        showProgress('Sending request to Gemini AI...');
        const response = await callGeminiAPI(imageContents);
        showProgress('Processing AI response...');
        analysisResults = response; generateEbayListing(response);
        showProgress('Analysis complete!'); setTimeout(() => hideProgress(), 2000);
    } catch (error) { console.error('Analysis error:', error); showToast(`Analysis failed: ${error.message}`, 'error'); hideProgress(); }
    finally { setAnalyzing(false); }
}

async function callGeminiAPI(imageContents) {
    const apiKey = CONFIG.apiKey;
    const model = modelSelect.value;
    const url = `${CONFIG.geminiEndpoint}${model}:generateContent?key=${apiKey}`;
    const requestBody = { contents: [{ parts: [{ text: CONFIG.promptTemplate }, ...imageContents] }], generationConfig: { temperature:0.1, topK:32, topP:1, maxOutputTokens:2048 } };
    const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(requestBody)});
    if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error?.message || `API request failed: ${response.status}`); }
    const data = await response.json();
    const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = textContent.replace(/```json/gi,'').replace(/```/g,'').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON found in response');
    return JSON.parse(jsonMatch[0]);
}

// eBay listing generation
function generateEbayListing(data) {
    const title = data.suggestedTitle || `${data.brand || ''} ${data.productName || 'Product'}`.trim();
    document.getElementById('generatedTitle').innerHTML = `<p><strong>${title}</strong></p>`;
    const specsHtml = generateSpecsTable(data.specifications, data);
    document.getElementById('generatedSpecs').innerHTML = specsHtml;
    const rawDescription = data.description || generateFallbackDescription(data);
    const description = truncateToLength(String(rawDescription), CONFIG.descriptionMaxChars);
    document.getElementById('generatedDescription').innerHTML = `<p>${description}</p>`;
    const completeHtml = generateCompleteHTML(title, specsHtml, description, data);
    document.getElementById('generatedHTML').value = completeHtml;
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    showToast('eBay listing generated successfully!', 'success');
}

function generateSpecsTable(specs, data) {
  // Fallback
  if (!specs || typeof specs !== 'object') {
    specs = {
      Brand: data.brand || 'N/A',
      Condition: data.condition || 'Used',
      Category: data.category || 'Other'
    };
  }

  // Flatten simple nested objects/arrays -> strings
  const flat = {};
  const toTitle = s => String(s)
    .replace(/[_\-]+/g, ' ')
    .replace(/\b([a-z])/g, m => m.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();

  const coerce = v => {
    if (v == null) return '—';
    if (Array.isArray(v)) return v.map(coerce).join(', ');
    if (typeof v === 'object') {
      // one level flatten
      return Object.entries(v).map(([k, val]) => `${toTitle(k)}: ${coerce(val)}`).join('; ');
    }
    return String(v);
  };

  Object.entries(specs).forEach(([k, v]) => {
    flat[toTitle(k)] = coerce(v);
  });

  const rows = Object.entries(flat)
    .filter(([, v]) => String(v).trim().length > 0)
    .map(([k, v]) =>
      `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`
    ).join('');

  return `
    <table class="specs-table">
      <thead><tr><th>Specification</th><th>Details</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function generateFallbackDescription(data) {
    const parts = [];
    if (data.brand && data.productName) parts.push(`${data.brand} ${data.productName}`);
    if (Array.isArray(data.keyFeatures) && data.keyFeatures.length) parts.push(`Key features: ${data.keyFeatures.join(', ')}`);
    if (data.condition) parts.push(`Condition: ${data.condition}`);
    return parts.join('. ') || 'Quality product in good condition.';
}

function buildBadges(data) {
  const badges = [];
  if (data.brand) badges.push({ label: 'Brand', value: data.brand });
  if (data.condition) badges.push({ label: 'Condition', value: data.condition });
  if (data.category) badges.push({ label: 'Category', value: data.category });
  return badges.map(b => `<span class="badge">${escapeHtml(b.label)}: ${escapeHtml(String(b.value))}</span>`).join('');
}

function buildFeatures(data) {
  if (Array.isArray(data.keyFeatures) && data.keyFeatures.length) {
    return `<ul class="features-list">
      ${data.keyFeatures.map(f => `<li>${escapeHtml(String(f))}</li>`).join('')}
    </ul>`;
  }
  return '';
}

function firstImageHtml() {
  if (typeof uploadedImages === 'undefined' || !uploadedImages.length) return '';
  const first = uploadedImages[0];
  return `<img alt="Product image" src="${first.base64}" class="hero-img">`;
}

function galleryHtml() {
  if (typeof uploadedImages === 'undefined' || uploadedImages.length <= 1) return '';
  const thumbs = uploadedImages.slice(1).map((img, i) =>
    `<img alt="Gallery image ${i+2}" src="${img.base64}" class="gallery-img">`
  ).join('');
  return `<div class="gallery">${thumbs}</div>`;
}

function generateCompleteHTML(title, specsHtml, description, data) {
  const badges = buildBadges(data);
  const features = buildFeatures(data);
  const hero = firstImageHtml();
  const gallery = galleryHtml();

  // Safe short subtitle
  const subtitleParts = [
    data.productName && data.brand ? `${data.brand} ${data.productName}` : '',
    data.category || '',
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{
    --bg:#0b1220; --card:#ffffff; --ink:#0f172a; --muted:#475569;
    --accent:#0ea5e9; --accent-ink:#ffffff; --line:#e5e7eb;
    --chip-bg:#e6f0ff; --chip-ink:#003f91;
  }
  body{margin:0;padding:0;background:#f8fafc;color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Inter,Arial,sans-serif}
  .wrap{max-width:980px;margin:0 auto;padding:16px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
  .header{padding:18px 16px 0}
  h1{font-size:22px;margin:0 0 6px}
  .subtitle{color:var(--muted);margin:0 0 10px}
  .badges{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
  .badge{background:var(--chip-bg);color:var(--chip-ink);border:1px solid #cfe0ff;padding:6px 10px;border-radius:999px;font-size:12px}
  .hero{padding:0 16px 16px}
  .hero-img{width:100%;height:auto;display:block;border-radius:12px;background:#f1f5f9}
  .section{padding:16px;border-top:1px solid var(--line)}
  .section h2{font-size:18px;margin:0 0 10px}
  .lead{color:var(--ink)}
  .features-list{padding-left:18px;margin:0}
  .features-list li{margin:6px 0}
  .specs-table{width:100%;border-collapse:collapse;font-size:14px}
  .specs-table thead th{background:#f8fafc}
  .specs-table th,.specs-table td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}
  .gallery{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
  .gallery-img{width:220px;height:auto;border:1px solid var(--line);border-radius:10px;background:#f8fafc}
  .note{font-size:12px;color:#334155}
  .cta{background:var(--accent);color:var(--accent-ink);padding:12px 16px;border-radius:10px;text-align:center;font-weight:600}
  .grid{display:grid;gap:12px}
  @media (min-width:720px){ .grid.cols-2{grid-template-columns:1fr 1fr} }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
        <div class="badges">${badges}</div>
      </div>

      <div class="hero">${hero}</div>

      <div class="section">
        <h2>Overview</h2>
        <p class="lead">${escapeHtml(description)}</p>
        ${features ? `<h2 style="margin-top:14px">Key Features</h2>${features}` : ''}
      </div>

      <div class="section">
        <h2>Specifications</h2>
        ${specsHtml}
        ${gallery}
      </div>

      <div class="section grid cols-2">
        <div>
          <h2>What’s Included</h2>
          <ul class="features-list">
            <li>Main product as pictured</li>
            <li>Any accessories shown (unless stated otherwise)</li>
            <li>Secure packaging</li>
          </ul>
        </div>
        <div>
          <h2>Shipping & Returns</h2>
          <ul class="features-list">
            <li>Fast dispatch within 1–2 business days</li>
            <li>Tracked shipping</li>
            <li>30-day returns (buyer pays return postage unless DOA)</li>
          </ul>
          <p class="note">Questions? Message us via eBay—happy to help.</p>
        </div>
      </div>

      <div class="section">
        <div class="cta">Buy with confidence — Trusted seller, responsive support</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Utility functions
function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

function truncateToLength(text, maxChars) {
    if (!Number.isFinite(maxChars) || maxChars <= 0) return '';
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

function estimateBase64SizeBytes(dataUrl) {
    const base64 = String(dataUrl).split(',')[1] || '';
    return Math.floor(base64.length * 0.75);
}

async function compressImageFile(file, options) {
    const { maxDimension, quality, outputType } = options || {};
    // Read original image
    const dataUrl = await readFileAsDataURL(file);
    const img = await loadImage(dataUrl);

    // Compute target dimensions while preserving aspect ratio
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;
    const longest = Math.max(originalWidth, originalHeight);
    if (Number.isFinite(maxDimension) && longest > maxDimension) {
        const scale = maxDimension / longest;
        targetWidth = Math.round(originalWidth * scale);
        targetHeight = Math.round(originalHeight * scale);
    }

    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // For JPEG conversion, paint white background to avoid black for transparent PNG
    if ((outputType || '').includes('jpeg') || (outputType || '').includes('jpg')) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Export compressed
    const mimeType = outputType || file.type || 'image/jpeg';
    const q = typeof quality === 'number' ? Math.min(1, Math.max(0, quality)) : 0.8;
    const compressedDataUrl = canvas.toDataURL(mimeType, q);

    return {
        dataUrl: compressedDataUrl,
        mimeType,
        sizeBytes: estimateBase64SizeBytes(compressedDataUrl),
        width: targetWidth,
        height: targetHeight
    };
}

async function copyToClipboard(text, button) {
    try { await navigator.clipboard.writeText(text); button.classList.add('copied'); showToast('Copied to clipboard!', 'success'); setTimeout(() => { button.classList.remove('copied'); }, 2000); }
    catch (error) { const textArea = document.createElement('textarea'); textArea.value = text; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea); showToast('Copied to clipboard!', 'success'); }
}

function downloadHTML() {
    const htmlContent = document.getElementById('generatedHTML').value;
    if (!htmlContent) { showToast('No HTML content to download', 'error'); return; }
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ebay-listing.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('HTML file downloaded!', 'success');
}

function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function setAnalyzing(analyzing) {
    analyzeBtn.disabled = analyzing || uploadedImages.length === 0;
    const btnText = analyzeBtn.querySelector('.btn-text'); const loader = analysisLoader;
    if (analyzing) { btnText.textContent = 'Analyzing...'; loader.classList.remove('hidden'); }
    else { btnText.textContent = 'Analyze Images'; loader.classList.add('hidden'); }
}

function showProgress(message) { progressFeedback.textContent = message; progressFeedback.classList.add('show'); }
function hideProgress() { progressFeedback.classList.remove('show'); }
