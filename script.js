// ============================================================================
// F1 Driver Position App
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const API_BASE = 'https://f1api.dev/api';
const SEASON = 2026;

const DRIVER_COLORS = {
    'russell':          '#00d2be',
    'antonelli':        '#00d2be',
    'kimi antonelli':   '#00d2be',
    'andrea antonelli': '#00d2be',
    'kimi':             '#00d2be',
    'leclerc':    '#e8002d',
    'hamilton':   '#e8002d',
    'norris':     '#ff8000',
    'piastri':    '#ff8000',
    'ocon':       '#ff6b6b',
    'bearman':    '#ff6b6b',
    'verstappen': '#1e1e7e',
    'hadjar':     '#1e1e7e',
    'lawson':     '#4d7cff',
    'lindblad':   '#4d7cff',
    'gasly':      '#9fc4e8',
    'collapinto': '#9fc4e8',
    'hulkenberg': '#6b0000',
    'bortoleto':  '#6b0000',
    'sainz':      '#005aff',
    'albon':      '#005aff',
    'bottas':     '#c8a951',
    'perez':      '#c8a951',
    'stroll':     '#006f3c',
    'alonso':     '#006f3c',
};

function getDriverColor(driver) {
    const surname = (driver.driver.surname || '').toLowerCase();
    return DRIVER_COLORS[surname] || '#00ff9f';
}

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
}

/**
 * Update UI status message
 */
function updateStatus(message) {
    // no-op: status removed
}

/**
 * Select a driver and fetch their race data
 */
async function selectDriver(driverId) {
    const driver = drivers.find(d => d.driverId === driverId);
    
    if (driver) {
        const driverColor = getDriverColor(driver);

        // Highlight selected button
        document.querySelectorAll('.driver-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.style.background = '';
            btn.style.borderColor = '';
            btn.style.color = '';
        });
        const selectedBtn = document.querySelector(`.driver-btn[data-driver-id="${driverId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
            selectedBtn.style.background = driverColor;
            selectedBtn.style.borderColor = driverColor;
            selectedBtn.style.color = '#fff';
        }

        updateStatus(`Loading race data for ${driver.driver.name} ${driver.driver.surname}...`);
        const racePoints = await fetchDriverRacePoints(driverId);
        const detailsContent = document.getElementById('detailsContent');
        detailsContent.innerHTML = `<div id="detailsTitle">${driver.driver.name} ${driver.driver.surname}</div><canvas id="threeCanvas" width="900" height="800" style="display:block;margin:auto;"></canvas><div id="svgTooltip" style="position:fixed;display:none;background:#fff;color:#000;border:1px solid #000;padding:6px 10px;font-size:12px;font-family:monospace;pointer-events:none;z-index:100;"></div>`;

        // Prepare SVGs for 3D layering
        const positionGrid = await renderPositionAsDigits(driver.position, driverColor);
        const raceGrids = await Promise.all(racePoints.map(async (race) => {
            return await renderRaceGrid(race.points, driver.position, driverColor);
        }));
        // Extract SVG markup only
        const extractSVG = html => {
            const match = html.match(/<svg[\s\S]*?<\/svg>/);
            return match ? match[0] : '';
        };
        const allSvgs = [extractSVG(positionGrid), ...raceGrids.map(extractSVG)];
        const metadata = [
            { label: 'Championship Position', value: `P${driver.position}` },
            ...racePoints.map(race => ({
                label: race.raceName,
                round: race.round,
                racePosition: race.position,
                points: race.points
            }))
        ];
        initThreeJS(allSvgs, metadata);

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
function initThreeJS(svgStrings, metadata = []) {
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
        const zSpacing = 0.45;
        // Helper to add a thin border outline to a plane
        function addBorder(plane, width, height) {
            const edgeGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width + 0.80, height + 0.40));
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000 });
            const border = new THREE.LineSegments(edgeGeom, edgeMat);
            border.position.copy(plane.position);
            border.position.z += 0.001; // just in front to avoid z-fighting
            scene.add(border);
        }
        const hoverablePlanes = [];
        function makePlane(index, z) {
            let aspect = 1;
            const svg = svgStrings[index];
            const viewBoxMatch = svg.match(/viewBox=["'](\d+)[ ,]+(\d+)[ ,]+(\d+)[ ,]+(\d+)["']/);
            if (viewBoxMatch) {
                const w = parseFloat(viewBoxMatch[3]);
                const h = parseFloat(viewBoxMatch[4]);
                if (w > 0 && h > 0) aspect = w / h;
            }
            const HEIGHT = 2.0;
            const WIDTH = HEIGHT * aspect;
            const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT);
            const material = new THREE.MeshBasicMaterial({ map: textures[index], transparent: true });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(0, 0, z);
            plane.userData.tooltipData = metadata[index] || null;
            scene.add(plane);
            addBorder(plane, WIDTH, HEIGHT);
            hoverablePlanes.push(plane);
        }
        // Races: index 1..N (behind)
        for (let i = 1; i < numPlanes; i++) {
            makePlane(i, -(i * zSpacing));
        }
        // Position SVG (index 0) at the front
        makePlane(0, 0);

        // Tooltip raycasting
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const tooltip = document.getElementById('svgTooltip');
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(hoverablePlanes);
            if (hits.length > 0) {
                const data = hits[0].object.userData.tooltipData;
                if (data) {
                    let html;
                    if (data.round !== undefined) {
                        html = `<strong>Round ${data.round} — ${data.label}</strong><br>Finish: P${data.racePosition} &nbsp;|&nbsp; Points: ${data.points}`;
                    } else {
                        html = `<strong>${data.label}</strong><br>${data.value}`;
                    }
                    tooltip.innerHTML = html;
                    tooltip.style.display = 'block';
                    tooltip.style.left = '0px';
                    tooltip.style.top = '0px';
                    const tw = tooltip.offsetWidth;
                    const th = tooltip.offsetHeight;
                    // Flip to left of cursor if it would overflow the right edge (with 60px early buffer)
                    const tx = (e.clientX + 6 + tw + 60 > window.innerWidth)
                        ? e.clientX - tw - 6
                        : e.clientX + 6;
                    const ty = Math.min(e.clientY + 6, window.innerHeight - th - 8);
                    tooltip.style.left = tx + 'px';
                    tooltip.style.top = ty + 'px';
                } else {
                    tooltip.style.display = 'none';
                }
            } else {
                tooltip.style.display = 'none';
            }
        });
        canvas.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
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
async function renderPositionAsDigits(position, color = '#ff6b6b') {
    if (position > 3) return '';
    const svg = await loadSVG(`${position}.svg`);
    // Use driver color at 50% opacity
    const coloredSVG = svg.replace(/<circle([^>]*)fill="#484848"([^>]*)\/>/g,
        (_, pre, post) => `<circle${pre}fill="${color}" fill-opacity="0.5"${post}/>`);
    return `<div class="position-svg">${coloredSVG}</div>`;
}

/**
 * Create colored SVG for race points
 */
async function renderRaceGrid(points, position, color = '#00ff9f') {
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
            return `<circle${pre}fill="${color}"${post}/>`;
        } else {
            replaced++;
            // Shrink non-coloured circles slightly
            const shrunk = (pre + post).replace(/\br="13"/, 'r="5"');
            return `<circle${shrunk}fill="#484848"/>`;
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
