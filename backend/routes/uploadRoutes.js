const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary-v2');
const path = require('path');

// Configure Cloudinary using Render environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'gonzales-vision-clinic-uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'glb', 'gltf'],
        resource_type: 'auto',
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.glb', '.gltf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only image / 3D model files are allowed.'));
    },
}).single('file');

// POST /api/upload with safe error catching to prevent 502 crashes
router.post('/', (req, res) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading (e.g. file size limit exceeded)
            console.error("Multer error:", err);
            return res.status(400).json({ error: `Multer upload error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred (e.g. Cloudinary config missing or invalid format)
            console.error("Cloudinary/Upload error:", err);
            return res.status(500).json({ error: `Upload processing error: ${err.message}` });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file received.' });
        }

        // Successfully uploaded to Cloudinary
        const fileUrl = req.file.path;
        return res.json({ url: fileUrl, filename: req.file.filename });
    });
});

module.exports = router;