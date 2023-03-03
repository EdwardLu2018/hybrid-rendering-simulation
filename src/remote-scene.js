import { GUI } from 'dat.gui';

const FPS_PERIOD_60Hz = (1 / 60 * 1000);

AFRAME.registerSystem('remote-scene', {
    schema: {
        fps: {type: 'number', default: 60},
        latency: {type: 'number', default: 150}, // ms
    },

    init: function () {
        const el = this.el;
        const data = this.data;

        const sceneEl = this.sceneEl;
        if (!sceneEl.hasLoaded) {
            sceneEl.addEventListener('renderstart', this.init.bind(this));
            return;
        }

        const renderer = sceneEl.renderer;

        const scene = sceneEl.object3D;
        const camera = sceneEl.camera;

        // This is the remote scene init //

        this.remoteScene = new THREE.Scene();
        this.remoteCamera = camera.clone();

        this.remoteScene.background = new THREE.Color(0xF06565);

        const boxMaterial = new THREE.MeshBasicMaterial({color: 0x7074FF});
        const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
        this.box1 = new THREE.Mesh(boxGeometry, boxMaterial);
        this.box2 = new THREE.Mesh(boxGeometry, boxMaterial);
        this.box1.position.x = 10; this.box2.position.x = -10;
        this.box1.position.y = this.box2.position.y = 1.6;
        this.box1.position.z = this.box2.position.z = -10;
        this.remoteScene.add(this.box1); // add to remote scene
        this.remoteScene.add(this.box2);

        const texture = new THREE.TextureLoader().load('./color.png');
        const geometry = new THREE.PlaneGeometry(1920, 1080, 1, 1);
        const material = new THREE.MeshBasicMaterial( { map: texture } );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = -6;
        mesh.position.y = 1.6;
        mesh.position.z = -50;
        // mesh.rotation.x = -Math.PI / 8;
        // mesh.rotation.z = -Math.PI / 8;
        this.remoteScene.add(mesh);

        // End of remote scene init //

        this.poses = [];

        const system = this;

        let prev = [];
		const cameraLPos = new THREE.Vector3();
		const cameraRPos = new THREE.Vector3();
		function setProjectionFromUnion( camera, cameraL, cameraR ) {
			cameraLPos.setFromMatrixPosition( cameraL.matrixWorld );
			cameraRPos.setFromMatrixPosition( cameraR.matrixWorld );

			const ipd = cameraLPos.distanceTo( cameraRPos );

			const projL = cameraL.projectionMatrix.elements;
			const projR = cameraR.projectionMatrix.elements;

			// VR systems will have identical far and near planes, and
			// most likely identical top and bottom frustum extents.
			// Use the left camera for these values.
			const near = projL[ 14 ] / ( projL[ 10 ] - 1 );
			const far = projL[ 14 ] / ( projL[ 10 ] + 1 );
			const topFov = ( projL[ 9 ] + 1 ) / projL[ 5 ];
			const bottomFov = ( projL[ 9 ] - 1 ) / projL[ 5 ];

			const leftFov = ( projL[ 8 ] - 1 ) / projL[ 0 ];
			const rightFov = ( projR[ 8 ] + 1 ) / projR[ 0 ];
			const left = near * leftFov;
			const right = near * rightFov;

			// Calculate the new camera's position offset from the
			// left camera. xOffset should be roughly half `ipd`.
			const zOffset = ipd / ( - leftFov + rightFov );
			const xOffset = zOffset * - leftFov;

			// TODO: Better way to apply this offset?
			cameraL.matrixWorld.decompose( camera.position, camera.quaternion, camera.scale );
			camera.translateX( xOffset );
			camera.translateZ( zOffset );
			camera.matrixWorld.compose( camera.position, camera.quaternion, camera.scale );
			camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

			// Find the union of the frustum values of the cameras and scale
			// the values so that the near plane's position does not change in world space,
			// although must now be relative to the new union camera.
			const near2 = near + zOffset;
			const far2 = far + zOffset;
			const left2 = left - xOffset;
			const right2 = right + ( ipd - xOffset );
			const top2 = topFov * far / far2 * near2;
			const bottom2 = bottomFov * far / far2 * near2;

			camera.projectionMatrix.makePerspective( left2, right2, top2, bottom2, near2, far2 );
		}

		function updateCamera( camera, parent ) {
			if ( parent === null ) {
				camera.matrixWorld.copy( camera.matrix );
			} else {
				camera.matrixWorld.multiplyMatrices( parent.matrixWorld, camera.matrix );
			}
			camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();
		}

		renderer.xr.updateCamera = function ( cameraVR, camera ) {
            const cameraL = cameraVR.cameras[0];
            const cameraR = cameraVR.cameras[1];

			cameraVR.near = cameraR.near = cameraL.near = camera.near;
			cameraVR.far = cameraR.far = cameraL.far = camera.far;

			const parent = camera.parent;
			const cameras = cameraVR.cameras;

			updateCamera( cameraVR, parent );

            const pose = [];
            let prevPose;
            if (system.poses.length > data.latency / FPS_PERIOD_60Hz) {
                prevPose = system.poses.shift();
            }

			for ( let i = 0; i < cameras.length; i ++ ) {
                if (camera === system.remoteCamera) {
                    if (prevPose && prevPose[i]) {
                        cameras[ i ].matrix.copy(prevPose[i]);
                    }

                    updateCamera( cameras[ i ], parent );
                }
                else {
                    updateCamera( cameras[ i ], parent );

                    const camPose = new THREE.Matrix4();
                    camPose.copy(cameras[ i ].matrix);
                    pose[i] = camPose;
                    system.poses.push(pose);
                }
			}

			cameraVR.matrixWorld.decompose( cameraVR.position, cameraVR.quaternion, cameraVR.scale );

            camera.matrix.copy( cameraVR.matrix );
            camera.matrix.decompose( camera.position, camera.quaternion, camera.scale );

            const children = camera.children;
            for ( let i = 0, l = children.length; i < l; i ++ ) {
                children[ i ].updateMatrixWorld( true );
            }

			// update projection matrix for proper view frustum culling
			if ( cameras.length === 2 ) {
				setProjectionFromUnion( cameraVR, cameraL, cameraR );
			} else {
				// assume single camera setup (AR)
				cameraVR.projectionMatrix.copy( cameraL.projectionMatrix );
			}
		};

        this.onResize();
        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('enter-vr', this.clearPoses.bind(this));
        window.addEventListener('exit-vr', this.clearPoses.bind(this));
    },

    onResize() {
        const el = this.el;
        const data = this.data;

        const sceneEl = this.sceneEl;
        const renderer = sceneEl.renderer;

        const camera = sceneEl.camera;

        this.remoteCamera.copy(camera);
    },

    clearPoses() {
        this.poses = [];
    },

    updateFPS() {
        const data = this.data;

        this.tick = AFRAME.utils.throttleTick(this.tick, 1 / data.fps * 1000, this);
    },

    tick: function () {
        const el = this.el;
        const data = this.data;

        const sceneEl = this.sceneEl;
        const renderer = sceneEl.renderer;

        const scene = sceneEl.object3D;
        const camera = sceneEl.camera;

        if (!(renderer.xr.enabled === true && renderer.xr.isPresenting === true)) {
            var camPose = new THREE.Matrix4();
            camPose.copy(camera.matrixWorld);
            this.poses.push(camPose);

            if (this.poses.length > data.latency / FPS_PERIOD_60Hz) {
                const pose = this.poses.shift();
                // update remote camera
                pose.decompose( this.remoteCamera.position, this.remoteCamera.quaternion, this.remoteCamera.scale );

                // var vectorTopLeft = new THREE.Vector3( -1, 1, 1 ).unproject( this.remoteCamera );
                // var vectorTopRight = new THREE.Vector3( 1, 1, 1 ).unproject( this.remoteCamera );
                // var vectorBotLeft = new THREE.Vector3( -1, -1, 1 ).unproject( this.remoteCamera );
                // var vectorBotRight = new THREE.Vector3( 1, -1, 1 ).unproject( this.remoteCamera );

                // var material = new THREE.LineBasicMaterial({ color: 0xAAFFAA });
                // var points = [];
                // points.push(vectorTopLeft);
                // points.push(vectorTopRight);
                // points.push(vectorBotRight);
                // points.push(vectorBotLeft);
                // points.push(vectorTopLeft);
                // var geometry = new THREE.BufferGeometry().setFromPoints( points );
                // var line = new THREE.Line( geometry, material );
                // this.remoteScene.add( line );
            }
        }

        this.box1.rotation.x += 0.01;
        this.box1.rotation.y += 0.01;
        this.box1.rotation.z += 0.01;
    }
});
