# AI eBay Listing Generator - User Guide

## Overview
This application uses Google's Gemini AI to analyze product images and automatically generate professional eBay listings with SEO-optimized titles, detailed specifications, and self-contained HTML descriptions.

## How to Use

### Step 1: Upload Product Images
- **Drag and Drop**: Simply drag image files onto the upload area
- **Click to Select**: Click the upload area to browse and select files
- **Supported Formats**: JPG, PNG, WEBP (max 20MB each)
- **Multiple Images**: Upload multiple angles of the same product for better analysis

### Step 2: API Configuration
- **API Key**: Pre-filled with the provided Gemini API key
- **Model Selection**: Choose from available Gemini models (recommended: gemini-2.0-flash-exp)
- **Connection Status**: Green indicator shows successful API connection

### Step 3: AI Analysis
- Click **"Analyze Images"** to start the AI processing
- Wait for the analysis to complete (typically 5-30 seconds)
- Progress feedback will show current processing status

### Step 4: Review Results
The application generates:
- **eBay Title**: SEO-optimized, 80-character maximum
- **Product Specifications**: Organized table of technical details
- **Description**: Compelling product description under 500 characters
- **Self-Contained HTML**: Complete listing with embedded base64 images

### Step 5: Copy and Use
- Use the **Copy** buttons to copy individual sections
- Copy the complete HTML for immediate eBay listing use
- The HTML is self-contained with no external dependencies

## Features

### AI-Powered Analysis
- **Product Identification**: Automatically identifies product name, brand, and category
- **Specification Extraction**: Pulls technical specifications from image analysis
- **Condition Assessment**: Estimates product condition based on visual analysis
- **SEO Optimization**: Generates titles following eBay best practices

### Professional Output
- **eBay-Compliant HTML**: Follows eBay's HTML guidelines and restrictions
- **Mobile-Responsive**: Generated listings work on all devices
- **Base64 Images**: Self-contained listings with embedded images
- **Professional Styling**: Clean, trustworthy appearance

### User Experience
- **Drag-and-Drop Upload**: Intuitive file upload interface
- **Real-Time Preview**: See uploaded images immediately
- **Progress Feedback**: Clear status updates during processing
- **Error Handling**: User-friendly error messages and recovery options

## Tips for Best Results

### Image Quality
- Use high-resolution, well-lit images
- Show multiple angles of the product
- Include any visible branding or model numbers
- Ensure the product is the main focus of the image

### Product Types
The AI works best with:
- Electronics and gadgets
- Branded consumer products
- Items with visible specifications or model numbers
- Products with distinctive features

### eBay Listing Optimization
- Review generated titles for keyword relevance
- Add location-specific terms if needed
- Verify specifications match your actual product
- Customize descriptions for your target audience

## Troubleshooting

### Common Issues
- **Large File Sizes**: Resize images under 20MB before upload
- **Unsupported Formats**: Use JPG, PNG, or WEBP formats only
- **API Errors**: Check internet connection and API key validity
- **Poor Analysis**: Try uploading clearer, higher-quality images

### Error Messages
- **"File too large"**: Reduce image size or resolution
- **"Invalid format"**: Convert to supported image format
- **"API connection failed"**: Check network and API key
- **"Analysis failed"**: Try with different images or retry

## Privacy and Security

### Data Handling
- Images are processed securely through Google's Gemini API
- No images are stored permanently on servers
- API communications are encrypted
- Generated content can be cleared from browser memory

### API Key Security
- API key is stored only in browser session
- Never share your API key with others
- Monitor API usage through Google Cloud Console
- Revoke and regenerate keys if compromised

## Advanced Usage

### Customizing Output
- Edit generated titles to include specific keywords
- Modify descriptions for your target market
- Add additional specifications manually
- Adjust pricing based on market research

### Bulk Processing
- Upload multiple products in sequence
- Save generated HTML files for batch listing
- Use consistent naming conventions for organization
- Track performance of different listing styles

## Support

### Getting Help
- Review this guide for common solutions
- Check browser console for technical errors
- Verify API key has sufficient quota
- Try with different images if analysis fails

### Best Practices
- Test with sample products first
- Keep API usage within daily limits
- Backup important generated content
- Regularly update API keys for security
