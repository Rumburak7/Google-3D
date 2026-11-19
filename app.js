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
