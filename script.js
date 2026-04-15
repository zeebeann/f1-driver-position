// ============================================================================
// F1 Driver Position App
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const API_BASE = 'https://f1api.dev/api';
const SEASON = 2026;
const MAX_ROUNDS = 24;

const svgCache = new Map();
const raceRoundCache = new Map();

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
    'colapinto':  '#9fc4e8',
    'hulkenberg': '#6b0000',
    'bortoleto':  '#6b0000',
    'sainz':      '#005aff',
    'albon':      '#005aff',
    'bottas':     '#c8a951',
    'valtteri bottas': '#c8a951',
    'perez':      '#c8a951',
    'pérez':      '#c8a951',
    'sergio perez': '#c8a951',
    'stroll':     '#006f3c',
    'alonso':     '#006f3c',
};

function getDriverColor(driver) {
    const surname = (driver.driver.surname || '').toLowerCase();
    return DRIVER_COLORS[surname] || '#00ff9f';
}

let drivers = [];
let selectedDriverId = null;
let driverListMode = 'championship';

const DRIVER_TEAM_BY_SURNAME = {
    'verstappen': 'Red Bull',
    'hadjar': 'Red Bull',
    'russell': 'Mercedes',
    'antonelli': 'Mercedes',
    'kimi antonelli': 'Mercedes',
    'andrea antonelli': 'Mercedes',
    'kimi': 'Mercedes',
    'leclerc': 'Ferrari',
    'hamilton': 'Ferrari',
    'norris': 'McLaren',
    'piastri': 'McLaren',
    'ocon': 'Haas',
    'bearman': 'Haas',
    'lawson': 'Racing Bulls',
    'lindblad': 'Racing Bulls',
    'gasly': 'Alpine',
    'collapinto': 'Alpine',
    'colapinto': 'Alpine',
    'hulkenberg': 'Sauber',
    'bortoleto': 'Sauber',
    'sainz': 'Williams',
    'albon': 'Williams',
    'bottas': 'Cadillac',
    'valtteri bottas': 'Cadillac',
    'perez': 'Cadillac',
    'pérez': 'Cadillac',
    'sergio perez': 'Cadillac',
    'stroll': 'Aston Martin',
    'alonso': 'Aston Martin',
};

const TEAM_DISPLAY_ORDER = [
    'Red Bull',
    'Mercedes',
    'Ferrari',
    'McLaren',
    'Haas',
    'Racing Bulls',
    'Alpine',
    'Sauber',
    'Williams',
    'Cadillac',
    'Aston Martin',
];

function getDriverTeamName(driver) {
    const surname = (driver.driver.surname || '').toLowerCase();
    return DRIVER_TEAM_BY_SURNAME[surname] || 'Other';
}

function applySelectedButtonStyle(driverBtn, driverColor) {
    driverBtn.classList.add('selected');
    driverBtn.style.background = driverColor;
    driverBtn.style.borderColor = driverColor;
    driverBtn.style.color = '#fff';
}

function clearSelectedButtonStyle(driverBtn) {
    driverBtn.classList.remove('selected');
    driverBtn.style.background = '';
    driverBtn.style.borderColor = '';
    driverBtn.style.color = '';
}

