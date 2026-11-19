import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// =========================================================================
// 1. TWOJA BAZA OBIEKTÓW - TUTAJ DODAJESZ WŁASNE RZECZY!
// =========================================================================
const IKONY_SVG = {
    szescian: (c) => `<svg viewBox="0 0 64 64"><polygon points="32,8 56,20 32,32 8,20" fill="${c}" opacity="0.9"/><polygon points="8,20 32,32 32,56 8,44" fill="${c}" opacity="0.7"/><polygon points="56,20 32,32 32,56 56,44" fill="${c}"/></svg>`,
    walec: (c) => `<svg viewBox="0 0 64 64"><path d="M14,18 L14,46 A18,8 0 0,0 50,46 L50,18 Z" fill="${c}" opacity="0.8"/><ellipse cx="32" cy="18" rx="18" ry="8" fill="${c}"/></svg>`,
    kula: (c) => `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="${c}"/><ellipse cx="25" cy="24" rx="6" ry="4" fill="#ffffff" opacity="0.3"/></svg>`,
    stozek: (c) => `<svg viewBox="0 0 64 64"><path d="M32,8 L12,48 A20,7 0 0,0 52,48 Z" fill="${c}"/></svg>`,
    pierscien: (c) => `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="22" ry="14" fill="none" stroke="${c}" stroke-width="8"/></svg>`,
    rurka: (c) => `<svg viewBox="0 0 64 64"><path d="M14,18 L14,46 A18,8 0 0,0 50,46 L50,18 Z" fill="${c}" opacity="0.8"/><ellipse cx="32" cy="18" rx="18" ry="8" fill="${c}"/><ellipse cx="32" cy="18" rx="9" ry="4" fill="#252526"/></svg>`,
    dach: (c) => `<svg viewBox="0 0 64 64"><polygon points="32,12 10,48 54,48" fill="${c}"/></svg>`,
    plytka: (c) => `<svg viewBox="0 0 64 64"><polygon points="32,22 58,32 32,42 6,32" fill="${c}"/><polygon points="6,32 32,42 32,48 6,38" fill="${c}" opacity="0.7"/><polygon points="58,32 32,42 32,48 58,38" fill="${c}" opacity="0.9"/></svg>`
};

const MOJE_OBIEKTY = [
    {
        id: "szescian",
        nazwa: "Sześcian",
        kolor: "#e74c3c",
        ikona: "szescian",
        stworzGeometrie: () => new THREE.BoxGeometry(20, 20, 20)
    },
    {
        id: "walec",
        nazwa: "Walec",
        kolor: "#e67e22",
        ikona: "walec",
        stworzGeometrie: () => new THREE.CylinderGeometry(10, 10, 20, 32)
    },
    {
        id: "kula",
        nazwa: "Kula",
        kolor: "#3498db",
        ikona: "kula",
        stworzGeometrie: () => new THREE.SphereGeometry(12, 32, 24)
    },
    {
        id: "stozek",
        nazwa: "Stożek",
        kolor: "#9b59b6",
        ikona: "stozek",
        stworzGeometrie: () => new THREE.ConeGeometry(10, 20, 32)
    },
    {
        id: "pierscien",
        nazwa: "Pierścień",
        kolor: "#2ecc71",
        ikona: "pierscien",
        stworzGeometrie: () => new THREE.TorusGeometry(10, 3, 16, 48)
    },
    {
        id: "rurka",
        nazwa: "Rurka",
        kolor: "#1abc9c",
        ikona: "rurka",
        stworzGeometrie: () => {
            const shape = new THREE.Shape();
            shape.absarc(0, 0, 10, 0, Math.PI * 2, false);
            const hole = new THREE.Path();
            hole.absarc(0, 0, 6, 0, Math.PI * 2, true);
            shape.holes.push(hole);
            const geom = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false, curveSegments: 32 });
            geom.rotateX(-Math.PI / 2);
            geom.center();
            return geom;
        }
    },
    {
        id: "dach",
        nazwa: "Dach (Klin)",
        kolor: "#f1c40f",
        ikona: "dach",
        stworzGeometrie: () => {
            const geom = new THREE.CylinderGeometry(0, 14, 20, 4);
            geom.rotateY(Math.PI / 4);
            return geom;
        }
    },
    {
        id: "plytka",
        nazwa: "Płytka baza",
        kolor: "#95a5a6",
        ikona: "plytka",
        stworzGeometrie: () => new THREE.BoxGeometry(40, 4, 40)
    }
];

