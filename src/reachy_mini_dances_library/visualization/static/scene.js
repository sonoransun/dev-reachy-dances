/* Three.js 3D robot scene for Reachy Mini dance visualization.
 *
 * Coordinate mapping:
 *   Library: x = forward, y = left, z = up
 *   Three.js: x = right, y = up, z = toward camera
 *
 * So: lib.x -> three.z, lib.y -> three.-x, lib.z -> three.y
 */

const RobotScene = (() => {
    let scene, camera, renderer, controls;
    let headGroup, antennaLeftPivot, antennaRightPivot;
    let container;

    function init() {
        container = document.getElementById('scene-container');

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a1a);

        camera = new THREE.PerspectiveCamera(50, 1, 0.01, 10);
        camera.position.set(0.25, 0.3, 0.35);
        camera.lookAt(0, 0.15, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.15, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(1, 2, 1.5);
        scene.add(dirLight);

        // Grid floor
        const grid = new THREE.GridHelper(0.5, 20, 0x0f3460, 0x0a0a2a);
        scene.add(grid);

        // Base/neck cylinder (fixed)
        const baseMat = new THREE.MeshPhongMaterial({ color: 0x333355 });
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.035, 0.12, 16),
            baseMat
        );
        base.position.y = 0.06;
        scene.add(base);

        // Neck
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.02, 0.06, 12),
            baseMat
        );
        neck.position.y = 0.15;
        scene.add(neck);

        // Head group (receives all transforms)
        headGroup = new THREE.Group();
        headGroup.position.y = 0.2;
        scene.add(headGroup);

        // Head body (rounded box approximated by sphere + box)
        const headMat = new THREE.MeshPhongMaterial({ color: 0xe94560 });
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.045, 24, 18),
            headMat
        );
        head.scale.set(1, 0.8, 0.9);
        headGroup.add(head);

        // Face indicator (disc on front)
        const faceMat = new THREE.MeshPhongMaterial({ color: 0x16213e });
        const face = new THREE.Mesh(
            new THREE.CircleGeometry(0.025, 16),
            faceMat
        );
        face.position.z = 0.04;
        headGroup.add(face);

        // Eyes
        const eyeMat = new THREE.MeshPhongMaterial({ color: 0x00ff88 });
        const leftEye = new THREE.Mesh(
            new THREE.CircleGeometry(0.006, 8),
            eyeMat
        );
        leftEye.position.set(-0.01, 0.005, 0.041);
        headGroup.add(leftEye);
        const rightEye = new THREE.Mesh(
            new THREE.CircleGeometry(0.006, 8),
            eyeMat
        );
        rightEye.position.set(0.01, 0.005, 0.041);
        headGroup.add(rightEye);

        // Antennas — pivot at base, extend upward
        const antennaMat = new THREE.MeshPhongMaterial({ color: 0xffcc00 });

        antennaLeftPivot = new THREE.Group();
        antennaLeftPivot.position.set(-0.02, 0.035, 0);
        headGroup.add(antennaLeftPivot);
        const antennaLeft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.003, 0.05, 8),
            antennaMat
        );
        antennaLeft.position.y = 0.025;
        antennaLeftPivot.add(antennaLeft);

        antennaRightPivot = new THREE.Group();
        antennaRightPivot.position.set(0.02, 0.035, 0);
        headGroup.add(antennaRightPivot);
        const antennaRight = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.003, 0.05, 8),
            antennaMat
        );
        antennaRight.position.y = 0.025;
        antennaRightPivot.add(antennaRight);

        onResize();
        window.addEventListener('resize', onResize);
    }

    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    /**
     * Update the head pose from move channel values.
     * @param {object} values - { x, y, z, roll, pitch, yaw, antenna_left, antenna_right }
     *   in library coordinates (x=forward, y=left, z=up).
     */
    function updatePose(values) {
        if (!headGroup) return;

        // Position mapping: lib(x,y,z) -> three(z, y, -x)
        // Actually: lib.x=forward -> three.z, lib.y=left -> three.-x, lib.z=up -> three.y
        headGroup.position.x = -(values.y || 0);
        headGroup.position.y = 0.2 + (values.z || 0);
        headGroup.position.z = values.x || 0;

        // Orientation: apply in order roll, pitch, yaw
        // lib roll (around x/forward) -> three roll around z
        // lib pitch (around y/left) -> three pitch around -x
        // lib yaw (around z/up) -> three yaw around y
        headGroup.rotation.set(0, 0, 0);
        headGroup.rotation.order = 'YXZ';
        headGroup.rotation.y = values.yaw || 0;
        headGroup.rotation.x = -(values.pitch || 0);
        headGroup.rotation.z = values.roll || 0;

        // Antennas rotate around their local z-axis (tilt forward/back)
        if (antennaLeftPivot) antennaLeftPivot.rotation.z = values.antenna_left || 0;
        if (antennaRightPivot) antennaRightPivot.rotation.z = -(values.antenna_right || 0);
    }

    function render() {
        if (!renderer) return;
        controls.update();
        renderer.render(scene, camera);
    }

    return { init, updatePose, render, onResize };
})();
