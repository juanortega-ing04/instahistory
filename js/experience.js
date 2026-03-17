import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/loaders/OBJLoader.js";

// =========================
// Seguridad básica de sesión
// =========================
const session = localStorage.getItem("ih_session");
if (!session) {
  window.location.href = "index.html";
}

// =========================
// Referencias DOM
// =========================
const canvas = document.getElementById("threeCanvas");
const logoutBtn = document.getElementById("logout");
const goQRBtn = document.getElementById("goQR");
const resetBtn = document.getElementById("reset");
const holoInput = document.getElementById("holo");

if (!canvas) {
  throw new Error("No se encontró el canvas con id 'threeCanvas'.");
}

// Para que el gesto táctil no interfiera
canvas.style.touchAction = "none";
canvas.style.display = "block";
canvas.style.width = "100%";
canvas.style.height = "100%";

// =========================
// Navegación
// =========================
logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("ih_session");
  window.location.href = "index.html";
});

goQRBtn?.addEventListener("click", () => {
  window.location.href = "qr.html";
});

// =========================
// Three.js: renderer / escena / cámara
// =========================
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(0, 0.2, 3.6);
camera.lookAt(0, 0, 0);

// =========================
// Luces
// =========================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xaad4ff, 0x0b1020, 1.0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

// =========================
// Grupo del modelo
// =========================
const modelGroup = new THREE.Group();
scene.add(modelGroup);

// =========================
// Resize
// =========================
function resize() {
  const parent = canvas.parentElement;
  const w = parent?.clientWidth || 800;
  const h = parent?.clientHeight || 500;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

// =========================
// Estado general
// =========================
let modelLoaded = false;
let modelRoot = null;
const hologramMaterials = [];

let isDragging = false;
let lastX = 0;
let lastY = 0;

let targetRotY = 0;
let targetRotX = 0;
let currentRotY = 0;
let currentRotX = 0;

let targetDistance = 3.6;
let currentDistance = 3.6;

// =========================
// Utilidades holograma
// =========================
function applyHologramIntensity(value) {
  const t = THREE.MathUtils.clamp(value / 100, 0, 1);

  hologramMaterials.forEach((mat) => {
    mat.opacity = 0.35 + t * 0.57;
    mat.emissiveIntensity = 0.08 + t * 0.95;
    mat.needsUpdate = true;
  });
}

// =========================
// Carga del OBJ
// =========================
const loader = new OBJLoader();
const OBJ_URL = "./assets/modelo.obj";

console.log("Iniciando carga OBJ:", OBJ_URL);

loader.load(
  OBJ_URL,
  (obj) => {
    console.log("OBJ cargado correctamente:", obj);

    // Limpiar si hubiera un modelo previo
    while (modelGroup.children.length > 0) {
      modelGroup.remove(modelGroup.children[0]);
    }
    hologramMaterials.length = 0;

    obj.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0x6aa9ff,
          emissive: 0x1a66ff,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.92,
          roughness: 0.22,
          metalness: 0.08,
        });

        child.material = material;
        hologramMaterials.push(material);
      }
    });

    // Centrar el objeto
    const box = new THREE.Box3().setFromObject(obj);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    box.getCenter(center);
    box.getSize(size);

    obj.position.sub(center);

    // Escalar automáticamente para que entre en cámara
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.1 / maxDim;
    obj.scale.setScalar(scale);

    // Recalcular caja tras escalar para ajustar un poco la altura
    const scaledBox = new THREE.Box3().setFromObject(obj);
    const scaledCenter = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);

    obj.position.sub(scaledCenter);
    obj.position.y -= 0.1;

    modelGroup.add(obj);
    modelRoot = obj;
    modelLoaded = true;

    // Aplicar valor inicial del slider
    const initialValue = Number(holoInput?.value ?? 60);
    applyHologramIntensity(initialValue);

    console.log("Modelo agregado a la escena.");
  },
  undefined,
  (error) => {
    console.error("Error cargando el OBJ:", error);
    alert("No se pudo cargar el modelo OBJ. Revisa la consola del navegador.");
  }
);

// =========================
// Controles UI
// =========================
holoInput?.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  applyHologramIntensity(value);
});

resetBtn?.addEventListener("click", () => {
  targetRotX = 0;
  targetRotY = 0;
  targetDistance = 3.6;
});

// =========================
// Controles pointer
// =========================
canvas.addEventListener("pointerdown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;

  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;

  targetRotY += dx * 0.01;
  targetRotX += dy * 0.01;

  const limit = Math.PI / 3;
  targetRotX = THREE.MathUtils.clamp(targetRotX, -limit, limit);

  lastX = e.clientX;
  lastY = e.clientY;
});

function stopDrag() {
  isDragging = false;
}

canvas.addEventListener("pointerup", stopDrag);
canvas.addEventListener("pointerleave", stopDrag);
canvas.addEventListener("pointercancel", stopDrag);

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();

    targetDistance += e.deltaY * 0.003;
    targetDistance = THREE.MathUtils.clamp(targetDistance, 1.8, 8);
  },
  { passive: false }
);

// =========================
// Render loop
// =========================
function animate() {
  requestAnimationFrame(animate);

  currentRotY += (targetRotY - currentRotY) * 0.08;
  currentRotX += (targetRotX - currentRotX) * 0.08;
  currentDistance += (targetDistance - currentDistance) * 0.08;

  modelGroup.rotation.y = currentRotY;
  modelGroup.rotation.x = currentRotX;

  camera.position.z = currentDistance;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();