import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';

// =========================================================================
// 1. BAZA PODSTAWOWYCH KSZTAŁTÓW (STANDARD TINKERCAD 20x20x20 MM)
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
// 2. GENERATOR PARAMETRYCZNY ŚRUB I NAKRĘTEK METRYCZNYCH (ISO)
// =========================================================================
function createThreadGeometry(diameter, pitch, length, radialSegs = 40) {
    const H = 0.866025 * pitch;
    const rMajor = diameter / 2;
    const rMinor = Math.max(0.5, rMajor - 0.6134 * pitch);
    const turns = Math.max(1, length / pitch);
    const totalSteps = Math.ceil(turns * radialSegs);
    const stepAngle = (Math.PI * 2) / radialSegs;

    const vertices = [];
    const indices = [];

    // Profil gwintu na każdym kroku kątowym (4 punkty na skok: dolina, zbocze, szczyt, zbocze)
    for (let i = 0; i <= totalSteps; i++) {
        const angle = i * stepAngle;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const yBase = (i / radialSegs) * pitch;

        const profile = [
            { r: rMinor, y: yBase },
            { r: rMajor, y: yBase + 0.375 * pitch },
            { r: rMajor, y: yBase + 0.625 * pitch },
            { r: rMinor, y: yBase + pitch }
        ];

        for (let p = 0; p < 4; p++) {
            const py = Math.min(length, Math.max(0, profile[p].y));
            const pr = (py <= 0 || py >= length) ? rMinor : profile[p].r;
            vertices.push(pr * cos, py, pr * sin);
        }
    }

    const ringVerts = 4;
    for (let i = 0; i < totalSteps; i++) {
        for (let p = 0; p < 3; p++) {
            const a = i * ringVerts + p;
            const b = (i + 1) * ringVerts + p;
            const c = (i + 1) * ringVerts + (p + 1);
            const d = i * ringVerts + (p + 1);
            indices.push(a, d, b);
            indices.push(b, d, c);
        }
    }

    // Zamknięcie dolnej i górnej podstawy walca gwintu
    const bottomCenterIdx = vertices.length / 3;
    vertices.push(0, 0, 0);
    const topCenterIdx = vertices.length / 3;
    vertices.push(0, length, 0);

    for (let i = 0; i < totalSteps; i++) {
        const b1 = i * ringVerts;
        const b2 = (i + 1) * ringVerts;
        indices.push(bottomCenterIdx, b1, b2);

        const t1 = i * ringVerts + 3;
        const t2 = (i + 1) * ringVerts + 3;
        indices.push(topCenterIdx, t2, t1);
    }

    let geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom = BufferGeometryUtils.mergeVertices(geom, 1e-4);
    geom.computeVertexNormals();
    return geom;
}

function generateScrewGeometry(params) {
    const { type, diameter, pitch, length, headW, headH, tolerance } = params;
    const evaluator = new Evaluator();

    if (type === 'rod') {
        const rod = createThreadGeometry(diameter, pitch, length);
        rod.center();
        return rod;
    }

    if (type === 'bolt') {
        const hexRadius = headW / Math.sqrt(3);
        const headGeom = new THREE.CylinderGeometry(hexRadius, hexRadius, headH, 6);
        headGeom.translate(0, headH / 2, 0);

        const shaftGeom = createThreadGeometry(diameter, pitch, length);
        shaftGeom.translate(0, headH - 0.1, 0);

        const headBrush = new Brush(BufferGeometryUtils.mergeVertices(headGeom, 1e-4));
        const shaftBrush = new Brush(shaftGeom);
        headBrush.updateMatrixWorld();
        shaftBrush.updateMatrixWorld();

        const result = evaluator.evaluate(headBrush, shaftBrush, ADDITION);
        let finalGeom = BufferGeometryUtils.mergeVertices(result.geometry, 1e-4);
        finalGeom.computeVertexNormals();
        finalGeom.center();
        return finalGeom;
    }

    if (type === 'nut') {
        const hexRadius = headW / Math.sqrt(3);
        const nutGeom = new THREE.CylinderGeometry(hexRadius, hexRadius, headH, 6);
        nutGeom.translate(0, headH / 2, 0);

        // Gwint wewnętrzny powiększony o luz montażowy (tolerance) i dłuższy o 2 mm by przebił na wylot
        const holeThread = createThreadGeometry(diameter + tolerance * 2, pitch, headH + 2);
        holeThread.translate(0, -1, 0);

        const nutBrush = new Brush(BufferGeometryUtils.mergeVertices(nutGeom, 1e-4));
        const holeBrush = new Brush(holeThread);
        nutBrush.updateMatrixWorld();
        holeBrush.updateMatrixWorld();

        const result = evaluator.evaluate(nutBrush, holeBrush, SUBTRACTION);
        let finalGeom = BufferGeometryUtils.mergeVertices(result.geometry, 1e-4);
        finalGeom.computeVertexNormals();
        finalGeom.center();
        return finalGeom;
    }
}

