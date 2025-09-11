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

function processFiles(files) {
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
    validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImages.push({
                id: Date.now() + Math.random(),
                file: file,
                name: file.name,
                size: file.size,
                base64: e.target.result,
                type: file.type
            });
            renderImagePreview();
            document.dispatchEvent(new Event('imagesChanged'));
        };
        reader.readAsDataURL(file);
    });
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
    connectionStatus.innerHTML = hasImages ? '<span class="status status--success">Ready to analyze</span>' : '<span class="status status--warning">Upload images to continue</span>';
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

// ... (rest of app.js unchanged from your version, including listing generation, copy/download, showToast etc.)
