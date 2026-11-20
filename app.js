import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

// =========================================================================
// 1. TWOJA BAZA OBIEKTÓW (STANDARD TINKERCAD 20x20x20 MM)
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
    { id: "szescian", nazwa: "Sześcian", kolor: "#e74c3c", ikona: "szescian", stworzGeometrie: () => new THREE.BoxGeometry(20, 20, 20) },
    { id: "walec", nazwa: "Walec", kolor: "#e67e22", ikona: "walec", stworzGeometrie: () => new THREE.CylinderGeometry(10, 10, 20, 32) },
    { id: "kula", nazwa: "Kula", kolor: "#3498db", ikona: "kula", stworzGeometrie: () => new THREE.SphereGeometry(10, 32, 24) },
    { id: "stozek", nazwa: "Stożek", kolor: "#9b59b6", ikona: "stozek", stworzGeometrie: () => new THREE.ConeGeometry(10, 20, 32) },
    { id: "pierscien", nazwa: "Pierścień", kolor: "#2ecc71", ikona: "pierscien", stworzGeometrie: () => { const g = new THREE.TorusGeometry(8, 2, 16, 48); g.rotateX(Math.PI / 2); return g; } },
    { id: "rurka", nazwa: "Rurka", kolor: "#1abc9c", ikona: "rurka", stworzGeometrie: () => {
        const shape = new THREE.Shape(); shape.absarc(0, 0, 10, 0, Math.PI * 2, false);
        const hole = new THREE.Path(); hole.absarc(0, 0, 6, 0, Math.PI * 2, true); shape.holes.push(hole);
        const geom = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false, curveSegments: 32 });
        geom.rotateX(-Math.PI / 2); geom.center(); return geom;
    }},
    { id: "dach", nazwa: "Dach (Klin)", kolor: "#f1c40f", ikona: "dach", stworzGeometrie: () => { const g = new THREE.CylinderGeometry(0, 14.14, 20, 4); g.rotateY(Math.PI / 4); return g; } },
    { id: "plytka", nazwa: "Płytka 20x20", kolor: "#95a5a6", ikona: "plytka", stworzGeometrie: () => new THREE.BoxGeometry(20, 2, 20) }
];

// =========================================================================
// 2. INICJALIZACJA SCENY 3D I KAMERY
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

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(60, 120, 80);
dirLight.castShadow = true;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(200, 20, 0x3498db, 0x444444);
scene.add(gridHelper);

const planeGeom = new THREE.PlaneGeometry(200, 200);
planeGeom.rotateX(-Math.PI / 2);
const workplane = new THREE.Mesh(planeGeom, new THREE.MeshStandardMaterial({ color: 0x333842, roughness: 0.8 }));
workplane.position.y = -0.05;
workplane.receiveShadow = true;
scene.add(workplane);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.1;
orbitControls.enableZoom = false;
orbitControls.screenSpacePanning = false;
orbitControls.minDistance = 2;
orbitControls.maxDistance = 500;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.03;

const transformControls = new TransformControls(camera, renderer.domElement);
let isDraggingGizmo = false;
scene.add(transformControls);

const snapSelect = document.getElementById('snap-select');
function updateSnap() {
    if (!snapSelect) return;
    const step = parseFloat(snapSelect.value);
    transformControls.setTranslationSnap(step > 0 ? step : null);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
}
if (snapSelect) {
    snapSelect.addEventListener('change', updateSnap);
    updateSnap();
}

// =========================================================================
// 3. PŁYNNY ZOOM POD KURSOR, NAJAZD KAMERY (F / HOME) I OBIEKTY
// =========================================================================
let camAnimTargetPos = null;
let camAnimTargetLook = null;

function focusCameraOnBox(box) {
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 10);
    const dist = maxDim * 2.2;
    const dir = camera.position.clone().sub(orbitControls.target).normalize();
    if (dir.lengthSq() < 0.001) dir.set(1, 1, 1).normalize();
    camAnimTargetLook = center.clone();
    camAnimTargetPos = center.clone().add(dir.multiplyScalar(dist));
}

