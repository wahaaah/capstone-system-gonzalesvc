document.addEventListener('DOMContentLoaded', async () => {

    // =====================================================
    // STATE VARIABLES
    // =====================================================

    const apiBase =
        document.body.dataset.api ||
        'https://gonzalesvisionclinic.onrender.com';

    let allFrames = [];
    let searchQuery = '';
    let selectedCategory = 'All';

    // =====================================================
    // URL / MOBILE TRY-ON
    // =====================================================

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const targetFrameId =
        urlParams.get('frameId');

    const mobileTryOn =
        urlParams.get('mobileTryOn') === 'true';

    // =====================================================
    // THREE.JS & VTO SETUP
    // =====================================================

    const scene =
        new THREE.Scene();

    const camera =
        new THREE.PerspectiveCamera(
            75,
            1,
            0.1,
            100
        );

    const renderer =
        new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

    const modalContainer =
        document.getElementById(
            'modal-container'
        );

    const vtoModal =
        document.getElementById(
            'faceFilterModal'
        );

    const previewModal =
        document.getElementById(
            'previewModal'
        );

    let model = null;

    let rendererAttached =
        false;

    let animationStarted =
        false;

    let currentStream =
        null;

    let currentVideo =
        null;

    let currentVideoTexture =
        null;

    let currentVideoPlane =
        null;

    let detectionTimer =
        null;

    let faceDetectionStarted =
        false;

    let detectionRunning =
        false;

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

        // Limit pixel ratio for mobile performance.
        // This does NOT change the frame calibration.
        renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                1.5
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

        rendererAttached =
            true;
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
                1.5
            )
        );
    }

    window.addEventListener(
        'resize',
        onWindowResize
    );

    // =====================================================
    // ANIMATION
    // =====================================================

    function animate() {

        // Prevent multiple animation loops.
        if (animationStarted) {
            return;
        }

        animationStarted =
            true;

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
    // FLUTTER LOG HELPER
    // =====================================================

    function flutterLog(
        message
    ) {

        console.log(
            message
        );

        if (
            window.FlutterLog
        ) {

            try {

                FlutterLog.postMessage(
                    String(message)
                );

            } catch (error) {

                console.warn(
                    'FlutterLog error:',
                    error
                );
            }
        }
    }

    // =====================================================
    // STATUS
    // =====================================================

    function setStatus(
        message
    ) {

        const status =
            document.getElementById(
                'vto-status'
            );

        if (status) {

            status.textContent =
                message;
        }
    }

    // =====================================================
    // LOAD 3D MODEL
    // =====================================================

    function loadGLTFModel(
        filePath
    ) {

        console.log(
            '🥽 STARTING GLTF LOAD:',
            filePath
        );

        flutterLog(
            '🥽 STARTING GLTF LOAD: ' +
            filePath
        );

        if (vtoModal) {

            vtoModal.style.display =
                'flex';
        }

        attachRenderer();

        // =================================================
        // STOP PREVIOUS CAMERA
        // =================================================

        stopCamera();

        // =================================================
        // REMOVE PREVIOUS VIDEO PLANE
        // =================================================

        removeVideoPlane();

        // =================================================
        // REMOVE PREVIOUS MODEL
        // =================================================

        removeCurrentModel();

        // =================================================
        // LOAD MODEL
        // =================================================

        loader.load(

            filePath,

            function (gltf) {

                // -----------------------------------------
                // MODEL SUCCESSFULLY LOADED
                // -----------------------------------------

                console.log(
                    '🕶️ FRAME MODEL LOADED'
                );

                flutterLog(
                    '🕶️ FRAME MODEL LOADED'
                );

                // -----------------------------------------
                // SET MODEL
                // -----------------------------------------

                model =
                    gltf.scene;

                    // =================================================
// MEASURE ORIGINAL 3D FRAME MODEL
// =================================================

model.updateMatrixWorld(true);

const box = new THREE.Box3().setFromObject(model);

const modelSize = new THREE.Vector3();

box.getSize(modelSize);

const modelCenter = new THREE.Vector3();

box.getCenter(modelCenter);

console.log('📏 ===== FRAME MODEL MEASUREMENTS =====');
console.log('📏 Width:', modelSize.x);
console.log('📏 Height:', modelSize.y);
console.log('📏 Depth:', modelSize.z);

console.log(
    '📍 Model Center:',
    modelCenter.x,
    modelCenter.y,
    modelCenter.z
);

flutterLog(
    `📏 FRAME MODEL SIZE: ` +
    `W=${modelSize.x.toFixed(4)}, ` +
    `H=${modelSize.y.toFixed(4)}, ` +
    `D=${modelSize.z.toFixed(4)}`
);

                // IMPORTANT:
                // Keep original base scale.
                model.scale.set(
                    0.1,
                    0.1,
                    0.1
                );

                // IMPORTANT:
                // Keep original model orientation.
                model.rotation.y =
                    Math.PI;

                // Initial off-screen position.
                model.position.set(
                    -5,
                    0,
                    -5
                );

                scene.add(
                    model
                );

                console.log(
                    '🕶️ MODEL ADDED TO THREE.JS SCENE'
                );

                flutterLog(
                    '🕶️ MODEL ADDED TO THREE.JS SCENE'
                );

                console.log(
                    '🕶️ INITIAL MODEL POSITION:',
                    model.position.x,
                    model.position.y,
                    model.position.z
                );

                console.log(
                    '🕶️ INITIAL MODEL SCALE:',
                    model.scale.x,
                    model.scale.y,
                    model.scale.z
                );

                flutterLog(
                    `🕶️ INITIAL MODEL POSITION: ` +
                    `${model.position.x}, ` +
                    `${model.position.y}, ` +
                    `${model.position.z}`
                );

                flutterLog(
                    `🕶️ INITIAL MODEL SCALE: ` +
                    `${model.scale.x}, ` +
                    `${model.scale.y}, ` +
                    `${model.scale.z}`
                );

                // -----------------------------------------
                // START THREE.JS
                // -----------------------------------------

                animate();

                // -----------------------------------------
                // START CAMERA + FACE TRACKING
                // -----------------------------------------

                run();
            },

            undefined,

            function (err) {

                console.error(
                    '❌ Error loading GLTF model:',
                    err
                );

                flutterLog(
                    '❌ GLTF LOAD ERROR: ' +
                    (
                        err.message ||
                        err
                    )
                );

                setStatus(
                    '❌ Failed to load 3D model.'
                );
            }
        );
    }

    // =====================================================
    // SCREEN TO WORLD
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
            (screenPoint.x / width) *
            2 -
            1;

        const y =
            -(screenPoint.y / height) *
            2 +
            1;

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
    // STOP CAMERA
    // =====================================================

    function stopCamera() {

        // Stop face detection timer.
        if (detectionTimer) {

            clearTimeout(
                detectionTimer
            );

            detectionTimer =
                null;
        }

        faceDetectionStarted =
            false;

        detectionRunning =
            false;

        // Stop camera tracks.
        if (currentStream) {

            currentStream
                .getTracks()
                .forEach(
                    track => {

                        try {

                            track.stop();

                        } catch (error) {

                            console.warn(
                                'Camera track stop error:',
                                error
                            );
                        }
                    }
                );

            currentStream =
                null;
        }

        // Remove current video.
        if (currentVideo) {

            try {

                currentVideo.pause();

                currentVideo.srcObject =
                    null;

                currentVideo.remove();

            } catch (error) {

                console.warn(
                    'Video cleanup error:',
                    error
                );
            }

            currentVideo =
                null;
        }
    }

    // =====================================================
    // REMOVE VIDEO PLANE
    // =====================================================

    function removeVideoPlane() {

        if (currentVideoPlane) {

            scene.remove(
                currentVideoPlane
            );

            if (
                currentVideoPlane.geometry
            ) {

                currentVideoPlane
                    .geometry
                    .dispose();
            }

            if (
                currentVideoPlane.material
            ) {

                currentVideoPlane
                    .material
                    .dispose();
            }

            currentVideoPlane =
                null;
        }

        if (
            currentVideoTexture
        ) {

            try {

                currentVideoTexture
                    .dispose();

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

        // Dispose geometries/materials
        // to reduce GPU memory usage.
        model.traverse(
            object => {

                if (
                    object.geometry
                ) {

                    object.geometry
                        .dispose();
                }

                if (
                    object.material
                ) {

                    if (
                        Array.isArray(
                            object.material
                        )
                    ) {

                        object.material
                            .forEach(
                                material => {

                                    if (
                                        material.map
                                    ) {

                                        material
                                            .map
                                            .dispose();
                                    }

                                    material
                                        .dispose();
                                }
                            );

                    } else {

                        if (
                            object.material.map
                        ) {

                            object.material
                                .map
                                .dispose();
                        }

                        object.material
                            .dispose();
                    }
                }
            }
        );

        model =
            null;
    }

    // =====================================================
    // CAMERA + VIDEO + FACE TRACKING
    // =====================================================

    async function run() {

        try {

            console.log(
                '📷 Starting camera...'
            );

            flutterLog(
                '📷 STARTING CAMERA'
            );

            // =================================================
            // GET CAMERA STREAM
            // =================================================

            const stream =
                await navigator
                    .mediaDevices
                    .getUserMedia({

                        video:
                            mobileTryOn
                                ? {
                                    facingMode:
                                        'user'
                                }
                                : true,

                        audio: false
                    });

            currentStream =
                stream;

            console.log(
                '📷 Camera stream obtained'
            );

            flutterLog(
                '📷 CAMERA STREAM OBTAINED'
            );

            // =================================================
            // CREATE VIDEO
            // =================================================

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

            // Keep video hidden.
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

            // =================================================
            // PLAY VIDEO
            // =================================================

            try {

                await video.play();

                console.log(
                    '✅ Camera video playing:',
                    video.videoWidth,
                    'x',
                    video.videoHeight
                );

                flutterLog(
                    `✅ CAMERA VIDEO PLAYING: ` +
                    `${video.videoWidth}x${video.videoHeight}`
                );

            } catch (playError) {

                console.error(
                    '❌ Video play failed:',
                    playError
                );

                flutterLog(
                    '❌ VIDEO PLAY FAILED: ' +
                    (
                        playError.message ||
                        playError
                    )
                );
            }

            // =================================================
            // WAIT FOR VIDEO FRAMES
            // =================================================

            let attempts =
                0;

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

            console.log(
                '🎥 VIDEO READY:',
                video.videoWidth,
                'x',
                video.videoHeight
            );

            // =================================================
            // THREE.JS VIDEO TEXTURE
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
            // CAMERA BACKGROUND PLANE
            // =================================================

            const geometry =
                new THREE.PlaneGeometry(
                    20,
                    20
                );

            const material =
                new THREE.MeshBasicMaterial({
                    map:
                        videoTexture,

                    side:
                        THREE.DoubleSide
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

            console.log(
                '🎥 Camera plane added'
            );

            flutterLog(
                '🎥 CAMERA PLANE ADDED'
            );

            // =================================================
            // FACE DETECTION OPTIONS
            // =================================================

            // Create this ONCE.
            // Do not recreate it every detection.
            const detectorOptions =
                new faceapi
                    .SsdMobilenetv1Options({
                        minConfidence:
                            0.3,

                        inputSize:
                            320
                    });

            // =================================================
            // FACE DETECTION
            // =================================================

            async function detectFace() {

                if (
                    !model ||
                    !video ||
                    video.readyState < 2
                ) {
                    return;
                }

                // Prevent overlapping
                // face-api requests.
                if (
                    detectionRunning
                ) {
                    return;
                }

                detectionRunning =
                    true;

                try {

                    // =================================================
                    // ONLY DETECT ONE FACE
                    // =================================================

                    const detection =
                        await faceapi
                            .detectSingleFace(
                                video,
                                detectorOptions
                            )
                            .withFaceLandmarks();

                    // =================================================
                    // NO FACE
                    // =================================================

                    if (!detection) {

                        const status =
                            document.getElementById(
                                'vto-status'
                            );

                        if (status) {

                            status.textContent =
                                '🔴 No face detected';
                        }

                        return;
                    }

                    // =================================================
                    // FACE DETECTED
                    // =================================================

                    const leftEye =
                        detection
                            .landmarks
                            .getLeftEye();

                    const rightEye =
                        detection
                            .landmarks
                            .getRightEye();

                    if (
                        !leftEye ||
                        !rightEye ||
                        leftEye.length === 0 ||
                        rightEye.length === 0
                    ) {

                        return;
                    }

                    // =================================================
                    // EYE CENTER
                    //
                    // IMPORTANT:
                    // Same calculation as your working code.
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

                    // =================================================
                    // VIDEO SIZE
                    // =================================================

                    const displaySize = {

                        width:
                            video.videoWidth,

                        height:
                            video.videoHeight
                    };

                    // =================================================
                    // CONVERT FACE POSITION
                    // =================================================

                    const worldCenterPoint =
                        screenToWorldCoordinates(
                            {
                                x:
                                    centerX,

                                y:
                                    centerY
                            },
                            displaySize
                        );

                    // =================================================
                    // POSITION OFFSET
                    //
                    // KEEP ORIGINAL VALUE.
                    // =================================================

                    const eyeToEyebrowOffset =
                        1;

                    const targetX =
                        worldCenterPoint.x;

                    const targetY =
                        worldCenterPoint.y -
                        eyeToEyebrowOffset;

                    const targetZ =
                        worldCenterPoint.z;

                    // =================================================
                    // MOVE FRAME
                    // =================================================

                    if (
                        !isNaN(targetX) &&
                        !isNaN(targetY) &&
                        !isNaN(targetZ)
                    ) {

                        model.position.set(
                            targetX,
                            targetY,
                            targetZ
                        );
                    }

                    // =================================================
                    // ROTATION
                    //
                    // KEEP ORIGINAL CALCULATION.
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
                    //
                    // IMPORTANT:
                    // DO NOT CHANGE THIS FORMULA.
                    //
                    // This preserves your current
                    // frame size calibration.
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

                    console.log(
    '👁️ Eye distance:',
    distanceBetweenEyes.toFixed(2),
    'px'
);

                    // =================================================
                    // STATUS
                    // =================================================

                    const status =
                        document.getElementById(
                            'vto-status'
                        );

                    if (status) {

                        const score =
                            detection
                                .detection
                                .score;

                        status.textContent =
                            `🟢 Face detected (${Math.round(score * 100)}%)`;
                    }

                } catch (faceError) {

                    console.error(
                        '❌ FACE DETECTION ERROR:',
                        faceError
                    );

                    // Only send actual errors
                    // to Flutter.
                    //
                    // Do NOT send position,
                    // scale, eye coordinates,
                    // etc. every detection.

                    flutterLog(
                        '❌ FACE DETECTION ERROR: ' +
                        (
                            faceError.message ||
                            faceError
                        )
                    );

                    const status =
                        document.getElementById(
                            'vto-status'
                        );

                    if (status) {

                        status.textContent =
                            '❌ Face detection error';
                    }

                } finally {

                    detectionRunning =
                        false;
                }
            }

            // =================================================
            // DETECTION LOOP
            // =================================================

            async function detectionLoop() {

                if (
                    !faceDetectionStarted
                ) {
                    return;
                }

                await detectFace();

                if (
                    !faceDetectionStarted
                ) {
                    return;
                }

                // 200ms = approximately
                // 5 face detections per second.
                //
                // Three.js still renders continuously.
                // Only face detection is reduced.
                detectionTimer =
                    setTimeout(
                        detectionLoop,
                        200
                    );
            }

            // =================================================
            // START FACE DETECTION
            // =================================================

            async function startFaceDetection() {

                if (
                    faceDetectionStarted
                ) {
                    return;
                }

                faceDetectionStarted =
                    true;

                console.log(
                    '🙂 FACE DETECTION STARTED'
                );

                flutterLog(
                    '🙂 FACE DETECTION STARTED'
                );

                const status =
                    document.getElementById(
                        'vto-status'
                    );

                if (status) {

                    status.textContent =
                        '🔍 Looking for your face...';
                }

                detectionLoop();
            }

            // =================================================
            // VIDEO PLAYING
            // =================================================

            video.addEventListener(
                'playing',
                () => {

                    console.log(
                        '🎥 VIDEO PLAYING'
                    );

                    startFaceDetection();
                },
                {
                    once: true
                }
            );

            // =================================================
            // VIDEO CANPLAY
            // =================================================

            video.addEventListener(
                'canplay',
                () => {

                    console.log(
                        '🎥 VIDEO CANPLAY'
                    );

                    if (
                        video.videoWidth > 0 &&
                        video.videoHeight > 0
                    ) {

                        startFaceDetection();
                    }
                },
                {
                    once: true
                }
            );

            // =================================================
            // VIDEO ALREADY READY
            // =================================================

            if (
                video.readyState >= 2 &&
                video.videoWidth > 0 &&
                video.videoHeight > 0
            ) {

                console.log(
                    '📱 VIDEO ALREADY READY'
                );

                startFaceDetection();
            }

        } catch (err) {

            console.error(
                '❌ Unable to access camera:',
                err
            );

            flutterLog(
                '❌ CAMERA ERROR: ' +
                (
                    err.message ||
                    err
                )
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

    // =====================================================
    // DETAILS PREVIEW MODAL
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

        if (
            tryOnBtn
        ) {

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
    // CLOSE PREVIEW MODAL
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

        frameGrid.innerHTML =
            '';

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
                            rawImg.startsWith(
                                '/'
                            )
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

                // =================================================
                // VIEW DETAILS
                // =================================================

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

                // =================================================
                // TRY ON
                // =================================================

                if (
                    isConverted
                ) {

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
                'Failed to load frames from API:',
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

                if (
                    !numericFrameId
                ) {

                    setStatus(
                        `❌ Invalid frame ID: ${frameId}`
                    );

                    return;
                }

                // -----------------------------------------
                // MAKE SURE FRAMES ARE LOADED
                // -----------------------------------------

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

                    return;
                }

                // -----------------------------------------
                // FIND FRAME
                // -----------------------------------------

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

                // -----------------------------------------
                // CHECK MODEL
                // -----------------------------------------

                const modelUrl =
                    frame.model_3d_url;

                if (!modelUrl) {

                    setStatus(
                        '❌ This frame has no 3D model.'
                    );

                    return;
                }

                // -----------------------------------------
                // CHECK CONVERSION
                // -----------------------------------------

                if (
                    frame.conversion_status !==
                    'Converted'
                ) {

                    setStatus(
                        `❌ Model is not converted: ${frame.conversion_status}`
                    );

                    return;
                }

                // -----------------------------------------
                // CLEAN MODEL URL
                // -----------------------------------------

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

                console.log(
                    '🕶️ Mobile selected frame:',
                    frame
                );

                console.log(
                    '🥽 Loading model:',
                    cleanModelUrl
                );

                flutterLog(
                    '🥽 LOADING MOBILE MODEL: ' +
                    cleanModelUrl
                );

                setStatus(
                    '🥽 Loading 3D model...'
                );

                // -----------------------------------------
                // LOAD MODEL
                // -----------------------------------------

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
    // FACE DETECTION INITIALIZATION
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

            // IMPORTANT:
            // Only load models actually needed
            // for Try-On.
            //
            // Removed:
            // - faceRecognitionNet
            // - ageGenderNet

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

            console.log(
                '✅ Face detection models loaded'
            );

            flutterLog(
                '✅ FACE DETECTION MODELS LOADED'
            );

            if (status) {

                status.textContent =
                    'Ready — click a frame to try it on!';
            }

        } catch (err) {

            console.error(
                'Failed to load face-api models:',
                err
            );

            flutterLog(
                '❌ FACE MODEL LOAD ERROR: ' +
                (
                    err.message ||
                    err
                )
            );

            if (status) {

                status.textContent =
                    'Failed to load face detection models.';
            }
        }
    }

    // =====================================================
    // INITIALIZE FACE DETECTION
    // =====================================================

    await initFaceDetection();

    // =====================================================
    // MOBILE WEBVIEW TRY-ON
    // =====================================================

    if (
        mobileTryOn &&
        targetFrameId
    ) {

        console.log(
            '📱 MOBILE TRY-ON MODE:',
            targetFrameId
        );

        flutterLog(
            '📱 MOBILE TRY-ON MODE: ' +
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

    // =====================================================
    // CLEANUP & MODAL CLOSING
    // =====================================================

    function closeVirtualTryOn() {

        // -----------------------------------------
        // HIDE MODAL
        // -----------------------------------------

        if (vtoModal) {

            vtoModal.style.display =
                'none';
        }

        // -----------------------------------------
        // STOP CAMERA + DETECTION
        // -----------------------------------------

        stopCamera();

        // -----------------------------------------
        // REMOVE VIDEO PLANE
        // -----------------------------------------

        removeVideoPlane();

        // -----------------------------------------
        // REMOVE MODEL
        // -----------------------------------------

        removeCurrentModel();

        // -----------------------------------------
        // EXTRA VIDEO CLEANUP
        // -----------------------------------------

        document
            .querySelectorAll(
                'video'
            )
            .forEach(
                video => {

                    try {

                        if (
                            video.srcObject
                        ) {

                            video.srcObject
                                .getTracks()
                                .forEach(
                                    track =>
                                        track.stop()
                                );

                            video.srcObject =
                                null;
                        }

                        video.remove();

                    } catch (error) {

                        console.warn(
                            'Video cleanup error:',
                            error
                        );
                    }
                }
            );
    }

    // =====================================================
    // CLOSE VTO BUTTON
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
    // CLOSE PREVIEW BUTTON
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