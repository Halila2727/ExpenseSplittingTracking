const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true, 
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.tonMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.5;
document.querySelector(".model").appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 3);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1);
mainLight.position.set(5, 10, 7.5);
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 3);
fillLight.position.set(-5, 0, -5);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2);
hemiLight.position.set(0, 25, 0);
scene.add(hemiLight);

function basicAnimate() {
    renderer.render(scene, camera);
    requestAnimationFrame(basicAnimate);
}
basicAnimate();

let model;
const loader = new THREE.GLTFLoader();
loader.load("./images/Untitled.glb", function (gltf) {
    model = gltf.scene;
    model.traverse((node) => {
        if (node.isMesh) {
            if (node.material) {
                node.material.metalness = 0.3;
                node.material.roughness = 0.4;
                node.material.envMapIntensity = 1.5;
            }
            node.castShadow = true;
            node.receiveShadow = true;
        }
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    scene.add(model);
        
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.z = maxDim * 1.5;

    model.scale.set(0, 0, 0);
    playInitialAnimation();

    cancelAnimationFrame(basicAnimate);
    animate();
});

const floatAmplitude = 0.2;
const floatSpeed = 1.5;
const rotationSpeed = 0.3;
let isFloating = true;
let currentScroll = 0;

const stickyHeight = window.innerHeight;
const scannerSection = document.querySelector(".scanner");
const scannerPosition = scannerSection.offsetTop;
const scanContainer = document.querySelector(".scan-container");
gsap.set(scanContainer, { scale: 0 });

function playInitialAnimation() {
    if (model) {
        gsap.to(model.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 1,
            ease: "power2.out",
        });
    }
    gsap.to(scanContainer, {
        scale: 1,
        duration: 1,
        ease: "power2.out",
    });
}

ScrollTrigger.create({
    trigger:"body",
    start: "top top",
    end: "top -10",
    onEnterBack: () => {
        if(model) {
            gsap.to(model.scale, {
                x: 1,
                y: 1,
                z: 1,
                duration: 1,
                ease: "power2.out",
            });
            isFloating = true;
        }
        gsap.to(scanContainer, {
            scale: 1,
            duration: 1,
            ease: "power2.out"
        });
    },
});

ScrollTrigger.create({
    trigger: ".scanner",
    start: "top top",
    end: '${stickyHeight}px',
    pin: true,
    onEnter: () => {
        if (model) {
            isFloating = false;
            model.position.y = 0;

            setTimeout(() => {
            }, 500);

            gsap.to(model.rotation, {
                y: model.rotation.y + Math.PI * 2,
                duration: 1,
                ease: "power2.inOut",
                onComplete: () => {
                    gsap.to(model.scale, {
                        x: 0,
                        y: 0,
                        z: 0,
                        duration: 0.5,
                        ease: "power2.in",
                        onComplete: () => {
                            gsap.to(scanContainer, {
                                scale: 0,
                                duration: 0.5,
                                ease: "power2.in",
                            });
                        },
                    });
                },
            });
        }
    },
    onLeaveBack: () => {
        gsap.set(scanContainer, { scale: 0 });
        gsap.to(scanContainer, {
            scale: 1,
            duration: 1,
            ease: "power2.out",
        });
    },
});

lenis.on("scroll", (e) => {
    currentScroll = e.scroll;
});

function animate() {
    if (model) {
        if (isFloating) {
            const floatOffset = Math.sin(Date.now() * 0.001 * floatSpeed) * floatAmplitude;
            model.position.y = floatOffset;
        }
        const scrollProgress = Math.min(currentScroll / scannerPosition, 1);

        if(scrollProgress < 1) {
            model.rotation.x = scrollProgress * Math.PI * 2;
        }

        if(scrollProgress < 1) {
            model.rotation.y += 0.00 * rotationSpeed;
        }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}