function focusSelected() {
    if (!selectedObject) return;
    selectedObject.updateMatrixWorld(true);
    focusCameraOnBox(new THREE.Box3().setFromObject(selectedObject));
}

function fitAllObjects() {
    if (sceneObjects.length === 0) {
        camAnimTargetLook = new THREE.Vector3(0, 0, 0);
        camAnimTargetPos = new THREE.Vector3(80, 80, 100);
        return;
    }
    const box = new THREE.Box3();
    sceneObjects.forEach(o => { o.updateMatrixWorld(true); box.expandByObject(o); });
    focusCameraOnBox(box);
}

const wheelRaycaster = new THREE.Raycaster();
const wheelMouse = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    camAnimTargetPos = null;
    const rect = renderer.domElement.getBoundingClientRect();
    wheelMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    wheelMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    wheelRaycaster.setFromCamera(wheelMouse, camera);
    let hitPoint = new THREE.Vector3();
    const hits = wheelRaycaster.intersectObjects(sceneObjects, false);
    if (hits.length > 0) {
        hitPoint.copy(hits[0].point);
    } else if (!wheelRaycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        hitPoint.copy(orbitControls.target);
    }
    const factor = e.deltaY < 0 ? 0.85 : 1.18;
    const currentDist = camera.position.distanceTo(hitPoint);
    if ((factor < 1 && currentDist < 2.2) || (factor > 1 && currentDist > 480)) return;
    camera.position.lerp(hitPoint, 1 - factor);
    orbitControls.target.lerp(hitPoint, 1 - factor);
    orbitControls.update();
}, { passive: false });

renderer.domElement.addEventListener('pointerdown', () => { camAnimTargetPos = null; });

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

function createHoleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#555555'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#999999'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-16, 64); ctx.lineTo(64, -16); ctx.moveTo(0, 80); ctx.lineTo(80, 0); ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
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
const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.1 });
const mesh = new THREE.Mesh(geometry, material);
mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = item.nazwa;
mesh.userData = { templateId: item.id, solidColor: color, isHole: savedData ? savedData.isHole : false };
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
// 4. ZAZNACZANIE, INSPEKTOR WYMIARÓW (MM), DUPLIKOWANIE I SKRÓTY
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
renderer.domElement.addEventListener('dblclick', () => {
if (selectedObject) focusSelected();
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
btnModeSolid.onclick = () => { if (selectedObject) { selectedObject.userData.isHole = false; applyObjectAppearance(selectedObject); updateInspector(); saveProjectToLocal(); } };
btnModeHole.onclick = () => { if (selectedObject) { selectedObject.userData.isHole = true; applyObjectAppearance(selectedObject); updateInspector(); saveProjectToLocal(); } };
colorPicker.addEventListener('input', (e) => { if (selectedObject) { selectedObject.userData.solidColor = e.target.value; selectedObject.userData.isHole = false; applyObjectAppearance(selectedObject); updateInspector(); saveProjectToLocal(); } });
function applyDimensionInput(axis, newVal) {
if (!selectedObject || isNaN(newVal) || newVal <= 0.1) return;
const { size } = getObjectBounds(selectedObject);
if (size[axis] > 0) {
selectedObject.scale[axis] *= (newVal / size[axis]);
keepAboveWorkplane(selectedObject);
updateInspector();
saveProjectToLocal();
}
}
inputDimX.addEventListener('change', (e) => applyDimensionInput('x', parseFloat(e.target.value)));
inputDimY.addEventListener('change', (e) => applyDimensionInput('y', parseFloat(e.target.value)));
inputDimZ.addEventListener('change', (e) => applyDimensionInput('z', parseFloat(e.target.value)));
inputPosX.addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (selectedObject && !isNaN(v)) { selectedObject.position.x = v; updateInspector(); saveProjectToLocal(); } });
inputPosZ.addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (selectedObject && !isNaN(v)) { selectedObject.position.z = v; updateInspector(); saveProjectToLocal(); } });
inputPosY.addEventListener('change', (e) => { const v = Math.max(0, parseFloat(e.target.value)); if (selectedObject && !isNaN(v)) { const { box } = getObjectBounds(selectedObject); selectedObject.position.y += (v - box.min.y); updateInspector(); saveProjectToLocal(); } });
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
const btnFocus = document.getElementById('btn-focus');
if (btnFocus) btnFocus.onclick = focusSelected;
const btnFitAll = document.getElementById('btn-fit-all');
if (btnFitAll) btnFitAll.onclick = fitAllObjects;
document.getElementById('btn-drop').onclick = () => { if (selectedObject) { dropToWorkplane(selectedObject); updateInspector(); saveProjectToLocal(); } };
function duplicateSelected() {
if (!selectedObject) return;
const template = MOJE_OBIEKTY.find(t => t.id === selectedObject.userData.templateId);
if (!template) return;
const clone = createMeshFromTemplate(template, {
solidColor: selectedObject.userData.solidColor,
isHole: selectedObject.userData.isHole,
position: [selectedObject.position.x + 10, selectedObject.position.y, selectedObject.position.z + 10],
rotation: [selectedObject.rotation.x, selectedObject.rotation.y, selectedObject.rotation.z],
scale: selectedObject.scale.toArray()
});
scene.add(clone);
sceneObjects.push(clone);
selectObject(clone);
saveProjectToLocal();
}
const btnDup = document.getElementById('btn-duplicate');
if (btnDup) btnDup.onclick = duplicateSelected;
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
window.addEventListener('keydown', (e) => {
if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateSelected(); return; }
if (e.key === 'w' || e.key === 'W') setTransformMode('translate', btnTranslate);
if (e.key === 'e' || e.key === 'E') setTransformMode('rotate', btnRotate);
if (e.key === 'r' || e.key === 'R') setTransformMode('scale', btnScale);
if (e.key === 'd' || e.key === 'D') { if (selectedObject) { dropToWorkplane(selectedObject); updateInspector(); saveProjectToLocal(); } }
if (e.key === 'f' || e.key === 'F') focusSelected();
if (e.key === 'Home') fitAllObjects();
if (e.key === 'Delete') deleteSelected();
});
// =========================================================================
// 5. ZAPIS I ODCZYT PROJEKTU (LOCALSTORAGE + PLIK JSON)
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
try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeScene())); } catch (e) {}
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
try { const parsed = JSON.parse(savedRaw); if (Array.isArray(parsed)) loadSceneFromData(parsed); } catch (e) {}
}
document.getElementById('btn-save-file').onclick = () => {
downloadBlob(new Blob([JSON.stringify(serializeScene(), null, 2)], { type: 'application/json' }), 'projekt-3d.json');
};
const fileInput = document.getElementById('file-input');
document.getElementById('btn-load-file').onclick = () => fileInput.click();
fileInput.addEventListener('change', (e) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = (ev) => {
try { const parsed = JSON.parse(ev.target.result); if (Array.isArray(parsed)) loadSceneFromData(parsed); } catch (err) { alert('Nieprawidłowy plik projektu!'); }
};
reader.readAsText(file);
fileInput.value = '';
});
document.getElementById('btn-clear-scene').onclick = () => {
if (sceneObjects.length > 0 && confirm('Czy na pewno wyczyścić całą scenę?')) loadSceneFromData([]);
};
// =========================================================================
// 6. WYCINANIE OTWORÓW (CSG), ZAMYKANIE SIATEK I EKSPORT STL / 3MF
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
return solids.map(solid => {
const solidGeom = prepareClosedGeometry(solid);
const solidBox = new THREE.Box3().setFromBufferAttribute(solidGeom.attributes.position);
let currentBrush = new Brush(solidGeom);
currentBrush.updateMatrixWorld();
holeBrushes.forEach(hb => {
if (solidBox.intersectsBox(hb.box)) currentBrush = evaluator.evaluate(currentBrush, hb.brush, SUBTRACTION);
});
let finalGeom = currentBrush.geometry;
if (finalGeom.attributes.uv) finalGeom.deleteAttribute('uv');
finalGeom = BufferGeometryUtils.mergeVertices(finalGeom, 1e-4);
finalGeom.computeVertexNormals();
return { geometry: finalGeom, color: solid.userData.solidColor };
});
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
if (parts.length === 0) return alert('Dodaj najpierw przynajmniej jedną Bryłę!');
const group = new THREE.Group();
parts.forEach(p => group.add(new THREE.Mesh(p.geometry)));
const exporter = new STLExporter();
downloadBlob(new Blob([exporter.parse(group, { binary: true })], { type: 'application/octet-stream' }), 'moj-projekt.stl');
};
document.getElementById('btn-export-3mf').onclick = async () => {
const parts = buildFinalMeshesWithCSG();
if (parts.length === 0) return alert('Dodaj najpierw przynajmniej jedną Bryłę!');
const JSZip = (await import('jsdelivr.net')).default;
const zip = new JSZip();
let baseMaterialsXml = '', objectsXml = '', buildXml = '';
parts.forEach((part, index) => {
const objId = index + 1;
    parts.forEach((part, index) => {
        const objId = index + 1;
        baseMaterialsXml += '<base name="Kolor_' + objId + '" displaycolor="' + part.color.toUpperCase() + 'FF" />\n';
        const pos = part.geometry.attributes.position;
        const idx = part.geometry.index;
        let verticesXml = '', trianglesXml = '';
        for (let i = 0; i < pos.count; i++) {
            verticesXml += '<vertex x="' + pos.getX(i).toFixed(4) + '" y="' + (-pos.getZ(i)).toFixed(4) + '" z="' + pos.getY(i).toFixed(4) + '" />\n';
        }
        if (idx) {
            for (let i = 0; i < idx.count; i += 3) {
                trianglesXml += '<triangle v1="' + idx.getX(i) + '" v2="' + idx.getX(i+1) + '" v3="' + idx.getX(i+2) + '" pid="1" p1="' + index + '" />\n';
            }
        } else {
            for (let i = 0; i < pos.count; i += 3) {
                trianglesXml += '<triangle v1="' + i + '" v2="' + (i+1) + '" v3="' + (i+2) + '" pid="1" p1="' + index + '" />\n';
            }
        }
        objectsXml += '<object id="' + objId + '" type="model" pid="1" pindex="' + index + '"><mesh><vertices>' + verticesXml + '</vertices><triangles>' + trianglesXml + '</triangles></mesh></object>';
        buildXml += '<item objectid="' + objId + '" />\n';
    });

    const modelXml = '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://microsoft.com"><resources><basematerials id="1">' + baseMaterialsXml + '</basematerials>' + objectsXml + '</resources><build>' + buildXml + '</build></model>';
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://openxmlformats.org"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" /></Types>');
    zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://openxmlformats.org"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://microsoft.com" /></Relationships>');
    zip.folder('3D').file('3dmodel.model', modelXml);

// =========================================================================
// 7. PĘTLA RENDEROWANIA I RESPONSYWNOŚĆ
// =========================================================================
window.addEventListener('resize', () => {
camera.aspect = container.clientWidth / container.clientHeight;
camera.updateProjectionMatrix();
renderer.setSize(container.clientWidth, container.clientHeight);
});
function animate() {
requestAnimationFrame(animate);
if (camAnimTargetPos && camAnimTargetLook) {
camera.position.lerp(camAnimTargetPos, 0.14);
orbitControls.target.lerp(camAnimTargetLook, 0.14);
if (camera.position.distanceTo(camAnimTargetPos) < 0.2) {
camAnimTargetPos = null;
camAnimTargetLook = null;
}
}
orbitControls.update();
renderer.render(scene, camera);
}
animate();
