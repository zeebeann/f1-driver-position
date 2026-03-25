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
        detailsContent.innerHTML = '<canvas id="threeCanvas" width="600" height="600" style="display:block;margin:auto;"></canvas>';

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
    camera.position.set(0, 0, 5);

    // OrbitControls for mouse rotation
    const OrbitControlsGlobal = window.OrbitControls || (window.THREE && window.THREE.OrbitControls);
    if (!OrbitControlsGlobal) {
        updateStatus('OrbitControls is not loaded.');
        throw new Error('OrbitControls is not loaded.');
    }
    const controls = new OrbitControlsGlobal(camera, renderer.domElement);
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

    // Layer all SVGs as same-size planes at z=0
    Promise.all(svgStrings.map(svg => loadTexture(svg))).then(textures => {
        textures.forEach((texture) => {
            const geometry = new THREE.PlaneGeometry(2, 2); // all same size
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(0, 0, 0); // all at z=0
            scene.add(plane);
        });
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
    const svg = await loadSVG(`${position}.svg`);
    let count = 0;
    const coloredSVG = svg.replace(/fill="#484848"/g, (match) => {
        if (count < points) {
            count++;
            return 'fill="#00ff9f"'; // green for points
        } else {
            return match;
        }
    });
    return `<div class="race-svg">${coloredSVG}</div>`;
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