function hexToRgba(hex, alpha) {
    const clean = (hex || '').replace('#', '');
    const normalized = clean.length === 3
        ? clean.split('').map((c) => c + c).join('')
        : clean;
    const num = parseInt(normalized, 16);
    if (Number.isNaN(num)) return `rgba(0, 0, 0, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyHoverButtonStyle(driverBtn, driverColor) {
    if (driverBtn.classList.contains('selected')) return;
    driverBtn.style.background = hexToRgba(driverColor, 0.18);
    driverBtn.style.borderColor = driverColor;
}

function clearHoverButtonStyle(driverBtn) {
    if (driverBtn.classList.contains('selected')) return;
    driverBtn.style.background = '';
    driverBtn.style.borderColor = '';
}

function updateListModeButtons() {
    const championshipBtn = document.getElementById('modeChampionship');
    const teamsBtn = document.getElementById('modeTeams');
    if (!championshipBtn || !teamsBtn) return;
    championshipBtn.classList.toggle('active', driverListMode === 'championship');
    teamsBtn.classList.toggle('active', driverListMode === 'teams');
}

function createDriverButton(driver) {
    const driverBtn = document.createElement('button');
    const driverColor = getDriverColor(driver);
    driverBtn.className = 'driver-btn';
    driverBtn.dataset.driverId = driver.driverId;
    driverBtn.textContent = `${driver.driver.name} ${driver.driver.surname}`;
    if (String(selectedDriverId) === String(driver.driverId)) {
        applySelectedButtonStyle(driverBtn, driverColor);
    }
    driverBtn.addEventListener('mouseenter', () => applyHoverButtonStyle(driverBtn, driverColor));
    driverBtn.addEventListener('mouseleave', () => clearHoverButtonStyle(driverBtn));
    driverBtn.addEventListener('click', () => selectDriver(driver.driverId));
    return driverBtn;
}

function renderChampionshipDriverList(list) {
    drivers.forEach((driver) => {
        list.appendChild(createDriverButton(driver));
    });
}

function renderTeamsDriverList(list) {
    const grouped = new Map();
    drivers.forEach((driver) => {
        const team = getDriverTeamName(driver);
        if (!grouped.has(team)) grouped.set(team, []);
        grouped.get(team).push(driver);
    });

    const orderedTeams = [
        ...TEAM_DISPLAY_ORDER.filter((team) => grouped.has(team)),
        ...Array.from(grouped.keys()).filter((team) => !TEAM_DISPLAY_ORDER.includes(team)).sort(),
    ];

    orderedTeams.forEach((team) => {
        const teamHeader = document.createElement('div');
        teamHeader.className = 'team-header';
        teamHeader.textContent = team;
        list.appendChild(teamHeader);

        grouped.get(team).forEach((driver) => {
            list.appendChild(createDriverButton(driver));
        });
    });
}

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
    const roundResults = await Promise.all(
        Array.from({ length: MAX_ROUNDS }, (_, index) => fetchRaceRound(index + 1))
    );

    const racePoints = roundResults
        .filter((race) => race && Array.isArray(race.results))
        .map((race) => {
            const driverResult = race.results.find((result) => result.driver && result.driver.driverId === driverId);
            if (driverResult) {
                return {
                    round: race.round,
                    raceName: race.raceName,
                    points: Number(driverResult.points || 0),
                    position: driverResult.position || '-'
                };
            }

            return {
                round: race.round,
                raceName: race.raceName,
                points: 0,
                position: 'DNS'
            };
        });

    console.log(`Fetched ${racePoints.length} races for driver ${driverId}`, racePoints);
    return racePoints;
}

function fetchRaceRound(round) {
    if (raceRoundCache.has(round)) {
        return raceRoundCache.get(round);
    }

    const request = fetch(`${API_BASE}/${SEASON}/${round}/race`)
        .then(async (response) => {
            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const racesData = data.races;
            if (!racesData || !Array.isArray(racesData.results)) {
                return null;
            }

            return {
                round,
                raceName: racesData.raceName || `Round ${round}`,
                results: racesData.results
            };
        })
        .catch((error) => {
            console.warn(`Cannot fetch round ${round}:`, error);
            raceRoundCache.delete(round);
            return null;
        });

    raceRoundCache.set(round, request);
    return request;
}

function prefetchSeasonRaceData() {
    Promise.all(
        Array.from({ length: MAX_ROUNDS }, (_, index) => fetchRaceRound(index + 1))
    ).catch((error) => {
        console.warn('Background race prefetch failed:', error);
    });
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

    updateListModeButtons();
    if (driverListMode === 'teams') {
        renderTeamsDriverList(list);
    } else {
        renderChampionshipDriverList(list);
    }
}

function setupDriverListModeSwitcher() {
    const championshipBtn = document.getElementById('modeChampionship');
    const teamsBtn = document.getElementById('modeTeams');
    if (!championshipBtn || !teamsBtn) return;

    championshipBtn.addEventListener('click', () => {
        driverListMode = 'championship';
        populateDriverSelect();
    });

    teamsBtn.addEventListener('click', () => {
        driverListMode = 'teams';
        populateDriverSelect();
    });

    updateListModeButtons();
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
        selectedDriverId = driverId;
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

        const detailsContent = document.getElementById('detailsContent');
        detailsContent.classList.add('active');
        detailsContent.innerHTML = `<div id=\"detailsTitle\">${driver.driver.name} ${driver.driver.surname}</div><div id=\"stackDepthControl\"><label for=\"stackOffsetInput\">Depth</label><input id=\"stackOffsetInput\" type=\"range\" min=\"-3\" max=\"3\" step=\"0.01\" value=\"0\" /><span id=\"stackOffsetValue\">0.00</span></div><div id=\"sceneShell\"><canvas id=\"threeCanvas\" width=\"900\" height=\"800\" style=\"display:block;margin:auto;\"></canvas><div id=\"sceneLoading\">Loading driver position...</div></div><div id=\"svgTooltip\" class=\"tooltip-card\"></div>`;

        updateStatus(`Loading race data for ${driver.driver.name} ${driver.driver.surname}...`);
        const racePoints = await fetchDriverRacePoints(driverId);

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
            {
                label: 'Championship Position',
                value: `P${driver.position}`,
                totalPoints: driver.points
            },
            ...racePoints.map(race => ({
                label: race.raceName,
                round: race.round,
                racePosition: race.position,
                points: race.points
            }))
        ];

        try {
            await initThreeJS(allSvgs, metadata);
        } catch (error) {
            console.error('Error initializing 3D scene:', error);
        } finally {
            const sceneLoading = document.getElementById('sceneLoading');
            if (sceneLoading) sceneLoading.style.display = 'none';
        }

        updateStatus(`${driver.driver.name} ${driver.driver.surname} - Races: ${racePoints.length}`);
        console.log('Driver info:', {
            name: `${driver.driver.name} ${driver.driver.surname}`,
            position: driver.position,
            totalPoints: driver.points,
            races: racePoints
        });
    }
