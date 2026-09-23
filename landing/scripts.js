document.addEventListener('DOMContentLoaded', async () => {

    // ── STATE VARIABLES ──

    const apiBase =
        document.body.dataset.api ||
        'https://gonzalesvisionclinic.onrender.com';

    let allFrames = [];
    let searchQuery = '';
    let selectedCategory = 'All';

    // ── THREE.JS & VTO SETUP ──

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(
        75,
        1,
        0.1,
        100
    );

    var renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    var modalContainer =
        document.getElementById('modal-container');

    var vtoModal =
        document.getElementById('faceFilterModal');

    var previewModal =
        document.getElementById('previewModal');

    var model;
    var rendererAttached = false;
    var currentStream = null;

    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    var ambientLight =
        new THREE.AmbientLight(0xffffff, 0.6);

    scene.add(ambientLight);

    var directionalLight =
        new THREE.DirectionalLight(0xffffff, 1);

    directionalLight.position
        .set(1, 1, 1)
        .normalize();

    scene.add(directionalLight);

    const loader = new THREE.GLTFLoader();

    // ── RENDERER ──

    function attachRenderer() {
        if (rendererAttached) return;

        var w =
            modalContainer.clientWidth || 640;

        var h =
            modalContainer.clientHeight || 480;

        renderer.setSize(w, h);
        renderer.setPixelRatio(window.devicePixelRatio);

        modalContainer.appendChild(
            renderer.domElement
        );

        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        rendererAttached = true;
    }

    function onWindowResize() {
        if (!rendererAttached) return;

        var w = modalContainer.clientWidth;
        var h = modalContainer.clientHeight;

        if (!w || !h) return;

        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        renderer.setSize(w, h);
    }

    window.addEventListener(
        'resize',
        onWindowResize
    );

    // ── ANIMATION ──

    function animate() {
        requestAnimationFrame(animate);

        renderer.render(
            scene,
            camera
        );
    }

    // ── LOAD 3D MODEL ──

    function loadGLTFModel(filePath) {

        if (vtoModal) {
            vtoModal.style.display = 'flex';
        }

        attachRenderer();

        loader.load(
            filePath,

            function (gltf) {

                if (model) {
                    scene.remove(model);
                    model = null;
                }

                model = gltf.scene;

                model.scale.set(
                    0.1,
                    0.1,
                    0.1
                );

                model.rotation.y = Math.PI;

                model.position.set(
                    -5,
                    0,
                    -5
                );

                scene.add(model);

                animate();

                run();
            },

            undefined,

            function (err) {
                console.error(
                    'Error loading GLTF model:',
                    err
                );

                const status =
                    document.getElementById(
                        'vto-status'
                    );

                if (status) {
                    status.textContent =
                        '❌ Failed to load 3D model.';
                }
            }
        );
    }

    // ── SCREEN TO WORLD ──

    function screenToWorldCoordinates(
        screenPoint,
        displaySize
    ) {

        const {
            width,
            height
        } = displaySize;

        const x =
            (screenPoint.x / width) * 2 - 1;

        const y =
            -(screenPoint.y / height) * 2 + 1;

        const vector =
            new THREE.Vector3(
                x,
                y,
                0.5
            );

        vector.unproject(camera);

        const dir =
            vector
                .sub(camera.position)
                .normalize();

        const distance =
            -camera.position.z / dir.z;

        return camera.position
            .clone()
            .add(
                dir.multiplyScalar(distance)
            );
    }

    // =========================================================
    // CAMERA + VIDEO + FACE TRACKING
    // =========================================================

    async function run() {

        try {

            console.log(
                '📷 Starting camera...'
            );

            // =====================================================
            // GET CAMERA STREAM
            // =====================================================

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    video: mobileTryOn
                        ? {
                            facingMode: 'user'
                        }
                        : true
                });

            currentStream = stream;

            console.log(
                '📷 Camera stream obtained'
            );

            console.log(
                '📷 Video tracks:',
                stream.getVideoTracks()
            );

            // =====================================================
            // CREATE VIDEO ELEMENT
            // =====================================================

            const video =
                document.createElement('video');

            video.srcObject = stream;

            video.autoplay = true;
            video.muted = true;
            video.playsInline = true;

            // Android WebView compatibility
            video.setAttribute(
                'autoplay',
                ''
            );

            video.setAttribute(
                'muted',
                ''
            );

            video.setAttribute(
                'playsinline',
                ''
            );

            video.setAttribute(
                'webkit-playsinline',
                ''
            );

            // =====================================================
            // MOBILE WEBVIEW
            // =====================================================

            if (mobileTryOn) {

                console.log(
                    '📱 Mobile WebView video configured'
                );

                try {

                    await video.play();

                    console.log(
                        '✅ Mobile camera video playing:',
                        video.videoWidth,
                        'x',
                        video.videoHeight
                    );

                } catch (playError) {

                    console.error(
                        '❌ Mobile video.play() failed:',
                        playError
                    );
                }

            } else {

                // =================================================
                // NORMAL WEBSITE
                // =================================================

                video
                    .play()
                    .catch((error) => {

                        console.error(
                            '❌ Video play failed:',
                            error
                        );

                    });
            }

            // =====================================================
            // CREATE VIDEO TEXTURE
            // =====================================================

            const videoTexture =
                new THREE.VideoTexture(video);

            videoTexture.minFilter =
                THREE.LinearFilter;

            videoTexture.magFilter =
                THREE.LinearFilter;

            videoTexture.format =
                THREE.RGBAFormat;

            // =====================================================
            // CAMERA BACKGROUND PLANE
            // =====================================================

            const geometry =
                new THREE.PlaneGeometry(
                    20,
                    20
                );

            const material =
                new THREE.MeshBasicMaterial({
                    map: videoTexture,
                    side: THREE.DoubleSide
                });

            const plane =
                new THREE.Mesh(
                    geometry,
                    material
                );

            // Put camera behind the glasses
            plane.position.set(
                0,
                0,
                -6
            );

            scene.add(plane);

            console.log(
                '🎥 Camera plane added to Three.js scene'
            );

            // =====================================================
            // VIDEO PLAYING EVENT
            // =====================================================

            video.addEventListener(
                'playing',
                () => {

                    console.log(
                        '🎥 VIDEO PLAYING EVENT:',
                        video.videoWidth,
                        'x',
                        video.videoHeight
                    );

                }
            );

            // =====================================================
            // FACE DETECTION
            // =====================================================

            video.addEventListener(
                'playing',
                async () => {

                    const displaySize = {
                        width:
                            video.videoWidth,

                        height:
                            video.videoHeight
                    };

                    console.log(
                        '🙂 Face detection started:',
                        displaySize
                    );

                    setInterval(
                        async () => {

                            if (!model) return;

                            try {

                                const detections =
                                    await faceapi
                                        .detectAllFaces(
                                            video
                                        )
                                        .withFaceLandmarks();

                                if (
                                    detections.length > 0
                                ) {

                                    const detection =
                                        detections[0];

                                    const leftEye =
                                        detection
                                            .landmarks
                                            .getLeftEye();

                                    const rightEye =
                                        detection
                                            .landmarks
                                            .getRightEye();

                                    // =================================================
                                    // FACE CENTER
                                    // =================================================

                                    const centerX =
                                        (
                                            leftEye[0].x +
                                            rightEye[0].x
                                        ) / 2;

                                    const centerY =
                                        (
                                            leftEye[0].y +
                                            rightEye[0].y
                                        ) / 2;

                                    const worldCenterPoint =
                                        screenToWorldCoordinates(
                                            {
                                                x: centerX,
                                                y: centerY
                                            },
                                            displaySize
                                        );

                                    // =================================================
                                    // FRAME POSITION
                                    // =================================================

                                    const eyeToEyebrowOffset =
                                        1;

                                    const adjustedWorldCenterPoint =
                                        {
                                            x:
                                                worldCenterPoint.x,

                                            y:
                                                worldCenterPoint.y -
                                                eyeToEyebrowOffset,

                                            z:
                                                worldCenterPoint.z
                                        };

                                    if (
                                        !isNaN(
                                            adjustedWorldCenterPoint.x
                                        )
                                    ) {

                                        model.position.copy(
                                            adjustedWorldCenterPoint
                                        );
                                    }

                                    // =================================================
                                    // FRAME ROTATION
                                    // =================================================

                                    const deltaY =
                                        rightEye[0].y -
                                        leftEye[0].y;

                                    const deltaX =
                                        rightEye[0].x -
                                        leftEye[0].x;

                                    const angle =
                                        Math.atan2(
                                            deltaY,
                                            deltaX
                                        );

                                    model.rotation.z =
                                        angle;

                                    // =================================================
                                    // FRAME SCALE
                                    // =================================================

                                    const distanceBetweenEyes =
                                        Math.sqrt(
                                            Math.pow(
                                                rightEye[0].x -
                                                    leftEye[0].x,
                                                2
                                            ) +
                                            Math.pow(
                                                rightEye[0].y -
                                                    leftEye[0].y,
                                                2
                                            )
                                        );

                                    const scaleFactor =
                                        distanceBetweenEyes /
                                        200;

                                    if (
                                        !isNaN(
                                            scaleFactor
                                        ) &&
                                        scaleFactor > 0
                                    ) {

                                        model.scale.set(
                                            scaleFactor,
                                            scaleFactor,
                                            scaleFactor
                                        );
                                    }
                                }

                            } catch (faceError) {

                                console.error(
                                    '❌ Face detection error:',
                                    faceError
                                );
                            }

                        },
                        100
                    );
                }
            );

        } catch (err) {

            console.error(
                '❌ Unable to access the camera:',
                err
            );

            const status =
                document.getElementById(
                    'vto-status'
                );

            if (status) {

                status.textContent =
                    `Camera error: ${
                        err.name || ''
                    } ${
                        err.message || err
                    }`;
            }
        }
    }

    // =========================================================
    // DETAILS PREVIEW MODAL
    // =========================================================

    function openPreviewModal(
        frame,
        isConverted,
        modelUrl,
        imgUrl
    ) {

        if (!previewModal) return;

        document.getElementById(
            'previewModalImg'
        ).src = imgUrl;

        document.getElementById(
            'previewModalTitle'
        ).textContent =
            frame.name ||
            'Eyeglass Frame';

        document.getElementById(
            'previewModalPrice'
        ).textContent =
            `₱${Number(
                frame.price || 0
            ).toFixed(2)}`;

        document.getElementById(
            'previewModalDesc'
        ).textContent =
            frame.description ||
            `${frame.brand || 'Gonzales Vision'} ${
                frame.category || 'Eyewear'
            }. High-quality frame designed for comfort and durability.`;

        const tryOnBtn =
            document.getElementById(
                'previewTryOnBtn'
            );

        if (isConverted && modelUrl) {

            tryOnBtn.disabled = false;

            tryOnBtn.style.background =
                '#2563eb';

            tryOnBtn.style.cursor =
                'pointer';

            tryOnBtn.textContent =
                'Try On 3D';

            tryOnBtn.onclick = () => {

                closePreviewModal();

                loadGLTFModel(
                    modelUrl
                );
            };

        } else {

            tryOnBtn.disabled = true;

            tryOnBtn.style.background =
                '#cbd5e1';

            tryOnBtn.style.cursor =
                'not-allowed';

            tryOnBtn.textContent =
                frame.conversion_status ===
                'Processing'
                    ? 'Converting...'
                    : '2D Only';
        }

        previewModal.style.display =
            'flex';
    }

    function closePreviewModal() {

        if (previewModal) {
            previewModal.style.display =
                'none';
        }
    }

    // =========================================================
    // CARD RENDERING
    // =========================================================

    function renderFrameCards(
        framesToRender
    ) {

        const frameGrid =
            document.getElementById(
                'frame-grid'
            );

        if (!frameGrid) return;

        if (
            framesToRender.length === 0
        ) {

            frameGrid.innerHTML =
                '<p style="color:#64748b; padding:1.5rem 0; grid-column:1 / -1;">No frames found matching your criteria.</p>';

            return;
        }

        frameGrid.innerHTML = '';

        framesToRender.forEach(
            frame => {

                const isConverted =
                    frame.conversion_status ===
                        'Converted' &&
                    frame.model_3d_url;

                const cleanApiBase =
                    apiBase.replace(
                        /\/+$/,
                        ''
                    );

                const cleanModelUrl =
                    frame.model_3d_url
                        ? (
                            frame.model_3d_url
                                .startsWith(
                                    'http'
                                )
                                ? frame.model_3d_url
                                : `${cleanApiBase}/${frame.model_3d_url.replace(
                                    /^\/+/,
                                    ''
                                )}`
                        )
                        : null;

                const modelUrl =
                    isConverted
                        ? cleanModelUrl
                        : null;

                const rawImg =
                    frame.image_2d_url ||
                    frame.image_url;

                const cleanRawImg =
                    rawImg
                        ? (
                            rawImg.startsWith('/')
                                ? rawImg
                                : `/${rawImg}`
                        )
                        : '';

                const imgUrl =
                    rawImg
                        ? (
                            rawImg.startsWith(
                                'http'
                            )
                                ? rawImg
                                : `${cleanApiBase}${cleanRawImg}`
                        )
                        : 'https://via.placeholder.com/300x150?text=No+Image';

                const card =
                    document.createElement(
                        'div'
                    );

                card.className =
                    'frame-card';

                card.innerHTML = `
                    <div class="frame-img-box">
                        <img
                            src="${imgUrl}"
                            alt="${frame.name || 'Frame'}"
                            onerror="this.onerror=null; this.src='https://via.placeholder.com/300x150?text=Image+Unavailable';"
                        />
                    </div>

                    <h4>
                        ${frame.name || 'Unnamed Frame'}
                    </h4>

                    <p>
                        ${frame.brand || 'Gonzales Vision'}
                        ${
                            frame.category
                                ? '• ' + frame.category
                                : ''
                        }
                    </p>

                    <p class="price">
                        ₱${Number(
                            frame.price || 0
                        ).toFixed(2)}
                    </p>

                    <div class="card-actions">

                        <button
                            class="btn-secondary view-btn"
                        >
                            View Details
                        </button>

                        ${
                            isConverted

                                ? `
                                    <button
                                        class="try-on-btn try-btn"
                                        data-model="${modelUrl}"
                                    >
                                        Try On 3D
                                    </button>
                                `

                                : `
                                    <button
                                        class="try-on-btn"
                                        style="background:#cbd5e1; cursor:not-allowed;"
                                        disabled
                                    >
                                        ${
                                            frame.conversion_status ===
                                            'Processing'
                                                ? 'Converting...'
                                                : '2D Only'
                                        }
                                    </button>
                                `
                        }

                    </div>
                `;

                card
                    .querySelector(
                        '.view-btn'
                    )
                    .addEventListener(
                        'click',
                        () => {

                            openPreviewModal(
                                frame,
                                isConverted,
                                modelUrl,
                                imgUrl
                            );
                        }
                    );

                if (isConverted) {

                    card
                        .querySelector(
                            '.try-btn'
                        )
                        .addEventListener(
                            'click',
                            function () {

                                loadGLTFModel(
                                    this.dataset.model
                                );
                            }
                        );
                }

                frameGrid.appendChild(
                    card
                );
            }
        );
    }

    // =========================================================
    // FILTERS
    // =========================================================

    function applyFilters() {

        const query =
            searchQuery
                .toLowerCase()
                .trim();

        const category =
            selectedCategory
                .toLowerCase()
                .trim();

        console.log(
            '🔎 Applying filters:',
            {
                search: query,
                category: category,
                totalFrames:
                    allFrames.length
            }
        );

        const filtered =
            allFrames.filter(
                frame => {

                    const frameName =
                        String(
                            frame.name || ''
                        )
                            .toLowerCase()
                            .trim();

                    const frameBrand =
                        String(
                            frame.brand || ''
                        )
                            .toLowerCase()
                            .trim();

                    const frameCategory =
                        String(
                            frame.category || ''
                        )
                            .toLowerCase()
                            .trim();

                    const matchesSearch =
                        query === '' ||
                        frameName.includes(
                            query
                        ) ||
                        frameBrand.includes(
                            query
                        );

                    const matchesCategory =
                        category === 'all' ||
                        frameCategory.includes(
                            category
                        );

                    console.log(
                        '🕶️ Frame:',
                        {
                            name: frame.name,
                            category:
                                frame.category,
                            matchesSearch,
                            matchesCategory
                        }
                    );

                    return (
                        matchesSearch &&
                        matchesCategory
                    );
                }
            );

        console.log(
            `✅ Showing ${filtered.length} of ${allFrames.length} frames`
        );

        renderFrameCards(
            filtered
        );
    }

    // =========================================================
    // LOAD FRAMES
    // =========================================================

    async function loadFramesFromAPI() {

        const frameGrid =
            document.getElementById(
                'frame-grid'
            );

        if (!frameGrid) return;

        try {

            const resp =
                await fetch(
                    `${apiBase}/api/frames`
                );

            if (!resp.ok) {
                throw new Error(
                    `HTTP Error ${resp.status}`
                );
            }

            allFrames =
                await resp.json();

            applyFilters();

        } catch (err) {

            console.error(
                'Failed to load frames from API:',
                err
            );

            if (frameGrid) {

                frameGrid.innerHTML =
                    '<p style="color:#ef4444; padding:1.5rem 0;">Failed to load frames.</p>';
            }
        }
    }

    // =========================================================
    // MOBILE TRY-ON BRIDGE
    // =========================================================

    window.openTryOnModal =
        async function (frameId) {

            const status =
                document.getElementById(
                    'vto-status'
                );

            function setStatus(
                message
            ) {

                console.log(
                    message
                );

                if (status) {
                    status.textContent =
                        message;
                }
            }

            try {

                setStatus(
                    `📱 Mobile Try-On: Frame ${frameId}`
                );

                const numericFrameId =
                    Number(frameId);

                if (!numericFrameId) {

                    setStatus(
                        `❌ Invalid frame ID: ${frameId}`
                    );

                    return;
                }

                // Make sure frames are loaded
                if (
                    !Array.isArray(
                        allFrames
                    ) ||
                    allFrames.length === 0
                ) {

                    setStatus(
                        '⏳ Loading frame data...'
                    );

                    await loadFramesFromAPI();
                }

                if (
                    !Array.isArray(
                        allFrames
                    )
                ) {

                    setStatus(
                        '❌ Frame API did not return a list.'
                    );

                    console.error(
                        'allFrames:',
                        allFrames
                    );

                    return;
                }

                const frame =
                    allFrames.find(
                        item =>
                            Number(
                                item.frame_id
                            ) ===
                            numericFrameId
                    );

                if (!frame) {

                    setStatus(
                        `❌ Frame ${numericFrameId} not found.`
                    );

                    console.error(
                        'Available frames:',
                        allFrames
                    );

                    return;
                }

                setStatus(
                    `✅ Frame found: ${frame.name}`
                );

                const modelUrl =
                    frame.model_3d_url;

                if (!modelUrl) {

                    setStatus(
                        '❌ This frame has no 3D model.'
                    );

                    return;
                }

                if (
                    frame.conversion_status !==
                    'Converted'
                ) {

                    setStatus(
                        `❌ Model is not converted: ${frame.conversion_status}`
                    );

                    return;
                }

                const cleanModelUrl =
                    modelUrl.startsWith(
                        'http'
                    )
                        ? modelUrl
                        : `${apiBase}/${modelUrl.replace(
                            /^\/+/,
                            ''
                        )}`;

                console.log(
                    '🕶️ Mobile selected frame:',
                    frame
                );

                console.log(
                    '🥽 Loading model:',
                    cleanModelUrl
                );

                setStatus(
                    '🥽 Loading 3D model...'
                );

                loadGLTFModel(
                    cleanModelUrl
                );

            } catch (error) {

                console.error(
                    '❌ Mobile Try-On failed:',
                    error
                );

                setStatus(
                    `❌ Try-On error: ${
                        error.message ||
                        error
                    }`
                );
            }
        };

    // =========================================================
    // SEARCH
    // =========================================================

    const searchInput =
        document.getElementById(
            'searchInput'
        );

    if (searchInput) {

        searchInput.addEventListener(
            'input',
            e => {

                searchQuery =
                    e.target.value;

                applyFilters();
            }
        );
    }

    // =========================================================
    // CATEGORY PILLS
    // =========================================================

    const categoryPills =
        document.getElementById(
            'categoryPills'
        );

    if (categoryPills) {

        categoryPills.addEventListener(
            'click',
            e => {

                const btn =
                    e.target.closest(
                        '.pill-btn'
                    );

                if (!btn) return;

                categoryPills
                    .querySelectorAll(
                        '.pill-btn'
                    )
                    .forEach(
                        b =>
                            b.classList.remove(
                                'active'
                            )
                    );

                btn.classList.add(
                    'active'
                );

                selectedCategory =
                    btn.dataset.category ||
                    'All';

                applyFilters();
            }
        );
    }

    // =========================================================
    // LOAD DATABASE FRAMES
    // =========================================================

    loadFramesFromAPI();

    // =========================================================
    // FACE DETECTION INITIALIZATION
    // =========================================================

    async function initFaceDetection() {

        const status =
            document.getElementById(
                'vto-status'
            );

        if (status) {
            status.textContent =
                'Loading face detection models…';
        }

        try {

            await Promise.all([
                faceapi.nets
                    .ssdMobilenetv1
                    .loadFromUri(
                        './models'
                    ),

                faceapi.nets
                    .faceLandmark68Net
                    .loadFromUri(
                        './models'
                    ),

                faceapi.nets
                    .faceRecognitionNet
                    .loadFromUri(
                        './models'
                    ),

                faceapi.nets
                    .ageGenderNet
                    .loadFromUri(
                        './models'
                    )
            ]);

            if (status) {

                status.textContent =
                    'Ready — click a frame to try it on!';
            }

        } catch (err) {

            console.error(
                'Failed to load face-api models:',
                err
            );

            if (status) {

                status.textContent =
                    'Failed to load face detection models.';
            }
        }
    }

    await initFaceDetection();

    // =========================================================
    // MOBILE WEBVIEW TRY-ON
    // =========================================================

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const targetFrameId =
        urlParams.get(
            'frameId'
        );

    const mobileTryOn =
        urlParams.get(
            'mobileTryOn'
        ) === 'true';

    if (
        mobileTryOn &&
        targetFrameId
    ) {

        console.log(
            '📱 MOBILE TRY-ON MODE:',
            targetFrameId
        );

        document.body.classList.add(
            'mobile-try-on-mode'
        );

        console.log(
            '📱 Calling openTryOnModal:',
            targetFrameId
        );

        window.openTryOnModal(
            targetFrameId
        );
    }

    // =========================================================
    // CLEANUP & MODAL CLOSING
    // =========================================================

    function closeVirtualTryOn() {

        if (vtoModal) {
            vtoModal.style.display =
                'none';
        }

        // Stop camera
        if (currentStream) {

            currentStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            currentStream = null;
        }

        // Remove model
        if (model) {

            scene.remove(
                model
            );

            model = null;
        }

        // Remove camera video plane
        const videoMesh =
            scene.children.find(
                child =>
                    child.geometry?.type ===
                    'PlaneGeometry'
            );

        if (videoMesh) {

            scene.remove(
                videoMesh
            );

            if (videoMesh.material) {

                if (
                    videoMesh.material.map
                ) {

                    videoMesh.material.map
                        .dispose();
                }

                videoMesh.material
                    .dispose();
            }

            if (
                videoMesh.geometry
            ) {

                videoMesh.geometry
                    .dispose();
            }
        }
    }

    const closeVTOBtn =
        document.getElementById(
            'closeVTOBtn'
        ) ||
        document.querySelector(
            '#faceFilterModal .close'
        );

    if (closeVTOBtn) {

        closeVTOBtn.onclick =
            closeVirtualTryOn;
    }

    const closePreviewBtn =
        document.getElementById(
            'closePreviewBtn'
        );

    if (closePreviewBtn) {

        closePreviewBtn.onclick =
            closePreviewModal;
    }

    window.onclick =
        function (event) {

            if (
                event.target ===
                vtoModal
            ) {

                closeVirtualTryOn();
            }

            if (
                event.target ===
                previewModal
            ) {

                closePreviewModal();
            }
        };
});