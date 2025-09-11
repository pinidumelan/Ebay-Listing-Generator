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
        maxDimension: 1600, // px, longest side
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
    if (!specs || typeof specs !== 'object') {
        specs = { 'Brand': data.brand || 'N/A', 'Condition': data.condition || 'Used', 'Category': data.category || 'Other' };
    }
    const rows = Object.entries(specs).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>`).join('');
    return `<table class="specs-table">
        <thead>
            <tr><th>Specification</th><th>Details</th></tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

function generateFallbackDescription(data) {
    const parts = [];
    if (data.brand && data.productName) parts.push(`${data.brand} ${data.productName}`);
    if (Array.isArray(data.keyFeatures) && data.keyFeatures.length) parts.push(`Key features: ${data.keyFeatures.join(', ')}`);
    if (data.condition) parts.push(`Condition: ${data.condition}`);
    return parts.join('. ') || 'Quality product in good condition.';
}

function generateCompleteHTML(title, specsHtml, description, data) {
    const imageElements = uploadedImages.map((img, index) => 
        `<img src="${img.base64}" alt="Product Image ${index + 1}" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">`
    ).join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .listing-header { text-align: center; margin-bottom: 30px; }
        .listing-title { color: #333; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
        .product-images { text-align: center; margin: 20px 0; }
        .specs-section { margin: 30px 0; }
        .description-section { margin: 30px 0; }
        .specs-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .specs-table th, .specs-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .specs-table th { background-color: #f5f5f5; font-weight: bold; }
        .section-title { color: #333; font-size: 18px; font-weight: bold; margin: 20px 0 10px 0; border-bottom: 2px solid #007ebf; padding-bottom: 5px; }
    </style>
</head>
<body>
    <div class="listing-header">
        <h1 class="listing-title">${escapeHtml(title)}</h1>
    </div>
    <div class="product-images">${imageElements}</div>
    <div class="specs-section">
        <h2 class="section-title">Product Specifications</h2>
        ${specsHtml}
    </div>
    <div class="description-section">
        <h2 class="section-title">Description</h2>
        <p>${escapeHtml(description)}</p>
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