// =========================================================================
// 3. INICJALIZACJA SCENY, KAMERY I KONTROLEK
// =========================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x282c34);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 3000);
camera.position.set(90, 90, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(80, 150, 100);
dirLight.castShadow = true;
scene.add(dirLight);

const gridHelper = new THREE.GridHelper(200, 20, 0x3498db, 0x444444);
scene.add(gridHelper);

const planeGeom = new THREE.PlaneGeometry(200, 200);
planeGeom.rotateX(-Math.PI / 2);
const workplane = new THREE.Mesh(planeGeom, new THREE.MeshStandardMaterial({ color: 0x333842, roughness: 0.85 }));
workplane.position.y = -0.05;
workplane.receiveShadow = true;
scene.add(workplane);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.1;
orbitControls.enableZoom = false; // Własny precyzyjny zoom pod kursor
orbitControls.screenSpacePanning = false;
orbitControls.minDistance = 2;

// =========================================================================
// 5. ZARZĄDZANIE OBIEKTAMI, WYMIARAMI (MM), GRUPOWANIEM I HISTORIĄ
// =========================================================================
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
let selectedObjects = [];
let undoStack = [];
let redoStack = [];
const selectionGroup = new THREE.Group();
scene.add(selectionGroup);

function getObjectBounds(obj) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
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

function createSceneMesh(geometry, name, solidColor, isHole = false, customData = {}) {
    const mat = new THREE.MeshStandardMaterial({ color: solidColor, roughness: 0.4, metalness: 0.1 });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    mesh.userData = { solidColor, isHole, ...customData };
    applyObjectAppearance(mesh);
    return mesh;
}

// =========================================================================
// 6. GENEROWANIE MENU KSZTAŁTÓW, ŚRUB I TEKSTU 3D
// =========================================================================
const shapesListEl = document.getElementById('shapes-list');
MOJE_OBIEKTY.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'shape-btn';
    const svgFn = IKONY_SVG[item.ikona] || IKONY_SVG.szescian;
    btn.innerHTML = `<div class="shape-icon">${svgFn(item.kolor)}</div><span>${item.nazwa}</span>`;
    btn.onclick = () => {
        pushUndoState();
        const mesh = createSceneMesh(item.stworzGeometrie(), item.nazwa, item.kolor, false, { templateId: item.id });
        dropToWorkplane(mesh);
        scene.add(mesh);
        sceneObjects.push(mesh);
        setSelection([mesh]);
        saveProjectToLocal();
    };
    shapesListEl.appendChild(btn);
});

const screwPresetEl = document.getElementById('screw-preset');
const screwTypeEl = document.getElementById('screw-type');
const screwDiamEl = document.getElementById('screw-diam');
const screwPitchEl = document.getElementById('screw-pitch');
const screwLenEl = document.getElementById('screw-len');
const screwHeadWEl = document.getElementById('screw-head-w');
const screwHeadHEl = document.getElementById('screw-head-h');
const screwTolEl = document.getElementById('screw-tol');

screwPresetEl.addEventListener('change', (e) => {
    if (e.target.value === 'custom') return;
    const [d, p, hw, hh] = e.target.value.split(',').map(Number);
    screwDiamEl.value = d;
    screwPitchEl.value = p;
    screwHeadWEl.value = hw;
    screwHeadHEl.value = hh;
});

