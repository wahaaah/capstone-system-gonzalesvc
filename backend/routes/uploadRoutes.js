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


router.post('/', (req, res) => {
    console.log('📥 /api/upload request received');

    upload(req, res, function (err) {
        if (err) {
            console.error('❌ UPLOAD ERROR:', err);
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);

            return res.status(500).json({
                success: false,
                error: err.message || 'Upload failed',
                name: err.name || 'UnknownError'
            });
        }

        console.log('📦 req.file:', req.file);

        if (!req.file) {
            console.error('❌ No file received');

            return res.status(400).json({
                success: false,
                error: 'No file received'
            });
        }

        console.log('✅ Cloudinary upload successful');
        console.log('📎 URL:', req.file.path);

        return res.status(200).json({
            success: true,
            url: req.file.path,
            filename: req.file.filename
        });
    });
});

module.exports = router;