// --- 3D SVG Layering with OrbitControls ---
async function initThreeJS(svgStrings, metadata = []) {
    const canvas = document.getElementById('threeCanvas');
    const stackOffsetInput = document.getElementById('stackOffsetInput');
    const stackOffsetValue = document.getElementById('stackOffsetValue');
    const scene = new THREE.Scene();
    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setClearColor(0x000000, 0);
    camera.position.set(0, 0, 2.5); // move camera closer for more zoom

    // OrbitControls for mouse rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.zoomSpeed = 1.8;
    controls.enablePan = false;

    // Helper to load SVG as texture
    const loadTexture = (svgString) => {
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(dataUrl, resolve, undefined, reject);
        });
    };

    // Layer all SVGs as planes, separated along z, and fix aspect ratio
    const textures = await Promise.all(svgStrings.map(svg => loadTexture(svg)));
        const numPlanes = textures.length;
        const zSpacing = 0.45;
        const tooltip = document.getElementById('svgTooltip');

        function createLabelTexture(text, inverted = false) {
            const textureCanvas = document.createElement('canvas');
            const ctx = textureCanvas.getContext('2d');
            const fontSize = 36;
            const fontFamily = 'Titillium Web, sans-serif';
            ctx.font = `700 ${fontSize}px ${fontFamily}`;
            const textMetrics = ctx.measureText(text);
            const paddingX = 22;
            const paddingY = 12;
            const w = Math.ceil(textMetrics.width + paddingX * 2);
            const h = Math.ceil(fontSize + paddingY * 2);
            textureCanvas.width = w;
            textureCanvas.height = h;

            const drawCtx = textureCanvas.getContext('2d');
            drawCtx.fillStyle = inverted ? '#000000' : '#ffffff';
            drawCtx.fillRect(0, 0, w, h);
            drawCtx.strokeStyle = inverted ? '#ffffff' : '#000000';
            drawCtx.lineWidth = 3;
            drawCtx.strokeRect(1.5, 1.5, w - 3, h - 3);
            drawCtx.fillStyle = inverted ? '#ffffff' : '#000000';
            drawCtx.font = `700 ${fontSize}px ${fontFamily}`;
            drawCtx.textAlign = 'center';
            drawCtx.textBaseline = 'middle';
            drawCtx.fillText(text, w / 2, h / 2 + 1);

            const texture = new THREE.CanvasTexture(textureCanvas);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            return { texture, width: w, height: h };
        }

        function tooltipHtml(data) {
            if (!data) return '';
            if (data.round !== undefined) {
                return `<div class="tooltip-title">Round ${data.round}</div><div class="tooltip-subtitle">${data.label}</div><div class="tooltip-row"><span>Finish</span><strong>P${data.racePosition}</strong></div><div class="tooltip-row"><span>Points</span><strong>${data.points}</strong></div>`;
            }
            if (data.totalPoints !== undefined) {
                return `<div class="tooltip-title">${data.label}: ${data.value}</div><div class="tooltip-row"><span>Total Points</span><strong>${data.totalPoints}</strong></div>`;
            }
            return `<div class="tooltip-title">${data.label}: ${data.value}</div>`;
        }

        function showTooltipAtPointer(e, data) {
            if (!tooltip || !data) return;
            tooltip.innerHTML = tooltipHtml(data);
            tooltip.classList.add('visible');
            tooltip.style.left = '0px';
            tooltip.style.top = '0px';

            const tw = tooltip.offsetWidth;
            const th = tooltip.offsetHeight;
            const tx = (e.clientX + 10 + tw + 24 > window.innerWidth)
                ? e.clientX - tw - 10
                : e.clientX + 10;
            const ty = Math.min(Math.max(10, e.clientY + 10), window.innerHeight - th - 10);
            tooltip.style.left = tx + 'px';
            tooltip.style.top = ty + 'px';
        }

        function hideTooltip() {
            if (!tooltip) return;
            tooltip.classList.remove('visible');
        }

        // Helper to add a thin border outline to a plane
        function addBorder(plane, width, height) {
            const edgeGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width + 0.80, height + 0.40));
            const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
            const border = new THREE.LineSegments(edgeGeom, edgeMat);
            border.position.copy(plane.position);
            border.position.z += 0.001; // just in front to avoid z-fighting
            return border;
        }
        const hoverableTabs = [];
        const layerEntries = [];
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
            plane.position.set(0, 0, 0);
            plane.userData.tooltipData = metadata[index] || null;

            const border = addBorder(plane, WIDTH, HEIGHT);

            const tabText = index === 0
                ? 'CH'
                : `R${metadata[index]?.round ?? index}`;
            // Start dark and animate to light on hover (reversed from previous behavior).
            const labelTextureData = createLabelTexture(tabText, true);
            const labelTextureDataInverted = createLabelTexture(tabText, false);
            const tabH = 0.17;
            const tabW = tabH * (labelTextureData.width / labelTextureData.height);
            const tabGeom = new THREE.PlaneGeometry(tabW, tabH);
            const tabMat = new THREE.MeshBasicMaterial({
                map: labelTextureData.texture,
                transparent: true,
                opacity: 1
            });
            const tabMatInverted = new THREE.MeshBasicMaterial({
                map: labelTextureDataInverted.texture,
                transparent: true,
                opacity: 0
            });
            const tab = new THREE.Mesh(tabGeom, tabMat);
            const tabInverted = new THREE.Mesh(tabGeom, tabMatInverted);

            // Place tab so its bottom edge touches border top, aligned to the full left border edge.
            const borderTopY = (HEIGHT + 0.40) / 2;
            const borderLeftX = -((WIDTH + 0.80) / 2);
            const tabX = borderLeftX + (tabW / 2);
            const tabY = borderTopY + (tabH / 2);
            tab.position.set(tabX, tabY, 0.01);
            tabInverted.position.set(tabX, tabY, 0.011);
            tab.userData.tooltipData = metadata[index] || null;

            const layerGroup = new THREE.Group();
            layerGroup.position.set(0, 0, z);
            layerGroup.add(plane);
            layerGroup.add(border);
            layerGroup.add(tab);
            layerGroup.add(tabInverted);
            modelRoot.add(layerGroup);

            const layerEntry = {
                group: layerGroup,
                plane,
                tab,
                tabInverted,
                tabMat,
                tabMatInverted,
                hoverZone: null,
                hoverProgress: 0,
                isHovered: false
            };
            tab.userData.layerEntry = layerEntry;
            tabInverted.userData.layerEntry = layerEntry;
            tab.userData.tooltipData = metadata[index] || null;
            tabInverted.userData.tooltipData = metadata[index] || null;

            // Static oversized hover zone: keeps hover stable while the visual layer animates upward.
            const hoverZoneGeom = new THREE.PlaneGeometry(tabW + 0.24, tabH + 0.34);
            const hoverZoneMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: false,
                side: THREE.DoubleSide
            });
            const hoverZone = new THREE.Mesh(hoverZoneGeom, hoverZoneMat);
            hoverZone.position.set(tabX, tabY + 0.11, z + 0.02);
            hoverZone.userData.layerEntry = layerEntry;
            hoverZone.userData.tooltipData = metadata[index] || null;
            modelRoot.add(hoverZone);
            layerEntry.hoverZone = hoverZone;

            layerEntries.push(layerEntry);
            hoverableTabs.push(hoverZone);
        }
        // Races: index 1..N (behind)
        for (let i = 1; i < numPlanes; i++) {
            makePlane(i, -(i * zSpacing));
        }
        // Position SVG (index 0) at the front
        makePlane(0, 0);

        let stackOffset = 0;
        const setStackOffset = (value) => {
            const clamped = Math.max(-3, Math.min(3, value));
            stackOffset = clamped;
            modelRoot.position.z = clamped;
            if (stackOffsetValue) stackOffsetValue.textContent = clamped.toFixed(2);
        };

        if (stackOffsetInput) {
            stackOffsetInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!Number.isNaN(value)) setStackOffset(value);
            });
            setStackOffset(parseFloat(stackOffsetInput.value || '0'));
        }

        // Shift + wheel nudges the full stack forward/backward.
        canvas.addEventListener('wheel', (e) => {
            if (!e.shiftKey) return;
            e.preventDefault();
            setStackOffset(stackOffset + (-e.deltaY * 0.0025));
            if (stackOffsetInput) {
                stackOffsetInput.value = stackOffset.toFixed(2);
            }
        }, { passive: false });

        // Hover tooltip only on 3D tabs (not on overlapped SVG planes)
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let activeLayer = null;
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(hoverableTabs);
            if (hits.length > 0) {
                const hitObj = hits[0].object;
                const data = hitObj.userData.tooltipData;
                activeLayer = hitObj.userData.layerEntry || null;
                for (const entry of layerEntries) {
                    entry.isHovered = entry === activeLayer;
                }
                if (data) showTooltipAtPointer(e, data);
            } else {
                activeLayer = null;
                for (const entry of layerEntries) {
                    entry.isHovered = false;
                }
                hideTooltip();
            }
        });
        canvas.addEventListener('mouseleave', () => {
            activeLayer = null;
            for (const entry of layerEntries) {
                entry.isHovered = false;
            }
            hideTooltip();
        });

    // Animate
    function animate() {
        requestAnimationFrame(animate);
        for (const entry of layerEntries) {
            const target = entry.isHovered ? 1 : 0;
            entry.hoverProgress += (target - entry.hoverProgress) * 0.16;

            // Animation 1: invert tab colors by cross-fading dark -> light on hover.
            entry.tabMat.opacity = 1 - entry.hoverProgress;
            entry.tabMatInverted.opacity = entry.hoverProgress;

            // Animation 2: pull the entire layer upward like a page being lifted.
            entry.group.position.y = 0.22 * entry.hoverProgress;
        }
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
    if (svgCache.has(filename)) {
        return svgCache.get(filename);
    }

    const request = fetch(`digits/${filename}`)
        .then(async (response) => {
            if (!response.ok) throw new Error(`Failed to load ${filename}`);
            return response.text();
        })
        .catch((error) => {
            svgCache.delete(filename);
            throw error;
        });

    svgCache.set(filename, request);
    return request;
}

/**
 * Render position as colored SVG digit
 */
async function renderPositionAsDigits(position, color = '#ff6b6b') {
    const numericPosition = Number(position);
    if (!Number.isFinite(numericPosition) || numericPosition < 1 || numericPosition > 22) return '';
    const svg = await loadSVG(`${numericPosition}.svg`);
    // Use driver color at 50% opacity
    const coloredSVG = svg.replace(/<circle([^>]*)fill="#484848"([^>]*)\/>/g,
        (_, pre, post) => `<circle${pre}fill="${color}" fill-opacity="0.5"${post}/>`);
    return `<div class="position-svg">${coloredSVG}</div>`;
}

/**
 * Create colored SVG for race points
 */
async function renderRaceGrid(points, position, color = '#00ff9f') {
    const numericPosition = Number(position);
    if (!Number.isFinite(numericPosition) || numericPosition < 1 || numericPosition > 22) return '';
    let svg = await loadSVG(`${numericPosition}.svg`);
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
            return `<circle${shrunk}fill="#ececec"/>`;
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
    // UI events setup (legend panel is static)
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize() {
    try {
        updateStatus('Loading drivers...');
        await fetchStandings();
        prefetchSeasonRaceData();
        setupDriverListModeSwitcher();
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
