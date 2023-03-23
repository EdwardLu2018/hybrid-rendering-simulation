import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';

import {LOW_POLY_LOCAL} from './constants';

AFRAME.registerComponent('remote-scene', {
    schema: {
        fps: {type: 'number', default: 60},
        latency: {type: 'number', default: 150}, // ms
    },

    init: async function () {
        const el = this.el;
        const data = this.data;

        const sceneEl = el;
        if (!sceneEl.hasLoaded) {
            sceneEl.addEventListener('renderstart', this.init.bind(this));
            return;
        }

        this.experimentManager = sceneEl.systems['experiment-manager'];
        this.remoteLocal = sceneEl.systems['remote-local'];

        this.remoteScene = sceneEl.systems['remote-local'].remoteScene;
        this.remoteCamera = sceneEl.systems['remote-local'].remoteCamera;

        // This is the remote scene init //
        const scene = this.remoteScene;
        const camera = this.remoteCamera;

        const _this = this;

        scene.background = new THREE.Color(0x87CEEB);

        const textureLoader = new THREE.TextureLoader();
        const gltfLoader = new GLTFLoader();

        const sphereGeometry = new THREE.SphereGeometry( 0.5, 32, 16 );
        const sphereMaterial = new THREE.MeshBasicMaterial( { color: 0xDDDDFF } );

        const NUM_LIGHTS = 3;
        let j = 0;
        for (var i = -Math.floor(NUM_LIGHTS / 2); i < Math.ceil(NUM_LIGHTS / 2); i++) {
            let xPos = i;
            if (NUM_LIGHTS % 2 == 0) xPos += 0.5;

            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.set( 25 * xPos, 25, -5 );
            _this.addToScene( `light${j++}`, sphere );
            sphere.userData.originalMedium = 'remote';

            const light = new THREE.SpotLight( 0xDDDDFF, 2 );
            light.castShadow = true;
            light.shadow.bias = -0.0001;
            light.shadow.mapSize.width = 1024 * 4;
            light.shadow.mapSize.height = 1024 * 4;
            light.shadow.camera.near = 10;
            light.shadow.camera.far = 1000;
            light.shadow.camera.fov = 30;
            sphere.add( light );
        }

        const boxMaterial = new THREE.MeshBasicMaterial( { color: 0x7074FF } );
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.box = new THREE.Mesh(boxGeometry, boxMaterial);
        this.box.position.set(2, 1.6, -5);
        this.box.castShadow = true;
        this.box.receiveShadow = true;
        _this.addToScene( 'blueBox', this.box ); // add to remote scene
        this.box.userData.originalMedium = 'remote';

        // new EXRLoader()
        //     .setPath( 'assets/textures/' )
        //     .load( 'starmap_2020_4k_gal.exr', function ( texture ) {
        //         texture.mapping = THREE.EquirectangularReflectionMapping;
        //         scene.background = texture;
        //         scene.environment = texture;
        //         _this.experimentManager.objects['background'] = texture;
        //         texture.userData.originalMedium = 'remote';
        //     } );

        new RGBELoader()
            .setPath( 'assets/textures/' )
            .load( 'farm_field_puresky_1k.hdr', function ( texture ) {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.background = texture;
                scene.environment = texture;
                _this.experimentManager.objects['background'] = texture;
                texture.userData.originalMedium = 'remote';
            } );

        textureLoader
            .setPath( 'assets/textures/' )
            .load( 'height_map.png' , function ( texture ) {
                texture.wrapS = texture.wrapT = THREE.Repeatwrapping;
                texture.repeat.set(1, 1);

                textureLoader.load('park_dirt_diff_1k.png', function ( groundTexture ) {
                    groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
                    groundTexture.anisotropy = 16;
                    groundTexture.encoding = THREE.sRGBEncoding;
                    groundTexture.repeat.set(32, 32);

                    const groundMaterial = new THREE.MeshStandardMaterial({
                        map: groundTexture,
                        // wireframe: true,
                        displacementMap: texture,
                        displacementScale: 5,
                    });

                    const groundGeometry = new THREE.PlaneGeometry(120, 120, 5, 5);
                    groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
                    groundMesh.receiveShadow = true;
                    groundMesh.rotation.x = -Math.PI / 2;
                    groundMesh.position.y = -4;
                    _this.addToScene( 'groundMesh', groundMesh );
                    groundMesh.userData.originalMedium = 'remote';
                } );
            } );

        gltfLoader
            .setPath( 'assets/models/DamagedHelmet/glTF/' )
            .load( 'DamagedHelmet.gltf', function ( gltf ) {
                const model = gltf.scene;
                model.scale.set(1, 1, 1);
                model.position.set(-2, 1.6, -5);
                model.traverse( function( node ) {
                    if ( node.isMesh ) { node.castShadow = true; node.receiveShadow = true; }
                } );
                _this.addToScene( 'helmet', model );
                model.userData.originalMedium = 'remote';
            } );

        gltfLoader
            .setPath( 'assets/models/' )
            .load( 'sword.glb', function ( gltf ) {
                const model = gltf.scene;
                model.scale.set(0.03, 0.03, 0.03);
                model.position.set(2, 1.6, -5);
                model.traverse( function( node ) {
                    if ( node.isMesh ) { node.castShadow = true; node.receiveShadow = true; }
                } );
                _this.addToScene( 'swordRight', model );
                model.userData.originalMedium = 'remote';
            } );

        function modelLoader(path) {
            gltfLoader.setPath( 'assets/models/' );
            return new Promise((resolve, reject) => {
                gltfLoader.load(path, data => resolve(data), null, reject);
            });
        }

        const lowResModel = await modelLoader( 'golden_knight_1kTX_low_poly.glb' );
        const highResModel = await modelLoader( 'golden_knight_1kTX_high_poly.glb' );
        const models = [lowResModel.scene, highResModel.scene];

        const NUM_MODELS = 8;
        for (var i = 0; i < NUM_MODELS; i++) {
            for (var m = 0; m < 2; m++) {
                const modelClone = models[m].clone();
                modelClone.scale.set(8, 8, 8);
                modelClone.position.x = 20 * Math.cos((Math.PI / (NUM_MODELS - 1)) * i);
                modelClone.position.y = -1.5;
                modelClone.position.z = -20 * Math.sin((Math.PI / (NUM_MODELS - 1)) * i);
                modelClone.rotation.y = (Math.PI / (NUM_MODELS - 1)) * i - Math.PI / 2;
                modelClone.traverse( function( node ) {
                    if ( node.isMesh ) { node.castShadow = true; node.receiveShadow = true; }
                } );
                if (m == 0) {
                    _this.addToScene( `modelLow${i}`, modelClone );
                    modelClone.userData.originalMedium = 'local';
                    modelClone.visible = false;
                }
                else {
                    _this.addToScene( `modelHigh${i}`, modelClone );
                    modelClone.userData.originalMedium = 'remote';
                    modelClone.visible = true;
                }
            }
        }

        this.experimentManager.changeExperiment(LOW_POLY_LOCAL);
    },

    addToScene(objectId, object) {
        const scene = this.remoteScene;
        const camera = this.remoteCamera;

        scene.add(object);
        object.userData.renderingMedium = 'remote';
        this.experimentManager.objects[objectId] = object;
    },

    update(oldData) {
        const data = this.data;

        if (data.fps != oldData.fps) {
            this.tick = AFRAME.utils.throttleTick(this.tick, 1 / data.fps * 1000, this);
            this.remoteLocal.updateFPS(data.fps);
        }

        if (data.latency != oldData.latency) {
            this.remoteLocal.setLatency(data.latency);
        }
    },

    tick: function () {
        const el = this.el;
        const data = this.data;

        const sceneEl = this.sceneEl;

        const scene = this.remoteScene;
        const camera = this.remoteCamera;

        if (this.experimentManager.objects['helmet']) {
            this.experimentManager.objects['helmet'].rotation.y -= 0.01;
        }
    }
});