// =========================================================================
// 2. INICJALIZACJA SCENY 3D
// =========================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x282c34);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 3000);
camera.position.set(80, 80, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Oświetlenie
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(60, 120, 80);
dirLight.castShadow = true;
scene.add(dirLight);

// Płaszczyzna robocza (200x200 mm)
const gridHelper = new THREE.GridHelper(200, 20, 0x3498db, 0x444444);
scene.add(gridHelper);

const planeGeom = new THREE.PlaneGeometry(200, 200);
planeGeom.rotateX(-Math.PI / 2);
const planeMat = new THREE.MeshStandardMaterial({ color: 0x333842, roughness: 0.8 });
const workplane = new THREE.Mesh(planeGeom, planeMat);
workplane.position.y = -0.05;
workplane.receiveShadow = true;
scene.add(workplane);

// Sterowanie kamerą (OrbitControls - bez własnego zoomu, obsłużymy go precyzyjniej)
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;
orbitControls.enableZoom = false; // Własna obsługa kółka myszy poniżej!
orbitControls.screenSpacePanning = false; // Prawy przycisk przesuwa równolegle do płyty
orbitControls.minDistance = 2;
orbitControls.maxDistance = 600;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.02;

// Sterowanie obiektami (strzałki)
const transformControls = new TransformControls(camera, renderer.domElement);
let isDraggingGizmo = false;

transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
    isDraggingGizmo = event.value;
    if (!event.value && selectedObject) {
        keepAboveWorkplane(selectedObject);
        updateInspector();
        saveProjectToLocal();
    }
});

transformControls.addEventListener('change', () => {
    if (selectedObject && isDraggingGizmo) {
        keepAboveWorkplane(selectedObject);
        updateInspector();
    }
});

scene.add(transformControls);

// =========================================================================
// 2B. PRECYZYJNE PRZYBLIŻANIE KÓŁKIEM MYSZY W PUNKT POD KURSOREM
// =========================================================================
let cameraAnim = null;
const zoomRaycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraAnim = null; // Przerwij ewentualną animację F / Home

    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    zoomRaycaster.setFromCamera(ndc, camera);

    // 1. Szukamy punktu 3D pod kursorem (najpierw na obiektach, potem na płaszczyźnie płyty)
    let hitPoint = new THREE.Vector3();
    const hits = zoomRaycaster.intersectObjects(sceneObjects, false);

    if (hits.length > 0) {
        hitPoint.copy(hits[0].point);
    } else {
        const planeHit = zoomRaycaster.ray.intersectPlane(groundPlane, hitPoint);
        if (!planeHit) {
            // Jeśli patrzymy prawie poziomo w niebo, bierzemy punkt wzdłuż promienia
            zoomRaycaster.ray.at(orbitControls.target.distanceTo(camera.position), hitPoint);
        }
    }

    // Ograniczenie punktu docelowego do rozsądnego obszaru wokół płyty
    hitPoint.x = THREE.MathUtils.clamp(hitPoint.x, -250, 250);
    hitPoint.z = THREE.MathUtils.clamp(hitPoint.z, -250, 250);
    hitPoint.y = Math.max(0, hitPoint.y);

    // 2. Normalizacja kroku kółka (działa identycznie na myszkach i gładzikach)
    const delta = Math.sign(event.deltaY);
    const zoomFactor = delta > 0 ? 1.12 : 0.89; // Płynny krok ok. 11%

    // 3. Skalujemy odległość kamery od punktu pod kursorem (prawdziwy Zoom-to-Cursor)
    const offsetCam = camera.position.clone().sub(hitPoint);
    const newDist = offsetCam.length() * zoomFactor;

    if (newDist < orbitControls.minDistance || newDist > orbitControls.maxDistance) {
        return;
    }

    offsetCam.multiplyScalar(zoomFactor);
    const newCamPos = hitPoint.clone().add(offsetCam);

    // Nie pozwalamy kamerze zejść pod płytę (Y >= 1.5 mm)
    if (newCamPos.y < 1.5) {
        newCamPos.y = 1.5;
    }

    // Przesuwamy również punkt obrotu (target) proporcjonalnie w stronę kursora
    const offsetTarget = orbitControls.target.clone().sub(hitPoint).multiplyScalar(zoomFactor);
    const newTarget = hitPoint.clone().add(offsetTarget);
    newTarget.y = Math.max(0, newTarget.y);

    camera.position.copy(newCamPos);
    orbitControls.target.copy(newTarget);
    orbitControls.update();
}, { passive: false });

