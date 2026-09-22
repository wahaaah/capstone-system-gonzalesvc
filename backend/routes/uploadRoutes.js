const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const path = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowed = [
            '.jpg',
            '.jpeg',
            '.png',
            '.webp',
            '.gif',
            '.glb',
            '.gltf'
        ];

        const ext = path.extname(file.originalname).toLowerCase();

        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image / 3D model files are allowed.'));
        }
    }
}).single('file');


router.post('/', (req, res) => {
    console.log('📥 /api/upload request received');

    upload(req, res, function (err) {
        if (err) {
            console.error('❌ MULTER ERROR:', err);

            return res.status(500).json({
                success: false,
                error: err.message || 'Upload failed'
            });
        }

        if (!req.file) {
            console.error('❌ No file received');

            return res.status(400).json({
                success: false,
                error: 'No file received'
            });
        }

        console.log('📦 File received:', req.file.originalname);
        console.log('📦 File size:', req.file.size);

        const is3D =
            ['.glb', '.gltf'].includes(
                path.extname(req.file.originalname).toLowerCase()
            );

        const uploadOptions = {
            folder: 'gonzales-vision-clinic-uploads',
            resource_type: is3D ? 'raw' : 'image'
        };

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {

                if (error) {
                    console.error('❌ CLOUDINARY ERROR:', error);

                    return res.status(500).json({
                        success: false,
                        error: error.message || 'Cloudinary upload failed'
                    });
                }

                console.log('✅ Cloudinary upload successful');
                console.log('📎 URL:', result.secure_url);

                return res.status(200).json({
                    success: true,
                    url: result.secure_url,
                    filename: result.public_id
                });
            }
        );

        stream.end(req.file.buffer);
    });
});


module.exports = router;