const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve uploaded files (frame images, 3D models) publicly for the landing page and VTO
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// REPLACE your current app.use lines with this block:
const routeFiles = [
    { path: '/api/patients', file: './routes/patientRoutes' },
    { path: '/api/appointments', file: './routes/appointmentRoutes' },
    { path: '/api', file: './routes/posRoutes' },
    { path: '/api/auth', file: './routes/authRoutes' },
    { path: '/api/frames', file: './routes/frameRoutes' },
    { path: '/api/prescriptions', file: './routes/prescriptionRoutes' },
    { path: '/api/monitoring', file: './routes/monitoringRoutes' },
    { path: '/api/upload', file: './routes/uploadRoutes' }
];

routeFiles.forEach(r => {
    try {
        const routeModule = require(r.file);
        app.use(r.path, routeModule);
        console.log(`✅ Loaded: ${r.file}`);
    } catch (err) {
        console.error(`❌ FAILED TO LOAD: ${r.file}`);
        console.error(`   Reason: ${err.message}`);
    }
});

// Error handler (optional but good)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    console.log(`Server status: running active on port ${PORT}`);
});