function smoothMoveCamera(newTarget, newCamPos) {
    cameraAnim = {
        startPos: camera.position.clone(),
        endPos: newCamPos.clone(),
        startTarget: orbitControls.target.clone(),
        endTarget: newTarget.clone(),
        progress: 0
    };
}

function focusOnObject(mesh) {
    if (!mesh) return;
    const { box, size } = getObjectBounds(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 10);
    const dist = maxDim * 2.4;

    const dir = camera.position.clone().sub(orbitControls.target).normalize();
    if (dir.lengthSq() < 0.001) dir.set(1, 1, 1).normalize();

    const newCamPos = center.clone().add(dir.multiplyScalar(dist));
    newCamPos.y = Math.max(newCamPos.y, center.y + maxDim * 0.6);

    smoothMoveCamera(center, newCamPos);
}

function fitAllObjects() {
    if (sceneObjects.length === 0) {
        smoothMoveCamera(new THREE.Vector3(0, 0, 0), new THREE.Vector3(80, 80, 100));
        return;
    }

    const totalBox = new THREE.Box3();
    sceneObjects.forEach(obj => {
        obj.updateMatrixWorld(true);
        totalBox.expandByObject(obj);
    });

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    totalBox.getCenter(center);
    totalBox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 25);
    const dist = maxDim * 2.2;

    const dir = camera.position.clone().sub(orbitControls.target).normalize();
    if (dir.lengthSq() < 0.001) dir.set(1, 1, 1).normalize();

    const newCamPos = center.clone().add(dir.multiplyScalar(dist));
    newCamPos.y = Math.max(newCamPos.y, center.y + maxDim * 0.7);

    smoothMoveCamera(center, newCamPos);
}

// =========================================================================
// 3. TEKSTURA OTWORU I FUNKCJE GEOMETRII
// =========================================================================
function createHoleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-16, 64);
    ctx.lineTo(64, -16);
    ctx.moveTo(0, 80);
    ctx.lineTo(80, 0);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
}
const holeTexture = createHoleTexture();

const sceneObjects = [];
let selectedObject = null;

function getObjectBounds(mesh) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { box, size };
}

function dropToWorkplane(mesh) {
    const { box } = getObjectBounds(mesh);
    mesh.position.y -= box.min.y;
    mesh.updateMatrixWorld(true);
}

function keepAboveWorkplane(mesh) {
    const { box } = getObjectBounds(mesh);
    if (box.min.y < 0) {
        mesh.position.y -= box.min.y;
        mesh.updateMatrixWorld(true);
    }
}

function applyObjectAppearance(mesh) {
    if (mesh.userData.isHole) {
        mesh.material.color.set('#aaaaaa');
        mesh.material.map = holeTexture;
        mesh.material.transparent = true;
        mesh.material.opacity = 0.55;
    } else {
        mesh.material.color.set(mesh.userData.solidColor);
        mesh.material.map = null;
        mesh.material.transparent = false;
        mesh.material.opacity = 1.0;
    }
    mesh.material.needsUpdate = true;
}

