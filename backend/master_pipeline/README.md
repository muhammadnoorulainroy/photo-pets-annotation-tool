# 🔄 Master Image Processing Pipeline

**Automated pipeline for downloading, deduplicating, and biometric compliance processing of pet images.**

---

## 📋 Overview

This pipeline orchestrates the complete workflow for processing pet images with human face detection and obfuscation:

1. **Download** - Fetch images from Google Drive
2. **Deduplicate** - Remove duplicate images using perceptual hashing
3. **Biometric Compliance** - Detect and obfuscate human faces while preserving pet features
4. **Output** - Organized folders ready for annotation

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Google Cloud credentials (for Drive access)
- OpenAI API key (optional, for LLM-enhanced deduplication)

### Installation

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
# Edit ../backend/.env with your credentials
# (The pipeline automatically loads from backend/.env)

# 3. Run the pipeline
python master_pipeline.py --all
```

---

## 📁 Project Structure

```
master_pipeline_repo/
├── master_pipeline.py              # Main orchestrator
├── pipeline_config.py              # Configuration management
├── FaceDetectionBlur/              # Deduplication module
│   └── image_deduplicator_advanced.py
├── biometric_compliance_pipeline/  # Face processing module
│   ├── scripts/
│   │   └── stage3_obfuscate_faces_enhanced.py
│   ├── models/                     # AI models (Caffe, YOLO)
│   ├── config/                     # Pipeline settings
│   └── data/                       # Working directories
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment template
└── README.md                       # This file
```

---

## 🔧 Usage

### Run Complete Pipeline

```bash
python master_pipeline.py --all
```

### Run Individual Steps

```bash
# Step 1: Download from Google Drive
python master_pipeline.py --download

# Step 2: Remove duplicates
python master_pipeline.py --deduplicate

# Step 3: Biometric compliance processing
python master_pipeline.py --pipeline
```

### Advanced Options

```bash
# Use LLM for duplicate validation
python master_pipeline.py --deduplicate --use-llm

# Adjust similarity threshold
python master_pipeline.py --deduplicate --threshold 0.4

# Combine steps
python master_pipeline.py --deduplicate --pipeline
```

---

## ⚙️ Configuration

### Environment Variables

**⚠️ Configuration Location**: The pipeline uses `../backend/.env` (single source of truth)

Key variables:

```env
# Google Drive
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS=path/to/credentials.json

# OpenAI (optional)
OPENAI_API_KEY=your_api_key

# Pipeline Settings
DEDUP_THRESHOLD=0.32
USE_LLM_VALIDATION=false
```

### Workspace Structure

The pipeline creates the following structure:

```
pipeline_workspace/
├── 01_downloaded_from_drive/   # Raw downloaded images
├── 02_unique_images/            # After deduplication
├── 02_duplicate_clusters/       # Grouped duplicates
├── 03_biometric_processed/      # After face processing
│   ├── clean/                   # No human faces
│   └── blurred/                 # Human faces obfuscated
└── 04_final_output/             # Ready for annotation
```

---

## 🎯 Features

### 1. Deduplication
- **Perceptual hashing** (pHash, dHash, aHash)
- **Scene-based detection** (masks out humans, compares backgrounds)
- **Optional LLM validation** using OpenAI Vision API
- Configurable similarity threshold

### 2. Biometric Compliance
- **Human face detection** using InsightFace + OpenCV
- **Animal detection** using YOLOv8 (prevents obfuscating pets)
- **Context-preserving blur** (EgoBlur algorithm)
- **Multi-format support** (JPG, PNG, HEIC, HEIF, AVIF, WEBP)
- **QA review queue** for uncertain results

### 3. Pipeline Management
- Automatic folder structure creation
- Progress tracking and logging
- Detailed statistics and reporting
- Error handling and recovery

---

## 📊 Output

The pipeline generates:

1. **Processed Images**
   - Clean images (no human faces)
   - Obfuscated images (human faces blurred)

2. **Reports**
   - Processing statistics
   - Duplicate clusters
   - QA review checklist
   - Detailed logs

3. **Manifest**
   - Final image count
   - Processing metadata
   - File mappings

---

## 🔍 How It Works

### Step 1: Download
- Connects to Google Drive using service account
- Downloads all images from specified folder
- Supports various image formats

### Step 2: Deduplication
```python
# Uses advanced scene-based detection
1. Segment humans from images (YOLO)
2. Extract background features (ORB, histograms)
3. Compare perceptual hashes
4. Group similar images
5. Keep one unique per cluster
```

### Step 3: Biometric Compliance
```python
# Detects and obfuscates human faces
1. Detect human faces (InsightFace + OpenCV)
2. Detect animals (YOLOv8) - skip these
3. Apply context-preserving blur (EgoBlur)
4. Verify obfuscation quality
5. Route to clean/blurred/QA folders
```

---

## 🛠️ Troubleshooting

### Common Issues

**"No module named 'insightface'"**
```bash
pip install insightface onnxruntime
```

**"HEIC images not loading"**
```bash
pip install pillow-heif
```

**"Google Drive authentication failed"**
- Check credentials JSON path in `../backend/.env`
- Verify service account has access to folder

**"Out of memory during processing"**
- Reduce batch size in configuration
- Process images in smaller groups

---

## 📦 Dependencies

Core dependencies:
- `opencv-python` - Image processing
- `insightface` - Face detection
- `ultralytics` - YOLO animal detection
- `pillow`, `pillow-heif` - Image I/O
- `numpy`, `scipy` - Numerical operations
- `tqdm` - Progress bars
- `python-dotenv` - Environment management

Optional:
- `openai` - LLM duplicate validation
- `google-auth`, `google-api-python-client` - Google Drive

---

## 📈 Performance

**Typical Processing Times** (695 images):
- Download: ~2-5 minutes (depends on network)
- Deduplication: ~3-5 minutes
- Biometric processing: ~5-10 minutes
- **Total**: ~10-20 minutes

**Resource Usage**:
- Memory: 2-4 GB RAM
- Storage: 2x input size (for intermediate files)
- CPU: Optimized for multi-core processing

---

## 🤝 Contributing

This pipeline is part of the photo-pets-annotation-tool project.

---

## 📄 License

Copyright © 2026 Turing

---

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs in `biometric_compliance_pipeline/results/logs/`
3. Check environment configuration in `../backend/.env`

---

## 🎉 Success Criteria

Pipeline is successful when:
- ✅ All images downloaded from Drive
- ✅ Duplicates identified and segregated
- ✅ All images processed (clean or obfuscated)
- ✅ No failures or errors
- ✅ Output ready in `04_final_output/`

---

**Version**: 1.0.0  
**Last Updated**: February 2026