document.getElementById('btn-add-screw').onclick = () => {
    pushUndoState();
    const params = {
        type: screwTypeEl.value,
        diameter: parseFloat(screwDiamEl.value) || 8,
        pitch: parseFloat(screwPitchEl.value) || 1.25,
        length: parseFloat(screwLenEl.value) || 20,
        headW: parseFloat(screwHeadWEl.value) || 13,
        headH: parseFloat(screwHeadHEl.value) || 5.3,
        tolerance: parseFloat(screwTolEl.value) || 0.25
    };
    const geom = generateScrewGeometry(params);
    const label = params.type === 'bolt' ? `Śruba M${params.diameter}` : (params.type === 'nut' ? `Nakrętka M${params.diameter}` : `Gwint M${params.diameter}`);
    const mesh = createSceneMesh(geom, label, '#95a5a6', false, { screwParams: params });
    dropToWorkplane(mesh);
    scene.add(mesh);
    sceneObjects.push(mesh);
    setSelection([mesh]);
    saveProjectToLocal();
};

let loadedFont = null;
const fontLoader = new FontLoader();
fontLoader.load('https://unpkg.com', (font) => {
    loadedFont = font;
});

document.getElementById('btn-add-text').onclick = () => {
    const txt = document.getElementById('text-3d-input').value.trim();
    if (!txt) return;
    if (!loadedFont) return alert('Czcionka 3D jeszcze się ładuje, spróbuj za sekundę.');
    pushUndoState();
    let geom = new TextGeometry(txt, { font: loadedFont, size: 8, height: 4, curveSegments: 8, bevelEnabled: false });
    geom.rotateX(-Math.PI / 2);
    geom.center();
    geom = BufferGeometryUtils.mergeVertices(geom, 1e-4);
    geom.computeVertexNormals();
    const mesh = createSceneMesh(geom, `Tekst: ${txt}`, '#e74c3c', false, { text3d: txt });
    dropToWorkplane(mesh);
    scene.add(mesh);
    sceneObjects.push(mesh);
    setSelection([mesh]);
    saveProjectToLocal();
};

// =========================================================================
// 7. ZAZNACZANIE (W TYM SHIFT + KLIK), STRZAŁKI I INSPEKTOR WYMIARÓW
// =========================================================================
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
const snapSelect = document.getElementById('snap-select');
const rulerReadout = document.getElementById('ruler-readout');

function updateSnapSettings() {
    const step = parseFloat(snapSelect.value);
    transformControls.setTranslationSnap(step > 0 ? step : null);
    transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
}
snapSelect.addEventListener('change', updateSnapSettings);
updateSnapSettings();

transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
    isDraggingGizmo = event.value;
    if (event.value) {
        pushUndoState();
    } else {
        finalizeTransformAttachment();
        selectedObjects.forEach(keepAboveWorkplane);
        reattachGizmo();
        updateInspector();
        saveProjectToLocal();
    }
});

transformControls.addEventListener('change', () => {
    if (isDraggingGizmo && selectedObjects.length > 0) {
        updateInspector();
    }
});

function finalizeTransformAttachment() {
    if (selectedObjects.length > 1 && selectionGroup.children.length > 0) {
        const children = [...selectionGroup.children];
        children.forEach(child => scene.attach(child));
    }
}

function reattachGizmo() {
    transformControls.detach();
    if (selectedObjects.length === 1) {
        transformControls.attach(selectedObjects[0]);
    } else if (selectedObjects.length > 1) {
        const box = new THREE.Box3();
        selectedObjects.forEach(o => box.expandByObject(o));
        const center = new THREE.Vector3();
        box.getCenter(center);
        selectionGroup.position.copy(center);
        selectionGroup.rotation.set(0, 0, 0);
        selectionGroup.scale.set(1, 1, 1);
        selectionGroup.updateMatrixWorld(true);
        selectedObjects.forEach(o => selectionGroup.attach(o));
        transformControls.attach(selectionGroup);
    }
}

function setSelection(objs) {
    finalizeTransformAttachment();
    selectedObjects = objs;
    reattachGizmo();
    if (selectedObjects.length > 0) {
        inspectorEl.classList.remove('hidden');
        updateInspector();
    } else {
        inspectorEl.classList.add('hidden');
        rulerReadout.classList.add('hidden');
    }
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (isDraggingGizmo || transformControls.axis !== null) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(sceneObjects, false);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        if (event.shiftKey) {
            const exists = selectedObjects.includes(hit);
            const next = exists ? selectedObjects.filter(o => o !== hit) : [...selectedObjects, hit];
            setSelection(next);
        } else {
            setSelection([hit]);
        }
    } else if (!event.shiftKey) {
        setSelection([]);
    }
});

renderer.domElement.addEventListener('dblclick', () => {