// =========================================================================
// 4. GENEROWANIE MENU I DODAWANIE OBIEKTÓW
// =========================================================================
const shapesListEl = document.getElementById('shapes-list');

MOJE_OBIEKTY.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'shape-btn';
    const svgFn = IKONY_SVG[item.ikona] || IKONY_SVG.szescian;
    btn.innerHTML = `<div class="shape-icon">${svgFn(item.kolor)}</div><span>${item.nazwa}</span>`;
    btn.onclick = () => {
        const mesh = createMeshFromTemplate(item);
        scene.add(mesh);
        sceneObjects.push(mesh);
        selectObject(mesh);
        saveProjectToLocal();
    };
    shapesListEl.appendChild(btn);
});

function createMeshFromTemplate(item, savedData = null) {
    const geometry = item.stworzGeometrie();
    const color = savedData ? savedData.solidColor : item.kolor;

    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = item.nazwa;
    mesh.userData = {
        templateId: item.id,
        solidColor: color,
        isHole: savedData ? savedData.isHole : false
    };

    if (savedData) {
        mesh.position.fromArray(savedData.position);
        mesh.rotation.fromArray(savedData.rotation);
        mesh.scale.fromArray(savedData.scale);
    } else {
        dropToWorkplane(mesh);
    }

    applyObjectAppearance(mesh);
    return mesh;
}

// =========================================================================
// 5. ZAZNACZANIE, PODWÓJNE KLIKNIĘCIE I INSPEKTOR WYMIARÓW (MM)
// =========================================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const inspectorEl = document.getElementById('inspector');
const colorPicker = document.getElementById('color-picker');
const btnModeSolid = document.getElementById('mode-solid');
const btnModeHole = document.getElementById('mode-hole');

const inputDimX = document.getElementById('dim-x');
const inputDimY = document.getElementById('dim-y');
const inputDimZ = document.getElementById('dim-z');
const inputPosX = document.getElementById('pos-x');
const inputPosY = document.getElementById('pos-y');
const inputPosZ = document.getElementById('pos-z');

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (isDraggingGizmo || transformControls.axis !== null) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(sceneObjects, false);

    if (intersects.length > 0) {
        selectObject(intersects[0].object);
    } else {
        deselectObject();
    }
});

renderer.domElement.addEventListener('dblclick', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(sceneObjects, false);

    if (intersects.length > 0) {
        selectObject(intersects[0].object);
        focusOnObject(intersects[0].object);
    }
});

function selectObject(mesh) {
    selectedObject = mesh;
    transformControls.attach(mesh);
    inspectorEl.classList.remove('hidden');
    updateInspector();
}

function deselectObject() {
    selectedObject = null;
    transformControls.detach();
    inspectorEl.classList.add('hidden');
}

function updateInspector() {
    if (!selectedObject) return;

    colorPicker.value = selectedObject.userData.solidColor;
    btnModeSolid.classList.toggle('active', !selectedObject.userData.isHole);
    btnModeHole.classList.toggle('active', selectedObject.userData.isHole);

    const { box, size } = getObjectBounds(selectedObject);

    inputDimX.value = Number(size.x.toFixed(2));
    inputDimY.value = Number(size.y.toFixed(2));
    inputDimZ.value = Number(size.z.toFixed(2));

    inputPosX.value = Number(selectedObject.position.x.toFixed(2));
    inputPosZ.value = Number(selectedObject.position.z.toFixed(2));
    inputPosY.value = Number(box.min.y.toFixed(2));
}

btnModeSolid.onclick = () => {
    if (!selectedObject) return;
    selectedObject.userData.isHole = false;
    applyObjectAppearance(selectedObject);
    updateInspector();
    saveProjectToLocal();
};

