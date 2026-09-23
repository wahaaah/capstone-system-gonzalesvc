document.addEventListener('DOMContentLoaded', async () => {

    // =====================================================
    // STATE
    // =====================================================

    const apiBase =
        document.body.dataset.api ||
        'https://gonzalesvisionclinic.onrender.com';

    let allFrames = [];
    let searchQuery = '';
    let selectedCategory = 'All';

    // =====================================================
    // URL / MOBILE TRY-ON MODE
    // =====================================================

    const urlParams = new URLSearchParams(
        window.location.search
    );

    const targetFrameId =
        urlParams.get('frameId');

    const mobileTryOn =
        urlParams.get('mobileTryOn') === 'true';

    // =====================================================
    // THREE.JS SETUP
    // =====================================================

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        75,
        1,
        0.1,
        100
    );

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    const modalContainer =
        document.getElementById('modal-container');

    const vtoModal =
        document.getElementById('faceFilterModal');

    const previewModal =
        document.getElementById('previewModal');

    let model = null;
    let rendererAttached = false;

    // =====================================================
    // CAMERA / VIDEO STATE
    // =====================================================

    let currentStream = null;
    let currentVideo = null;
    let currentVideoTexture = null;
    let currentVideoPlane = null;

    let detectionInterval = null;
    let detectionRunning = false;
    let faceDetectionStarted = false;

    // Face detection options
    const faceDetectionOptions =
        new faceapi.SsdMobilenetv1Options({
            minConfidence: 0.3
        });

    // =====================================================
    // FRAME SMOOTHING
    // =====================================================

    let smoothedX = null;
    let smoothedY = null;
    let smoothedZ = null;

    let smoothedRotation = null;
    let smoothedScale = null;

    // Higher = more responsive
    // Lower = smoother
    const POSITION_SMOOTHING = 0.35;
    const ROTATION_SMOOTHING = 0.30;
    const SCALE_SMOOTHING = 0.30;

    // =====================================================
    // CAMERA POSITION
    // =====================================================

    camera.position.set(
        0,
        0,
        10
    );

    camera.lookAt(
        0,
        0,
        0
    );

    // =====================================================
    // LIGHTING
    // =====================================================

    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            0.6
        );

    scene.add(
        ambientLight
    );

    const directionalLight =
        new THREE.DirectionalLight(
            0xffffff,
            1
        );

    directionalLight.position
        .set(1, 1, 1)
        .normalize();

    scene.add(
        directionalLight
    );

    // =====================================================
    // GLTF LOADER
    // =====================================================

    const loader =
        new THREE.GLTFLoader();

    // =====================================================
    // HELPERS
    // =====================================================

    function flutterLog(message) {

        console.log(message);

        if (window.FlutterLog) {
            try {
                FlutterLog.postMessage(
                    String(message)
                );
            } catch (error) {
                console.warn(
                    'FlutterLog failed:',
                    error
                );
            }
        }
    }

    function setStatus(message) {

        const status =
            document.getElementById(
                'vto-status'
            );

        if (status) {
            status.textContent =
                message;
        }

        flutterLog(message);
    }

    // =====================================================
    // RENDERER
    // =====================================================

    function attachRenderer() {

        if (
            rendererAttached ||
            !modalContainer
        ) {
            return;
        }

        const width =
            modalContainer.clientWidth ||
            640;

        const height =
            modalContainer.clientHeight ||
            480;

        renderer.setSize(
            width,
            height
        );

        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                2
            )
        );

        renderer.domElement.style.position =
            'absolute';

        renderer.domElement.style.inset =
            '0';

        renderer.domElement.style.width =
            '100%';

        renderer.domElement.style.height =
            '100%';

        modalContainer.style.position =
            'relative';

        modalContainer.appendChild(
            renderer.domElement
        );

        camera.aspect =
            width / height;

        camera.updateProjectionMatrix();

        rendererAttached = true;
    }

    // =====================================================
    // RESIZE
    // =====================================================

    function onWindowResize() {

        if (
            !rendererAttached ||
            !modalContainer
        ) {
            return;
        }

        const width =
            modalContainer.clientWidth;

        const height =
            modalContainer.clientHeight;

        if (
            !width ||
            !height
        ) {
            return;
        }

        camera.aspect =
            width / height;

        camera.updateProjectionMatrix();

        renderer.setSize(
            width,
            height
        );

        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                2
            )
        );
    }

    window.addEventListener(
        'resize',
        onWindowResize
    );

    // =====================================================
    // THREE.JS ANIMATION
    // =====================================================

    let animationStarted = false;

    function animate() {

        if (animationStarted) {
            return;
        }

        animationStarted = true;

        function renderLoop() {

            requestAnimationFrame(
                renderLoop
            );

            renderer.render(
                scene,
                camera
            );
        }

        renderLoop();
    }

    // =====================================================
    // SCREEN → THREE.JS WORLD
    // =====================================================

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

        vector.unproject(
            camera
        );

        const direction =
            vector
                .sub(camera.position)
                .normalize();

        const distance =
            -camera.position.z /
            direction.z;

        return camera.position
            .clone()
            .add(
                direction.multiplyScalar(
                    distance
                )
            );
    }

    // =====================================================
    // SMOOTH VALUE
    // =====================================================

    function smoothValue(
        current,
        target,
        amount
    ) {

        if (
            current === null ||
            current === undefined
        ) {
            return target;
        }

        return (
            current +
            (target - current) *
            amount
        );
    }

    // =====================================================
    // SMOOTH ANGLE
    // =====================================================

    function smoothAngle(
        current,
        target,
        amount
    ) {

        if (
            current === null ||
            current === undefined
        ) {
            return target;
        }

        let difference =
            target - current;

        while (
            difference > Math.PI
        ) {
            difference -=
                Math.PI * 2;
        }

        while (
            difference < -Math.PI
        ) {
            difference +=
                Math.PI * 2;
        }

        return (
            current +
            difference * amount
        );
    }

    // =====================================================
    // RESET TRACKING
    // =====================================================

    function resetTracking() {

        smoothedX = null;
        smoothedY = null;
        smoothedZ = null;

        smoothedRotation = null;
        smoothedScale = null;
    }

    // =====================================================
    // STOP CAMERA
    // =====================================================

    function stopCamera() {

        if (detectionInterval) {

            clearInterval(
                detectionInterval
            );

            detectionInterval =
                null;
        }

        detectionRunning =
            false;

        faceDetectionStarted =
            false;

        if (currentStream) {

            currentStream
                .getTracks()
                .forEach(track => {

                    try {
                        track.stop();
                    } catch (error) {
                        console.warn(
                            'Camera track stop error:',
                            error
                        );
                    }

                });

            currentStream =
                null;
        }

        if (currentVideo) {

            try {

                currentVideo.pause();

                currentVideo.srcObject =
                    null;

            } catch (error) {

                console.warn(
                    'Video cleanup error:',
                    error
                );
            }

            currentVideo =
                null;
        }

        resetTracking();
    }

    // =====================================================
    // REMOVE VIDEO PLANE
    // =====================================================

    function removeVideoPlane() {

        if (
            currentVideoPlane
        ) {

            scene.remove(
                currentVideoPlane
            );

            if (
                currentVideoPlane.geometry
            ) {

                currentVideoPlane.geometry
                    .dispose();
            }

            if (
                currentVideoPlane.material
            ) {

                currentVideoPlane.material
                    .dispose();
            }

            currentVideoPlane =
                null;
        }

        if (
            currentVideoTexture
        ) {

            try {
                currentVideoTexture.dispose();
            } catch (error) {
                console.warn(
                    'Video texture cleanup error:',
                    error
                );
            }

            currentVideoTexture =
                null;
        }
    }

    // =====================================================
    // REMOVE CURRENT MODEL
    // =====================================================

    function removeCurrentModel() {

        if (!model) {
            return;
        }

        scene.remove(
            model
        );

        model =
            null;

        resetTracking();
    }

    // =====================================================
    // CAMERA VIDEO
    // =====================================================

    async function startCamera() {

        stopCamera();

        removeVideoPlane();

        setStatus(
            '📷 Starting camera...'
        );

        try {

            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {

                throw new Error(
                    'Camera API is not available.'
                );
            }

            const constraints =
                mobileTryOn
                    ? {
                        audio: false,
                        video: {
                            facingMode: {
                                ideal: 'user'
                            },
                            width: {
                                ideal: 1280
                            },
                            height: {
                                ideal: 720
                            }
                        }
                    }
                    : {
                        audio: false,
                        video: true
                    };

            const stream =
                await navigator.mediaDevices
                    .getUserMedia(
                        constraints
                    );

            currentStream =
                stream;

            flutterLog(
                '📷 CAMERA STREAM OBTAINED'
            );

            const video =
                document.createElement(
                    'video'
                );

            currentVideo =
                video;

            video.srcObject =
                stream;

            video.autoplay =
                true;

            video.muted =
                true;

            video.playsInline =
                true;

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

            // Keep video hidden because
            // Three.js displays the camera.
            video.style.position =
                'fixed';

            video.style.width =
                '1px';

            video.style.height =
                '1px';

            video.style.opacity =
                '0';

            video.style.pointerEvents =
                'none';

            document.body.appendChild(
                video
            );

            try {

                await video.play();

            } catch (playError) {

                console.warn(
                    'video.play() warning:',
                    playError
                );

                flutterLog(
                    '⚠️ VIDEO PLAY WARNING: ' +
                    (
                        playError.message ||
                        playError
                    )
                );
            }

            let attempts = 0;

            while (
                (
                    video.readyState < 2 ||
                    video.videoWidth === 0 ||
                    video.videoHeight === 0
                ) &&
                attempts < 50
            ) {

                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            100
                        )
                );

                attempts++;
            }

            if (
                video.videoWidth === 0 ||
                video.videoHeight === 0
            ) {

                throw new Error(
                    'Camera video has no dimensions.'
                );
            }

            flutterLog(
                `🎥 VIDEO READY: ${video.videoWidth}x${video.videoHeight}`
            );

            // =================================================
            // THREE VIDEO TEXTURE
            // =================================================

            const videoTexture =
                new THREE.VideoTexture(
                    video
                );

            videoTexture.minFilter =
                THREE.LinearFilter;

            videoTexture.magFilter =
                THREE.LinearFilter;

            videoTexture.format =
                THREE.RGBAFormat;

            currentVideoTexture =
                videoTexture;

            // =================================================
            // CAMERA BACKGROUND
            // =================================================

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

            plane.position.set(
                0,
                0,
                -6
            );

            currentVideoPlane =
                plane;

            scene.add(
                plane
            );

            flutterLog(
                '🎥 CAMERA PLANE ADDED'
            );

            return video;

        } catch (error) {

            console.error(
                'Camera error:',
                error
            );

            flutterLog(
                '❌ CAMERA ERROR: ' +
                (
                    error.message ||
                    error
                )
            );

            setStatus(
                `❌ Camera error: ${
                    error.name || ''
                } ${
                    error.message || error
                }`
            );

            throw error;
        }
    }

    // =====================================================
    // FACE DETECTION
    // =====================================================

    async function startFaceDetection(
        video
    ) {

        if (
            faceDetectionStarted
        ) {
            return;
        }

        faceDetectionStarted =
            true;

        flutterLog(
            '🙂 STARTING FACE DETECTION'
        );

        // Wait for real video frames.
        let attempts = 0;

        while (
            (
                video.readyState < 2 ||
                video.videoWidth === 0 ||
                video.videoHeight === 0
            ) &&
            attempts < 50
        ) {

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );

            attempts++;
        }

        if (
            video.videoWidth === 0 ||
            video.videoHeight === 0
        ) {

            flutterLog(
                '❌ VIDEO HAS NO DIMENSIONS'
            );

            faceDetectionStarted =
                false;

            return;
        }

        const displaySize = {
            width:
                video.videoWidth,
            height:
                video.videoHeight
        };

        flutterLog(
            `🙂 FACE DETECTION VIDEO SIZE: ${displaySize.width}x${displaySize.height}`
        );

        const status =
            document.getElementById(
                'vto-status'
            );

        if (status) {

            status.textContent =
                '🔍 Looking for your face...';
        }

        // =================================================
        // DETECTION FUNCTION
        // =================================================

        async function detectFace() {

            if (
                !model ||
                !video
            ) {
                return;
            }

            if (
                video.readyState < 2
            ) {
                return;
            }

            if (
                detectionRunning
            ) {
                return;
            }

            detectionRunning =
                true;

            try {

                const detections =
                    await faceapi
                        .detectAllFaces(
                            video,
                            faceDetectionOptions
                        )
                        .withFaceLandmarks();

                // =================================================
                // NO FACE
                // =================================================

                if (
                    !detections ||
                    detections.length === 0
                ) {

                    if (status) {

                        status.textContent =
                            '🔴 No face detected';
                    }

                    return;
                }

                // =================================================
                // FACE FOUND
                // =================================================

                const detection =
                    detections[0];

                const score =
                    detection.detection.score;

                const leftEye =
                    detection.landmarks
                        .getLeftEye();

                const rightEye =
                    detection.landmarks
                        .getRightEye();

                if (
                    !leftEye ||
                    !rightEye ||
                    leftEye.length === 0 ||
                    rightEye.length === 0
                ) {

                    flutterLog(
                        '⚠️ EYE LANDMARKS NOT FOUND'
                    );

                    return;
                }

                if (status) {

                    status.textContent =
                        `🟢 Face detected (${Math.round(score * 100)}%)`;
                }

                // =================================================
                // EYE CENTERS
                // =================================================

                let leftEyeX = 0;
                let leftEyeY = 0;

                let rightEyeX = 0;
                let rightEyeY = 0;

                leftEye.forEach(
                    point => {

                        leftEyeX +=
                            point.x;

                        leftEyeY +=
                            point.y;
                    }
                );

                rightEye.forEach(
                    point => {

                        rightEyeX +=
                            point.x;

                        rightEyeY +=
                            point.y;
                    }
                );

                leftEyeX /=
                    leftEye.length;

                leftEyeY /=
                    leftEye.length;

                rightEyeX /=
                    rightEye.length;

                rightEyeY /=
                    rightEye.length;

                // =================================================
                // FACE CENTER
                // =================================================

                const centerX =
                    (
                        leftEyeX +
                        rightEyeX
                    ) / 2;

                const centerY =
                    (
                        leftEyeY +
                        rightEyeY
                    ) / 2;

                // =================================================
                // WORLD POSITION
                // =================================================

                const worldCenter =
                    screenToWorldCoordinates(
                        {
                            x: centerX,
                            y: centerY
                        },
                        displaySize
                    );

                // Move glasses slightly downward
                // relative to eye center.
                const eyeToFrameOffset =
                    1.0;

                const targetX =
                    worldCenter.x;

                const targetY =
                    worldCenter.y -
                    eyeToFrameOffset;

                const targetZ =
                    worldCenter.z;

                // =================================================
                // POSITION SMOOTHING
                // =================================================

                smoothedX =
                    smoothValue(
                        smoothedX,
                        targetX,
                        POSITION_SMOOTHING
                    );

                smoothedY =
                    smoothValue(
                        smoothedY,
                        targetY,
                        POSITION_SMOOTHING
                    );

                smoothedZ =
                    smoothValue(
                        smoothedZ,
                        targetZ,
                        POSITION_SMOOTHING
                    );

                model.position.set(
                    smoothedX,
                    smoothedY,
                    smoothedZ
                );

                // =================================================
                // ROTATION
                // =================================================

                const deltaY =
                    rightEyeY -
                    leftEyeY;

                const deltaX =
                    rightEyeX -
                    leftEyeX;

                const targetAngle =
                    Math.atan2(
                        deltaY,
                        deltaX
                    );

                smoothedRotation =
                    smoothAngle(
                        smoothedRotation,
                        targetAngle,
                        ROTATION_SMOOTHING
                    );

                model.rotation.z =
                    smoothedRotation;

                // =================================================
                // SCALE
                // =================================================

                const eyeDistance =
                    Math.sqrt(
                        Math.pow(
                            rightEyeX -
                            leftEyeX,
                            2
                        ) +
                        Math.pow(
                            rightEyeY -
                            leftEyeY,
                            2
                        )
                    );

                // Original scaling basis
                const targetScale =
                    eyeDistance /
                    200;

                if (
                    targetScale > 0 &&
                    !isNaN(targetScale)
                ) {

                    smoothedScale =
                        smoothValue(
                            smoothedScale,
                            targetScale,
                            SCALE_SMOOTHING
                        );

                    model.scale.set(
                        smoothedScale,
                        smoothedScale,
                        smoothedScale
                    );
                }

            } catch (error) {

                console.error(
                    'Face detection error:',
                    error
                );

                flutterLog(
                    '❌ FACE DETECTION ERROR: ' +
                    (
                        error.message ||
                        error
                    )
                );

            } finally {

                detectionRunning =
                    false;
            }
        }

        // =================================================
        // START LOOP
        // =================================================

        flutterLog(
            '🚀 FACE DETECTION LOOP STARTED'
        );

        await detectFace();

        if (
            detectionInterval
        ) {

            clearInterval(
                detectionInterval
            );
        }

        detectionInterval =
            setInterval(
                detectFace,
                150
            );
    }

    // =====================================================
    // LOAD GLTF MODEL
    // =====================================================

    function loadGLTFModel(
        filePath
    ) {

        if (!filePath) {

            setStatus(
                '❌ No 3D model URL provided.'
            );

            return;
        }

        flutterLog(
            '🥽 STARTING GLTF LOAD: ' +
            filePath
        );

        if (vtoModal) {

            vtoModal.style.display =
                'flex';
        }

        attachRenderer();

        // Stop previous Try-On
        stopCamera();

        removeVideoPlane();

        removeCurrentModel();

        loader.load(

            filePath,

            async function (gltf) {

                flutterLog(
                    '🕶️ FRAME MODEL LOADED'
                );

                model =
                    gltf.scene;

                // Initial scale.
                model.scale.set(
                    0.1,
                    0.1,
                    0.1
                );

                // Preserve your current
                // model orientation.
                model.rotation.y =
                    Math.PI;

                // Initial off-face position.
                model.position.set(
                    -5,
                    0,
                    -5
                );

                scene.add(
                    model
                );

                flutterLog(
                    '🕶️ MODEL ADDED TO THREE.JS SCENE'
                );

                flutterLog(
                    `🕶️ INITIAL MODEL POSITION: ${
                        model.position.x
                    }, ${
                        model.position.y
                    }, ${
                        model.position.z
                    }`
                );

                flutterLog(
                    `🕶️ INITIAL MODEL SCALE: ${
                        model.scale.x
                    }, ${
                        model.scale.y
                    }, ${
                        model.scale.z
                    }`
                );

                animate();

                setStatus(
                    '📷 Starting camera...'
                );

                try {

                    const video =
                        await startCamera();

                    // =================================================
                    // VIDEO EVENTS
                    // =================================================

                    video.addEventListener(
                        'playing',
                        () => {

                            flutterLog(
                                '🎥 VIDEO PLAYING'
                            );

                            startFaceDetection(
                                video
                            );
                        },
                        {
                            once: true
                        }
                    );

                    video.addEventListener(
                        'canplay',
                        () => {

                            flutterLog(
                                '🎥 VIDEO CANPLAY'
                            );

                            if (
                                video.videoWidth > 0 &&
                                video.videoHeight > 0
                            ) {

                                startFaceDetection(
                                    video
                                );
                            }
                        },
                        {
                            once: true
                        }
                    );

                    // Video may already be playing
                    if (
                        video.readyState >= 2 &&
                        video.videoWidth > 0 &&
                        video.videoHeight > 0
                    ) {

                        flutterLog(
                            '📱 VIDEO ALREADY READY'
                        );

                        startFaceDetection(
                            video
                        );
                    }

                } catch (cameraError) {

                    console.error(
                        'Camera startup failed:',
                        cameraError
                    );

                }

            },

            undefined,

            function (error) {

                console.error(
                    '❌ GLTF LOAD ERROR:',
                    error
                );

                flutterLog(
                    '❌ GLTF LOAD ERROR: ' +
                    (
                        error.message ||
                        error
                    )
                );

                setStatus(
                    '❌ Failed to load 3D model.'
                );
            }
        );
    }

    // =====================================================
    // PREVIEW MODAL
    // =====================================================

    function openPreviewModal(
        frame,
        isConverted,
        modelUrl,
        imgUrl
    ) {

        if (!previewModal) {
            return;
        }

        const image =
            document.getElementById(
                'previewModalImg'
            );

        const title =
            document.getElementById(
                'previewModalTitle'
            );

        const price =
            document.getElementById(
                'previewModalPrice'
            );

        const description =
            document.getElementById(
                'previewModalDesc'
            );

        const tryOnBtn =
            document.getElementById(
                'previewTryOnBtn'
            );

        if (image) {
            image.src =
                imgUrl;
        }

        if (title) {
            title.textContent =
                frame.name ||
                'Eyeglass Frame';
        }

        if (price) {
            price.textContent =
                `₱${Number(
                    frame.price || 0
                ).toFixed(2)}`;
        }

        if (description) {

            description.textContent =
                frame.description ||
                `${frame.brand || 'Gonzales Vision'} ${
                    frame.category || 'Eyewear'
                }. High-quality frame designed for comfort and durability.`;
        }

        if (tryOnBtn) {

            if (
                isConverted &&
                modelUrl
            ) {

                tryOnBtn.disabled =
                    false;

                tryOnBtn.style.background =
                    '#2563eb';

                tryOnBtn.style.cursor =
                    'pointer';

                tryOnBtn.textContent =
                    'Try On 3D';

                tryOnBtn.onclick =
                    () => {

                        closePreviewModal();

                        loadGLTFModel(
                            modelUrl
                        );
                    };

            } else {

                tryOnBtn.disabled =
                    true;

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
        }

        previewModal.style.display =
            'flex';
    }

    // =====================================================
    // CLOSE PREVIEW
    // =====================================================

    function closePreviewModal() {

        if (previewModal) {

            previewModal.style.display =
                'none';
        }
    }

    // =====================================================
    // CARD RENDERING
    // =====================================================

    function renderFrameCards(
        framesToRender
    ) {

        const frameGrid =
            document.getElementById(
                'frame-grid'
            );

        if (!frameGrid) {
            return;
        }

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
                                ? '• ' +
                                  frame.category
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

                // View Details
                const viewButton =
                    card.querySelector(
                        '.view-btn'
                    );

                if (viewButton) {

                    viewButton.addEventListener(
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
                }

                // Try On
                if (isConverted) {

                    const tryButton =
                        card.querySelector(
                            '.try-btn'
                        );

                    if (tryButton) {

                        tryButton.addEventListener(
                            'click',
                            function () {

                                loadGLTFModel(
                                    this.dataset.model
                                );
                            }
                        );
                    }
                }

                frameGrid.appendChild(
                    card
                );
            }
        );
    }

    // =====================================================
    // FILTERS
    // =====================================================

    function applyFilters() {

        const query =
            searchQuery
                .toLowerCase()
                .trim();

        const category =
            selectedCategory
                .toLowerCase()
                .trim();

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

                    return (
                        matchesSearch &&
                        matchesCategory
                    );
                }
            );

        renderFrameCards(
            filtered
        );
    }

    // =====================================================
    // LOAD FRAMES
    // =====================================================

    async function loadFramesFromAPI() {

        const frameGrid =
            document.getElementById(
                'frame-grid'
            );

        if (!frameGrid) {
            return;
        }

        try {

            const response =
                await fetch(
                    `${apiBase}/api/frames`
                );

            if (!response.ok) {

                throw new Error(
                    `HTTP Error ${response.status}`
                );
            }

            allFrames =
                await response.json();

            applyFilters();

        } catch (error) {

            console.error(
                'Failed to load frames:',
                error
            );

            frameGrid.innerHTML =
                '<p style="color:#ef4444; padding:1.5rem 0;">Failed to load frames.</p>';
        }
    }

    // =====================================================
    // MOBILE TRY-ON BRIDGE
    // =====================================================

    window.openTryOnModal =
        async function (
            frameId
        ) {

            try {

                setStatus(
                    `📱 Mobile Try-On: Frame ${frameId}`
                );

                const numericFrameId =
                    Number(
                        frameId
                    );

                if (!numericFrameId) {

                    setStatus(
                        `❌ Invalid frame ID: ${frameId}`
                    );

                    return;
                }

                if (
                    !Array.isArray(allFrames) ||
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

                const cleanApiBase =
                    apiBase.replace(
                        /\/+$/,
                        ''
                    );

                const cleanModelUrl =
                    modelUrl.startsWith(
                        'http'
                    )
                        ? modelUrl
                        : `${cleanApiBase}/${modelUrl.replace(
                            /^\/+/,
                            ''
                        )}`;

                flutterLog(
                    '🥽 LOADING MOBILE MODEL: ' +
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
                    'Mobile Try-On failed:',
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

    // =====================================================
    // SEARCH
    // =====================================================

    const searchInput =
        document.getElementById(
            'searchInput'
        );

    if (searchInput) {

        searchInput.addEventListener(
            'input',
            event => {

                searchQuery =
                    event.target.value;

                applyFilters();
            }
        );
    }

    // =====================================================
    // CATEGORY PILLS
    // =====================================================

    const categoryPills =
        document.getElementById(
            'categoryPills'
        );

    if (categoryPills) {

        categoryPills.addEventListener(
            'click',
            event => {

                const button =
                    event.target.closest(
                        '.pill-btn'
                    );

                if (!button) {
                    return;
                }

                categoryPills
                    .querySelectorAll(
                        '.pill-btn'
                    )
                    .forEach(
                        item =>
                            item.classList.remove(
                                'active'
                            )
                    );

                button.classList.add(
                    'active'
                );

                selectedCategory =
                    button.dataset.category ||
                    'All';

                applyFilters();
            }
        );
    }

    // =====================================================
    // LOAD DATABASE FRAMES
    // =====================================================

    loadFramesFromAPI();

    // =====================================================
    // FACE-API INITIALIZATION
    // =====================================================

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

            // Only models required for
            // face detection + landmarks.
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
                    )

            ]);

            flutterLog(
                '✅ FACE DETECTION MODELS LOADED'
            );

            if (status) {

                status.textContent =
                    'Ready — click a frame to try it on!';
            }

        } catch (error) {

            console.error(
                'Face model loading error:',
                error
            );

            flutterLog(
                '❌ FACE MODEL LOAD ERROR: ' +
                (
                    error.message ||
                    error
                )
            );

            if (status) {

                status.textContent =
                    '❌ Failed to load face detection models.';
            }
        }
    }

    // =====================================================
    // INITIALIZE FACE API
    // =====================================================

    await initFaceDetection();

    // =====================================================
    // MOBILE WEBVIEW STARTUP
    // =====================================================

    if (
        mobileTryOn &&
        targetFrameId
    ) {

        flutterLog(
            '📱 MOBILE TRY-ON MODE: ' +
            targetFrameId
        );

        document.body.classList.add(
            'mobile-try-on-mode'
        );

        window.openTryOnModal(
            targetFrameId
        );
    }

    // =====================================================
    // CLEANUP
    // =====================================================

    function closeVirtualTryOn() {

        // Stop detection/camera
        stopCamera();

        // Remove video plane
        removeVideoPlane();

        // Remove model
        removeCurrentModel();

        if (vtoModal) {

            vtoModal.style.display =
                'none';
        }

        // Remove hidden video element
        const hiddenVideos =
            document.querySelectorAll(
                'video'
            );

        hiddenVideos.forEach(
            video => {

                if (
                    !video.srcObject
                ) {
                    try {
                        video.remove();
                    } catch (error) {
                        // Ignore
                    }
                }
            }
        );
    }

    // =====================================================
    // CLOSE VTO
    // =====================================================

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

    // =====================================================
    // CLOSE PREVIEW
    // =====================================================

    const closePreviewBtn =
        document.getElementById(
            'closePreviewBtn'
        );

    if (closePreviewBtn) {

        closePreviewBtn.onclick =
            closePreviewModal;
    }

    // =====================================================
    // CLICK OUTSIDE MODALS
    // =====================================================

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