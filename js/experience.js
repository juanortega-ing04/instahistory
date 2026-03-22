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
const resetViewBtn = document.getElementById("resetView");
const clearModelBtn = document.getElementById("clearModel");
const opacityInput = document.getElementById("modelOpacity");
const statusText = document.getElementById("statusText");
const modelsList = document.getElementById("modelsList");

if (!canvas) {
  throw new Error("No se encontró el canvas #threeCanvas");
}

canvas.style.touchAction = "none";

// =========================
// Navegación
// =========================
logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("ih_session");
  window.location.href = "index.html";
});

goQRBtn?.addEventListener("click", () => {
  window.location.href = "/qr.html";
});

// =========================
// Three.js base
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
camera.position.set(0, 0.3, 4.5);
camera.lookAt(0, 0, 0);

// =========================
// Luces
// =========================
const ambientLight = new THREE.AmbientLight(0xffffff, 1.15);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xc8e1ff, 0x0b1020, 1.0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(4, 5, 4);
scene.add(dirLight);

const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight2.position.set(-3, 2, -4);
scene.add(dirLight2);

// =========================
// Grupo del modelo
// =========================
const modelGroup = new THREE.Group();
scene.add(modelGroup);

let currentModel = null;
const modelMaterials = [];

// =========================
// Resize
// =========================
function resize() {
  const parent = canvas.parentElement;
  const width = parent?.clientWidth || 900;
  const height = parent?.clientHeight || 600;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

// =========================
// Controles de vista
// =========================
let isDragging = false;
let lastX = 0;
let lastY = 0;

let targetRotY = 0;
let targetRotX = 0;
let currentRotY = 0;
let currentRotX = 0;

let targetDistance = 4.5;
let currentDistance = 4.5;

function resetView() {
  targetRotX = 0;
  targetRotY = 0;
  targetDistance = 4.5;
}

resetViewBtn?.addEventListener("click", resetView);

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

  const limit = Math.PI / 2.4;
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
    targetDistance += e.deltaY * 0.004;
    targetDistance = THREE.MathUtils.clamp(targetDistance, 1.6, 12);
  },
  { passive: false }
);

// =========================
// Utilidades
// =========================
function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
  }
}

function clearCurrentModel() {
  if (!currentModel) {
    setStatus("No hay modelo cargado.");
    return;
  }

  modelGroup.remove(currentModel);

  currentModel.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();

      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    }
  });

  currentModel = null;
  modelMaterials.length = 0;
  setStatus("Modelo eliminado.");
}

clearModelBtn?.addEventListener("click", clearCurrentModel);

function applyOpacity(value) {
  const opacity = THREE.MathUtils.clamp(value / 100, 0.2, 1);

  modelMaterials.forEach((mat) => {
    mat.opacity = opacity;
    mat.transparent = opacity < 1;
    mat.needsUpdate = true;
  });
}

opacityInput?.addEventListener("input", (e) => {
  const value = Number(e.target.value);
  applyOpacity(value);
});

function centerAndScaleObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.2 / maxDim;
  object.scale.setScalar(scale);

  const boxAfterScale = new THREE.Box3().setFromObject(object);
  const centerAfterScale = new THREE.Vector3();
  boxAfterScale.getCenter(centerAfterScale);

  object.position.sub(centerAfterScale);
  object.position.y -= 0.1;
}

function prepareObjectMaterials(object) {
  modelMaterials.length = 0;

  object.traverse((child) => {
    if (child.isMesh) {
      child.geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color: 0xcfd8e6,
        roughness: 0.5,
        metalness: 0.08,
        transparent: false,
        opacity: 1,
      });

      child.material = material;
      modelMaterials.push(material);
    }
  });
}

function loadOBJFromURL(url, fileName = "modelo.obj") {
  const loader = new OBJLoader();

  setStatus(`Cargando ${fileName}...`);

  loader.load(
    url,
    (obj) => {
      if (!obj || obj.children.length === 0) {
        setStatus("El archivo no contiene geometría válida.");
        return;
      }

      clearCurrentModel();

      prepareObjectMaterials(obj);
      centerAndScaleObject(obj);

      modelGroup.add(obj);
      currentModel = obj;

      const initialOpacity = Number(opacityInput?.value ?? 100);
      applyOpacity(initialOpacity);
      resetView();

      setStatus(`Modelo cargado: ${fileName}`);
    },
    undefined,
    (error) => {
      console.error(error);
      setStatus(`No se pudo cargar ${fileName}`);
      alert(`Error cargando el archivo: ${fileName}`);
    }
  );
}

// =========================
// Lectura automática carpeta
// =========================
async function getOBJFilesFromDirectory() {
  const response = await fetch("./assets/modelos/");
  if (!response.ok) {
    throw new Error("No se pudo leer la carpeta assets/modelos");
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const links = [...doc.querySelectorAll("a")];
  const objFiles = links
    .map((link) => link.getAttribute("href"))
    .filter((href) => href && href.toLowerCase().endsWith(".obj"))
    .map((href) => {
      const cleanHref = href.startsWith("/") ? href : `./assets/modelos/${href}`;
      const fileName = href.split("/").pop();
      return {
        name: fileName,
        url: cleanHref,
      };
    });

  return objFiles;
}

function renderModelsList(files) {
  if (!modelsList) return;

  modelsList.innerHTML = "";

  if (!files.length) {
    modelsList.innerHTML = `<p class="muted">No hay modelos .obj en assets/modelos</p>`;
    return;
  }

  files.forEach((file) => {
    const btn = document.createElement("button");
    btn.className = "modelItem";
    btn.type = "button";
    btn.textContent = file.name;

    btn.addEventListener("click", () => {
      const allButtons = modelsList.querySelectorAll(".modelItem");
      allButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      loadOBJFromURL(file.url, file.name);
    });

    modelsList.appendChild(btn);
  });
}

async function loadAvailableModels() {
  try {
    setStatus("Buscando modelos en assets/modelos...");
    const files = await getOBJFilesFromDirectory();
    renderModelsList(files);

    if (files.length > 0) {
      loadOBJFromURL(files[0].url, files[0].name);

      const firstBtn = modelsList?.querySelector(".modelItem");
      firstBtn?.classList.add("active");
    } else {
      setStatus("No se encontraron modelos en assets/modelos.");
    }
  } catch (error) {
    console.error(error);

    if (modelsList) {
      modelsList.innerHTML = `
        <p class="muted">
          No se pudo leer la carpeta automáticamente.<br>
          Verifica que exista <strong>assets/modelos</strong> y que el servidor permita listar archivos.
        </p>
      `;
    }

    setStatus("No se pudo cargar la lista de modelos.");
  }
}

// =========================
// Suelo de referencia
// =========================
const grid = new THREE.GridHelper(8, 8, 0x44506a, 0x2a3347);
grid.position.y = -1.2;
scene.add(grid);

// =========================
// Animación
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
loadAvailableModels();