btnModeHole.onclick = () => {
    if (!selectedObject) return;
    selectedObject.userData.isHole = true;
    applyObjectAppearance(selectedObject);
    updateInspector();
    saveProjectToLocal();
};

colorPicker.addEventListener('input', (e) => {
    if (!selectedObject) return;
    selectedObject.userData.solidColor = e.target.value;
    selectedObject.userData.isHole = false;
    applyObjectAppearance(selectedObject);
    updateInspector();
    saveProjectToLocal();
});

function applyDimensionInput(axis, newVal) {
    if (!selectedObject || isNaN(newVal) || newVal <= 0.1) return;
    const { size } = getObjectBounds(selectedObject);
    const currentSize = size[axis];
    if (currentSize > 0) {
        const factor = newVal / currentSize;
        selectedObject.scale[axis] *= factor;
        keepAboveWorkplane(selectedObject);
        updateInspector();
        saveProjectToLocal();
    }
}

inputDimX.addEventListener('change', (e) => applyDimensionInput('x', parseFloat(e.target.value)));
inputDimY.addEventListener('change', (e) => applyDimensionInput('y', parseFloat(e.target.value)));
inputDimZ.addEventListener('change', (e) => applyDimensionInput('z', parseFloat(e.target.value)));

inputPosX.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!selectedObject || isNaN(val)) return;
    selectedObject.position.x = val;
    updateInspector();
    saveProjectToLocal();
});

inputPosZ.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!selectedObject || isNaN(val)) return;
    selectedObject.position.z = val;
    updateInspector();
    saveProjectToLocal();
});

inputPosY.addEventListener('change', (e) => {
    const val = Math.max(0, parseFloat(e.target.value));
    if (!selectedObject || isNaN(val)) return;
    const { box } = getObjectBounds(selectedObject);
    const diff = val - box.min.y;
    selectedObject.position.y += diff;
    updateInspector();
    saveProjectToLocal();
});

// Przyciski narzędzi na górnym pasku
const btnTranslate = document.getElementById('btn-translate');
const btnRotate = document.getElementById('btn-rotate');
const btnScale = document.getElementById('btn-scale');

function setTransformMode(mode, activeBtn) {
    transformControls.setMode(mode);
    [btnTranslate, btnRotate, btnScale].forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
}

btnTranslate.onclick = () => setTransformMode('translate', btnTranslate);
btnRotate.onclick = () => setTransformMode('rotate', btnRotate);
btnScale.onclick = () => setTransformMode('scale', btnScale);

document.getElementById('btn-drop').onclick = () => {
    if (!selectedObject) return;
    dropToWorkplane(selectedObject);
    updateInspector();
    saveProjectToLocal();
};

document.getElementById('btn-focus').onclick = () => {
    if (selectedObject) focusOnObject(selectedObject);
};

document.getElementById('btn-fit-all').onclick = () => {
    fitAllObjects();
};

function deleteSelected() {
    if (!selectedObject) return;
    transformControls.detach();
    scene.remove(selectedObject);
    const idx = sceneObjects.indexOf(selectedObject);
    if (idx > -1) sceneObjects.splice(idx, 1);
    deselectObject();
    saveProjectToLocal();
}

document.getElementById('btn-delete').onclick = deleteSelected;

// Skróty klawiszowe
window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    if (e.key === 'w' || e.key === 'W') setTransformMode('translate', btnTranslate);
    if (e.key === 'e' || e.key === 'E') setTransformMode('rotate', btnRotate);
    if (e.key === 'r' || e.key === 'R') setTransformMode('scale', btnScale);
    if (e.key === 'f' || e.key === 'F') {
        if (selectedObject) focusOnObject(selectedObject);
    }
    if (e.key === 'Home') {
        e.preventDefault();
        fitAllObjects();
    }
    if (e.key === 'd' || e.key === 'D') {
        if (selectedObject) {
            dropToWorkplane(selectedObject);
            updateInspector();
            saveProjectToLocal();
        }
    }
    if (e.key === 'Delete') deleteSelected();
});

