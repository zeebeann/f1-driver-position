// ============================================================================
// F1 Driver Position App
// ============================================================================

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
        
        // Build the details panel
        const detailsContent = document.getElementById('detailsContent');
        const raceGrids = await Promise.all(racePoints.map(async (race, index) => {
            const grid = await renderRaceGrid(race.points, driver.position);
            return `<div class="race-grid" style="z-index: ${index + 1};">${grid}</div>`;
        }));
        const positionGrid = await renderPositionAsDigits(driver.position);
        const raceItems = await Promise.all(racePoints.map(async (race) => {
            const svg = await renderRaceGrid(race.points, driver.position);
            return `
            <div class="race-item">
                ${svg}
                <div>Position: ${race.position}</div>
                <div class="race-points">Points: ${renderPointsDots(race.points)} (${race.points})</div>
            </div>
            `;
        }));
        detailsContent.innerHTML = `
            <div class="grid-container">
                ${raceGrids.join('')}
                <div class="position-grid" style="z-index: ${racePoints.length + 1};">${positionGrid}</div>
            </div>
            
            <div class="races-list">
                <div class="races-title">Race Results (${racePoints.length} races)</div>
                ${raceItems.join('')}
            </div>
        `;
        
        detailsContent.classList.add('active');
        updateStatus(`${driver.driver.name} ${driver.driver.surname} - Races: ${racePoints.length}`);
        
        console.log('Driver info:', {
            name: `${driver.driver.name} ${driver.driver.surname}`,
            position: driver.position,
            totalPoints: driver.points,
            races: racePoints
        });
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
