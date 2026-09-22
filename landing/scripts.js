document.addEventListener('DOMContentLoaded', async () => {
    // ── STATE VARIABLES ──
    const apiBase = document.body.dataset.api || 'https://gonzalesvisionclinic.onrender.com';
    let allFrames = [];
    let searchQuery = '';
    let selectedCategory = 'All';

    // ── THREE.JS & VTO SETUP ──
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    var modalContainer = document.getElementById('modal-container');
    var vtoModal = document.getElementById('faceFilterModal');
    var previewModal = document.getElementById('previewModal');
    
    var model;
    var rendererAttached = false;
    var currentStream = null;

    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    const loader = new THREE.GLTFLoader();

    function attachRenderer() {
        if (rendererAttached) return;
        var w = modalContainer.clientWidth || 640;
        var h = modalContainer.clientHeight || 480;
        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);
        modalContainer.appendChild(renderer.domElement);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        rendererAttached = true;
    }

    function onWindowResize() {
        if (!rendererAttached) return;
        var w = modalContainer.clientWidth;
        var h = modalContainer.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }
    window.addEventListener('resize', onWindowResize);

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    function loadGLTFModel(filePath) {
        if (vtoModal) vtoModal.style.display = 'flex';
        attachRenderer();

        loader.load(filePath, function (gltf) {
            if (model) { scene.remove(model); model = null; }
            model = gltf.scene;
            model.scale.set(0.1, 0.1, 0.1);
            model.rotation.y = Math.PI;
            model.position.set(-5, 0, -5);
            scene.add(model);
            animate();
            run();
        }, undefined, function(err) {
            console.error('Error loading GLTF model:', err);
        });
    }

    function screenToWorldCoordinates(screenPoint, displaySize) {
        const { width, height } = displaySize;
        const x = (screenPoint.x / width) * 2 - 1;
        const y = -(screenPoint.y / height) * 2 + 1;
        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        return camera.position.clone().add(dir.multiplyScalar(distance));
    }

    async function run() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            currentStream = stream;
            
            var video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            var videoTexture = new THREE.VideoTexture(video);
            var geometry = new THREE.PlaneGeometry(20, 20);
            var material = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide });
            var plane = new THREE.Mesh(geometry, material);
            plane.position.set(0, 0, -5);
            scene.add(plane);

            video.addEventListener('playing', async () => {
                const displaySize = { width: video.videoWidth, height: video.videoHeight };

                setInterval(async () => {
                    if (!model) return;
                    const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();

                    if (detections.length > 0) {
                        const detection = detections[0];
                        const leftEye = detection.landmarks.getLeftEye();
                        const rightEye = detection.landmarks.getRightEye();

                        const centerX = (leftEye[0].x + rightEye[0].x) / 2;
                        const centerY = (leftEye[0].y + rightEye[0].y) / 2;

                        const worldCenterPoint = screenToWorldCoordinates({ x: centerX, y: centerY }, displaySize);

                        const eyeToEyebrowOffset = 1;
                        const adjustedWorldCenterPoint = {
                            x: worldCenterPoint.x,
                            y: worldCenterPoint.y - eyeToEyebrowOffset,
                            z: worldCenterPoint.z
                        };

                        if (!isNaN(adjustedWorldCenterPoint.x)) {
                            model.position.copy(adjustedWorldCenterPoint);
                        }

                        const deltaY = rightEye[0].y - leftEye[0].y;
                        const deltaX = rightEye[0].x - leftEye[0].x;
                        const angle = Math.atan2(deltaY, deltaX);
                        model.rotation.z = angle;

                        const distanceBetweenEyes = Math.sqrt(
                            Math.pow(rightEye[0].x - leftEye[0].x, 2) +
                            Math.pow(rightEye[0].y - leftEye[0].y, 2)
                        );
                        const scaleFactor = distanceBetweenEyes / 200;

                        if (!isNaN(scaleFactor) && scaleFactor > 0) {
                            model.scale.set(scaleFactor, scaleFactor, scaleFactor);
                        }
                    }
                }, 100);
            });
        } catch (err) {
            console.error('Unable to access the camera.', err);
            const status = document.getElementById('vto-status');
            if (status) status.textContent = 'Camera access denied. Please allow camera permissions and try again.';
        }
    }

    // ── DETAILS PREVIEW MODAL HANDLERS ──
    function openPreviewModal(frame, isConverted, modelUrl, imgUrl) {
        if (!previewModal) return;

        document.getElementById('previewModalImg').src = imgUrl;
        document.getElementById('previewModalTitle').textContent = frame.name || 'Eyeglass Frame';
        document.getElementById('previewModalPrice').textContent = `₱${Number(frame.price || 0).toFixed(2)}`;
        document.getElementById('previewModalDesc').textContent = frame.description || `${frame.brand || 'Gonzales Vision'} ${frame.category || 'Eyewear'}. High-quality frame designed for comfort and durability.`;

        const tryOnBtn = document.getElementById('previewTryOnBtn');
        if (isConverted && modelUrl) {
            tryOnBtn.disabled = false;
            tryOnBtn.style.background = '#2563eb';
            tryOnBtn.style.cursor = 'pointer';
            tryOnBtn.textContent = 'Try On 3D';
            tryOnBtn.onclick = () => {
                closePreviewModal();
                loadGLTFModel(modelUrl);
            };
        } else {
            tryOnBtn.disabled = true;
            tryOnBtn.style.background = '#cbd5e1';
            tryOnBtn.style.cursor = 'not-allowed';
            tryOnBtn.textContent = frame.conversion_status === 'Processing' ? 'Converting...' : '2D Only';
        }

        previewModal.style.display = 'flex';
    }

    function closePreviewModal() {
        if (previewModal) previewModal.style.display = 'none';
    }

    // ── CARD RENDERING & FILTERING ──
    function renderFrameCards(framesToRender) {
        const frameGrid = document.getElementById('frame-grid');
        if (!frameGrid) return;

        if (framesToRender.length === 0) {
            frameGrid.innerHTML = '<p style="color:#64748b; padding:1.5rem 0; grid-column: 1 / -1;">No frames found matching your criteria.</p>';
            return;
        }

        frameGrid.innerHTML = '';
        framesToRender.forEach(frame => {
            const isConverted = frame.conversion_status === 'Converted' && frame.model_3d_url;
            const modelUrl = isConverted 
                ? (frame.model_3d_url.startsWith('http') ? frame.model_3d_url : `${apiBase}${frame.model_3d_url}`)
                : null;

            const rawImg = frame.image_2d_url || frame.image_url;
            const imgUrl = rawImg 
                ? (rawImg.startsWith('http') ? rawImg : `${apiBase}${rawImg}`)
                : 'https://via.placeholder.com/300x150?text=No+Image';

            const card = document.createElement('div');
            card.className = 'frame-card';
            card.innerHTML = `
                <div class="frame-img-box">
                    <img 
                        src="${imgUrl}" 
                        alt="${frame.name || 'Frame'}" 
                        onerror="this.onerror=null; this.src='https://via.placeholder.com/300x150?text=Image+Unavailable';"
                    />
                </div>
                <h4>${frame.name || 'Unnamed Frame'}</h4>
                <p>${frame.brand || 'Gonzales Vision'} ${frame.category ? '• ' + frame.category : ''}</p>
                <p class="price">₱${Number(frame.price || 0).toFixed(2)}</p>
                <div class="card-actions">
                    <button class="btn-secondary view-btn">View Details</button>
                    ${isConverted 
                        ? `<button class="try-on-btn try-btn" data-model="${modelUrl}">Try On 3D</button>`
                        : `<button class="try-on-btn" style="background:#cbd5e1; cursor:not-allowed;" disabled>${frame.conversion_status === 'Processing' ? 'Converting...' : '2D Only'}</button>`
                    }
                </div>
            `;

            card.querySelector('.view-btn').addEventListener('click', () => {
                openPreviewModal(frame, isConverted, modelUrl, imgUrl);
            });

            if (isConverted) {
                card.querySelector('.try-btn').addEventListener('click', function() {
                    loadGLTFModel(this.dataset.model);
                });
            }

            frameGrid.appendChild(card);
        });
    }

    function applyFilters() {
        const filtered = allFrames.filter(frame => {
            const frameName = String(frame.name || '').toLowerCase();
            const frameBrand = String(frame.brand || '').toLowerCase();
            const frameCat = String(frame.category || '').toLowerCase();

            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = query === '' || frameName.includes(query) || frameBrand.includes(query);

            const targetCat = selectedCategory.toLowerCase();
            const matchesCategory = selectedCategory === 'All' || frameCat.includes(targetCat);

            return matchesSearch && matchesCategory;
        });

        renderFrameCards(filtered);
    }

    async function loadFramesFromAPI() {
        const frameGrid = document.getElementById('frame-grid');
        if (!frameGrid) return;

        try {
            const resp = await fetch(`${apiBase}/api/frames`);
            if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);

            allFrames = await resp.json();
            applyFilters();
        } catch (err) {
            console.error('Failed to load frames from API:', err);
            if (frameGrid) frameGrid.innerHTML = '<p style="color:#ef4444; padding:1.5rem 0;">Failed to load frames.</p>';
        }
    }

    // ── SEARCH & CATEGORY EVENT LISTENERS ──
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            applyFilters();
        });
    }

    const categoryPills = document.getElementById('categoryPills');
    if (categoryPills) {
        categoryPills.addEventListener('click', (e) => {
            const btn = e.target.closest('.pill-btn');
            if (!btn) return;

            categoryPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            selectedCategory = btn.dataset.category || 'All';
            applyFilters();
        });
    }

    // Load database frames
    loadFramesFromAPI();

    // ── FACE DETECTION INITIALIZATION ──
    async function initFaceDetection() {
        const status = document.getElementById('vto-status');
        if (status) status.textContent = 'Loading face detection models…';
        try {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
                faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
                faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
                faceapi.nets.ageGenderNet.loadFromUri('./models'),
            ]);
            if (status) status.textContent = 'Ready — click a frame to try it on!';
        } catch (err) {
            console.error('Failed to load face-api models:', err);
            if (status) status.textContent = 'Failed to load face detection models.';
        }
    }
    await initFaceDetection();

    // ── CLEANUP & MODAL CLOSING ──
    function closeVirtualTryOn() {
        if (vtoModal) vtoModal.style.display = 'none';
        
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        
        if (model) {
            scene.remove(model);
            model = null;
        }
        
        const videoMesh = scene.children.find(child => child.geometry?.type === 'PlaneGeometry');
        if (videoMesh) {
            scene.remove(videoMesh);
        }
    }

    const closeVTOBtn = document.getElementById('closeVTOBtn') || document.querySelector('#faceFilterModal .close');
    if (closeVTOBtn) closeVTOBtn.onclick = closeVirtualTryOn;

    const closePreviewBtn = document.getElementById('closePreviewBtn');
    if (closePreviewBtn) closePreviewBtn.onclick = closePreviewModal;
    
    window.onclick = function (event) {
        if (event.target === vtoModal) closeVirtualTryOn();
        if (event.target === previewModal) closePreviewModal();
    };
});