// =========================================================================
// 6. ZAPIS I ODCZYT PROJEKTU (LOCALSTORAGE + PLIK JSON)
// =========================================================================
const STORAGE_KEY = 'moj_cad_3d_autosave';

function serializeScene() {
    return sceneObjects.map(mesh => ({
        templateId: mesh.userData.templateId,
        solidColor: mesh.userData.solidColor,
        isHole: mesh.userData.isHole,
        position: mesh.position.toArray(),
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale: mesh.scale.toArray()
    }));
}

function saveProjectToLocal() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeScene()));
    } catch (err) {
        console.warn('Nie udało się zapisać w pamięci przeglądarki:', err);
    }
}

function loadSceneFromData(dataArray) {
    deselectObject();
    sceneObjects.forEach(obj => scene.remove(obj));
    sceneObjects.length = 0;

    dataArray.forEach(itemData => {
        const template = MOJE_OBIEKTY.find(t => t.id === itemData.templateId);
        if (template) {
            const mesh = createMeshFromTemplate(template, itemData);
            scene.add(mesh);
            sceneObjects.push(mesh);
        }
    });
    saveProjectToLocal();
}

const savedRaw = localStorage.getItem(STORAGE_KEY);
if (savedRaw) {
    try {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed)) loadSceneFromData(parsed);
    } catch (e) {
        console.warn('Błąd odczytu autozapisu:', e);
    }
}

document.getElementById('btn-save-file').onclick = () => {
    const json = JSON.stringify(serializeScene(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, 'projekt-3d.json');
};

const fileInput = document.getElementById('file-input');
document.getElementById('btn-load-file').onclick = () => fileInput.click();

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (Array.isArray(parsed)) loadSceneFromData(parsed);
        } catch (err) {
            alert('Nieprawidłowy plik projektu!');
        }
    };
    reader.readAsText(file);
    fileInput.value = '';
});

document.getElementById('btn-clear-scene').onclick = () => {
    if (sceneObjects.length === 0) return;
    if (confirm('Czy na pewno wyczyścić całą scenę?')) {
        loadSceneFromData([]);
    }
};

// =========================================================================
// 7. WYCINANIE OTWORÓW (CSG), ZAMYKANIE SIATEK I EKSPORT STL / 3MF
// =========================================================================
function prepareClosedGeometry(mesh) {
    let geom = mesh.geometry.clone();
    mesh.updateMatrixWorld(true);
    geom.applyMatrix4(mesh.matrixWorld);

    if (geom.attributes.uv) geom.deleteAttribute('uv');
    if (geom.attributes.normal) geom.deleteAttribute('normal');

    geom = BufferGeometryUtils.mergeVertices(geom, 1e-4);
    geom.computeVertexNormals();
    return geom;
}

function buildFinalMeshesWithCSG() {
    const solids = sceneObjects.filter(o => !o.userData.isHole);
    const holes = sceneObjects.filter(o => o.userData.isHole);

    if (solids.length === 0) return [];

    const evaluator = new Evaluator();

    const holeBrushes = holes.map(h => {
        const geom = prepareClosedGeometry(h);
        const brush = new Brush(geom);
        brush.updateMatrixWorld();
        return { brush, box: new THREE.Box3().setFromBufferAttribute(geom.attributes.position) };
    });

    const resultList = [];

    solids.forEach(solid => {
        const solidGeom = prepareClosedGeometry(solid);
        const solidBox = new THREE.Box3().setFromBufferAttribute(solidGeom.attributes.position);
        let currentBrush = new Brush(solidGeom);
        currentBrush.updateMatrixWorld();

        holeBrushes.forEach(hb => {
            if (solidBox.intersectsBox(hb.box)) {
                currentBrush = evaluator.evaluate(currentBrush, hb.brush, SUBTRACTION);
            }
        });

        let finalGeom = currentBrush.geometry;
        if (finalGeom.attributes.uv) finalGeom.deleteAttribute('uv');
        finalGeom = BufferGeometryUtils.mergeVertices(finalGeom, 1e-4);
        finalGeom.computeVertexNormals();

        resultList.push({
            geometry: finalGeom,
            color: solid.userData.solidColor
        });
    });

    return resultList;
}

