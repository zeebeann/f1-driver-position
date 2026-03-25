// ============================================================================
// F1 Driver Position App
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const API_BASE = 'https://f1api.dev/api';
const SEASON = 2026;

let drivers = [];

// ============================================================================
// API FETCHING
// ============================================================================

/**
 * Fetch current drivers championship standings
 */
async function fetchStandings() {
    try {
        const response = await fetch(`${API_BASE}/current/drivers-championship`);
        const data = await response.json();
        drivers = data.drivers_championship || [];
        console.log(`Fetched ${drivers.length} drivers`);
        return drivers;
    } catch (error) {
        console.error('Error fetching standings:', error);
        updateStatus('Error loading drivers');
        return [];
    }
}

/**
 * Fetch all race results for a specific driver in the season
 */
async function fetchDriverRacePoints(driverId) {
    const racePoints = [];
    const maxRounds = 24; // up to 24 races

    for (let round = 1; round <= maxRounds; round++) {
        try {
            const response = await fetch(`${API_BASE}/${SEASON}/${round}/race`);
            if (!response.ok) {
                // no more races available (or invalid round)
                break;
            }
            const data = await response.json();

            // API returns root object with races field
            const racesData = data.races;
            if (!racesData || !Array.isArray(racesData.results)) {
                break;
            }

            const raceName = racesData.raceName || `Round ${round}`;
            const driverResult = racesData.results.find(r => r.driver && r.driver.driverId === driverId);

            if (driverResult) {
                const points = Number(driverResult.points || 0);
                const position = driverResult.position || '-';
                racePoints.push({ round, raceName, points, position });
            } else {
                racePoints.push({ round, raceName, points: 0, position: 'DNS' });
            }
        } catch (error) {
            console.warn(`Cannot fetch round ${round}:`, error);
            break;
        }
    }

    console.log(`Fetched ${racePoints.length} races for driver ${driverId}`, racePoints);
    return racePoints;
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

/**
 * Populate driver list with all drivers
 */
function populateDriverSelect() {
    const list = document.getElementById('driverList');
    list.innerHTML = '';
    
    drivers.forEach(driver => {
        const driverBtn = document.createElement('button');
        driverBtn.className = 'driver-btn';
        driverBtn.dataset.driverId = driver.driverId;
        driverBtn.textContent = `${driver.driver.name} ${driver.driver.surname}`;
        driverBtn.addEventListener('click', () => selectDriver(driver.driverId));
        list.appendChild(driverBtn);
    });
    
    if (drivers.length > 0) {
        updateStatus(`${drivers.length} drivers loaded`);
    }
}

/**
 * Update UI status message
 */
function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

/**
 * Select a driver and fetch their race data
 */
async function selectDriver(driverId) {
    const driver = drivers.find(d => d.driverId === driverId);
    
    if (driver) {
        updateStatus(`Loading race data for ${driver.driver.name} ${driver.driver.surname}...`);
        const racePoints = await fetchDriverRacePoints(driverId);
        const detailsContent = document.getElementById('detailsContent');
        detailsContent.innerHTML = '<canvas id="threeCanvas" width="900" height="800" style="display:block;margin:auto;"></canvas>';

        // Prepare SVGs for 3D layering
        const positionGrid = await renderPositionAsDigits(driver.position);
        const raceGrids = await Promise.all(racePoints.map(async (race) => {
            return await renderRaceGrid(race.points, driver.position);
        }));
        // Extract SVG markup only
        const extractSVG = html => {
            const match = html.match(/<svg[\s\S]*?<\/svg>/);
            return match ? match[0] : '';
        };
        const allSvgs = [extractSVG(positionGrid), ...raceGrids.map(extractSVG)];
        initThreeJS(allSvgs);

        detailsContent.classList.add('active');
        updateStatus(`${driver.driver.name} ${driver.driver.surname} - Races: ${racePoints.length}`);
        console.log('Driver info:', {
            name: `${driver.driver.name} ${driver.driver.surname}`,
            position: driver.position,
            totalPoints: driver.points,
            races: racePoints
        });
    }
// --- 3D SVG Layering with OrbitControls ---
function initThreeJS(svgStrings) {
    const canvas = document.getElementById('threeCanvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0, 2.5); // move camera closer for more zoom

    // OrbitControls for mouse rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;

    // Helper to load SVG as texture
    const loadTexture = (svgString) => {
        const dataUrl = 'data:image/svg+xml;base64,' + btoa(svgString);
        return new Promise((resolve) => {
            const loader = new THREE.TextureLoader();
            loader.load(dataUrl, resolve);
        });
    };

    // Layer all SVGs as planes, separated along z, and fix aspect ratio
    Promise.all(svgStrings.map(svg => loadTexture(svg))).then((textures) => {
        const numPlanes = textures.length;
        const zSpacing = 0.35;
        // Helper to add a border to a plane
        function addBorder(plane, width, height) {
            const borderGeom = new THREE.PlaneGeometry(width + 0.80, height + 0.50);
            const borderMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.1, side: THREE.DoubleSide });
            const border = new THREE.Mesh(borderGeom, borderMat);
            border.position.copy(plane.position);
            border.position.z -= 0.001; // ensure border is just behind
            scene.add(border);
        }
        // Races: index 1..N, Position: index 0
        for (let i = 1; i < numPlanes; i++) {
            let aspect = 1;
            const svg = svgStrings[i];
            const viewBoxMatch = svg.match(/viewBox=["'](\d+)[ ,]+(\d+)[ ,]+(\d+)[ ,]+(\d+)["']/);
            if (viewBoxMatch) {
                const w = parseFloat(viewBoxMatch[3]);
                const h = parseFloat(viewBoxMatch[4]);
                if (w > 0 && h > 0) aspect = w / h;
            }
            const HEIGHT = 2.0;
            const WIDTH = HEIGHT * aspect;
            const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
            const material = new THREE.MeshBasicMaterial({ map: textures[i], transparent: true });
            const plane = new THREE.Mesh(geometry, material);
            const z = -(i * zSpacing);
            plane.position.set(0, 0, z);
            scene.add(plane);
            addBorder(plane, WIDTH, HEIGHT);
        }
        // Position SVG (index 0) at the front (z=0)
        let aspect = 1;
        const svg = svgStrings[0];
        const viewBoxMatch = svg.match(/viewBox=["'](\d+)[ ,]+(\d+)[ ,]+(\d+)[ ,]+(\d+)["']/);
        if (viewBoxMatch) {
            const w = parseFloat(viewBoxMatch[3]);
            const h = parseFloat(viewBoxMatch[4]);
            if (w > 0 && h > 0) aspect = w / h;
        }
        const HEIGHT = 2.0;
        const WIDTH = HEIGHT * aspect;
        const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
        const material = new THREE.MeshBasicMaterial({ map: textures[0], transparent: true });
        const plane = new THREE.Mesh(geometry, material);
        plane.position.set(0, 0, 0);
        scene.add(plane);
        addBorder(plane, WIDTH, HEIGHT);
    });

    // Animate
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}
}

/**
 * Load SVG file as text
 */
async function loadSVG(filename) {
    const response = await fetch(`digits/${filename}`);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    return await response.text();
}

/**
 * Render position as colored SVG digit
 */
async function renderPositionAsDigits(position) {
    if (position > 3) return '';
    const svg = await loadSVG(`${position}.svg`);
    const coloredSVG = svg.replace(/fill="#484848"/g, 'fill="#ff6b6b"');
    return `<div class="position-svg">${coloredSVG}</div>`;
}

/**
 * Create colored SVG for race points
 */
async function renderRaceGrid(points, position) {
    if (position > 3) return '';
    let svg = await loadSVG(`${position}.svg`);
    // Randomly select which circles are colored for points
    // Find all <circle ... fill="#484848" ... />
    const circleRegex = /<circle([^>]*)fill="#484848"([^>]*)\/>/g;
    const circles = [];
    let match;
    while ((match = circleRegex.exec(svg)) !== null) {
        circles.push({ full: match[0], pre: match[1], post: match[2], index: match.index });
    }
    // Randomly pick 'points' indices to color
    const indices = Array.from({length: circles.length}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const coloredSet = new Set(indices.slice(0, points));
    // Replace circles in SVG
    let replaced = 0;
    svg = svg.replace(circleRegex, (full, pre, post, offset) => {
        if (coloredSet.has(replaced)) {
            replaced++;
            return `<circle${pre}fill="#00ff9f"${post}/>`;
        } else {
            replaced++;
            return `<circle${pre}fill="#484848"${post}/>`;
        }
    });
    return `<div class="race-svg">${svg}</div>`;
}

/**
 * Render points as a series of dots, 1 per point
 */
function renderPointsDots(points) {
    const count = Math.max(0, Math.floor(points));
    if (count === 0) {
        return '<span class="point-dot empty"></span>';
    }
    const maxDots = 25;
    const dots = Array.from({ length: Math.min(count, maxDots) }, () => '<span class="point-dot"></span>').join('');
    const suffix = count > maxDots ? ` <span class="point-more">+${count - maxDots}</span>` : '';
    return dots + suffix;
}

/**
 * Setup UI event listeners
 */
function setupUIEvents() {
    // Drivers are now clickable buttons
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
    try {
        updateStatus('Loading drivers...');
        await fetchStandings();
        populateDriverSelect();
        setupUIEvents();
    } catch (error) {
        console.error('Initialization error:', error);
        updateStatus('Error initializing app');
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
