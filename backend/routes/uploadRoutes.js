const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');

// Configure Cloudinary using Render environment variables
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up Cloudinary storage destination for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'gonzales-vision-clinic-uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'glb', 'gltf'],
        resource_type: 'auto', // Essential for handling both images and 3D .glb files
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
});

// POST /api/upload — uploads directly to Cloudinary and returns the permanent secure URL
router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    
    // req.file.path returns the secure, permanent https://res.cloudinary.com/... URL
    const fileUrl = req.file.path;
    res.json({ url: fileUrl, filename: req.file.filename });
});

module.exports = router;