function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

document.getElementById('btn-export-stl').onclick = () => {
    const parts = buildFinalMeshesWithCSG();
    if (parts.length === 0) return alert('Dodaj najpierw przynajmniej jedną Bryłę (nie sam Otwór)!');

    const group = new THREE.Group();
    parts.forEach(p => {
        const m = new THREE.Mesh(p.geometry);
        group.add(m);
    });

    const exporter = new STLExporter();
    const result = exporter.parse(group, { binary: true });
    const blob = new Blob([result], { type: 'application/octet-stream' });
    downloadBlob(blob, 'moj-projekt.stl');
};

document.getElementById('btn-export-3mf').onclick = async () => {
    const parts = buildFinalMeshesWithCSG();
    if (parts.length === 0) return alert('Dodaj najpierw przynajmniej jedną Bryłę!');

    const JSZipModule = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
    const JSZip = JSZipModule.default;
    const zip = new JSZip();

    let baseMaterialsXml = '';
    let objectsXml = '';
    let buildXml = '';

    parts.forEach((part, index) => {
        const matIdx = index;
        const objId = index + 1;
        const hexColor = part.color.toUpperCase() + 'FF';

        baseMaterialsXml += `<base name="Kolor_${objId}" displaycolor="${hexColor}" />
`;

        const pos = part.geometry.attributes.position;
        const idx = part.geometry.index;

        let verticesXml = '';
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i).toFixed(4);
            const y = (-pos.getZ(i)).toFixed(4);
            const z = pos.getY(i).toFixed(4);
            verticesXml += `<vertex x="${x}" y="${y}" z="${z}" />
`;
        }

        let trianglesXml = '';
        if (idx) {
            for (let i = 0; i < idx.count; i += 3) {
                trianglesXml += `<triangle v1="${idx.getX(i)}" v2="${idx.getX(i+1)}" v3="${idx.getX(i+2)}" pid="1" p1="${matIdx}" />
`;
            }
        } else {
            for (let i = 0; i < pos.count; i += 3) {
                trianglesXml += `<triangle v1="${i}" v2="${i+1}" v3="${i+2}" pid="1" p1="${matIdx}" />
`;
            }
        }

        objectsXml += `
        <object id="${objId}" type="model" pid="1" pindex="${matIdx}">
            <mesh>
                <vertices>${verticesXml}</vertices>
                <triangles>${trianglesXml}</triangles>
            </mesh>
        </object>`;
        buildXml += `<item objectid="${objId}" />
`;
    });

    const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
    <resources>
        <basematerials id="1">
            ${baseMaterialsXml}
        </basematerials>
        ${objectsXml}
    </resources>
    <build>${buildXml}</build>
</model>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
    <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;

    zip.file('[Content_Types].xml', contentTypesXml);
    zip.folder('_rels').file('.rels', relsXml);
    zip.folder('3D').file('3dmodel.model', modelXml);

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'moj-projekt-kolor.3mf');
};

// =========================================================================
// 8. PĘTLA RENDEROWANIA I RESPONSYWNOŚĆ
// =========================================================================
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

function animate() {
    requestAnimationFrame(animate);

    if (cameraAnim) {
        cameraAnim.progress = Math.min(1, cameraAnim.progress + 0.08);
        const ease = 1 - Math.pow(1 - cameraAnim.progress, 3);
        camera.position.lerpVectors(cameraAnim.startPos, cameraAnim.endPos, ease);
        orbitControls.target.lerpVectors(cameraAnim.startTarget, cameraAnim.endTarget, ease);
        if (cameraAnim.progress >= 1) {
            cameraAnim = null;
        }
    }

    orbitControls.update();
    renderer.render(scene, camera);
}
animate();
