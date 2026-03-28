# Cloudinary Integration Plan for Video/Audio Processing

## 1. Cloudinary Setup

- [x] Create a Cloudinary account (if not already done)
- [x] Get Cloudinary credentials: cloud name, API key, API secret
- [x] Add these credentials to your .env and Render environment variables

## 2. Backend (API) Changes

- [x] Install cloudinary and multer-storage-cloudinary packages
- [x] Configure Cloudinary in your backend
- [x] Update video upload endpoint to upload directly to Cloudinary
- [x] Store the Cloudinary video URL in the database (not a local path)

## 3. Worker (Consumer) Changes

- [x] Update job payload to include Cloudinary video URL
- [x] In the consumer, download the video from Cloudinary (using the URL)
- [x] Process the video (extract audio, transcribe, etc.)
- [x] Upload the processed audio file to Cloudinary
- [x] Store the Cloudinary audio URL in the database

## 4. Code Refactoring

- [ ] Remove or refactor local file path logic (uploads/ directory)
- [ ] Update all code that references local video/audio paths to use Cloudinary URLs

## 5. Testing

- [ ] Test video upload and ensure it appears in Cloudinary
- [ ] Test worker processing and ensure audio is uploaded to Cloudinary
- [ ] Test full workflow end-to-end (upload, process, retrieve URLs)

## 6. Deployment

- [ ] Commit and push all changes
- [ ] Update Render environment variables
- [ ] Redeploy backend and worker services

---

We will execute each step one by one. Mark each as complete before moving to the next.
