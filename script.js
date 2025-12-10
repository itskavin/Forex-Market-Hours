const sessions = [
    { id: "sydney", name: "Sydney", timeZone: "Australia/Sydney", startLocal: "08:00", endLocal: "17:00", color: "#3b82f6", flag: "fi fi-au" },
    { id: "tokyo", name: "Tokyo", timeZone: "Asia/Tokyo", startLocal: "09:00", endLocal: "18:00", color: "#8b5cf6", flag: "fi fi-jp" },
    { id: "london", name: "London", timeZone: "Europe/London", startLocal: "08:00", endLocal: "17:00", color: "#3b82f6", flag: "fi fi-gb" },
    { id: "newyork", name: "New York", timeZone: "America/New_York", startLocal: "08:00", endLocal: "17:00", color: "#10b981", flag: "fi fi-us" }
];

let is24Hour = false;
let currentTheme = 'system'; // 'light', 'dark', 'system'
let scrubbedTime = null;
let selectedTimeZone = 'local';

// Initialize
function init() {
    initSettings();
    renderStructure();
    renderTimelineAxis();
    update();
    
    // Loop
    setInterval(() => {
        if (!scrubbedTime) update();
    }, 1000);
    
    // System theme listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (currentTheme === 'system') {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

function initSettings() {
    const savedTheme = localStorage.getItem('theme') || 'system';
    currentTheme = savedTheme;
    updateThemeIcon(currentTheme);
    
    if (currentTheme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(systemDark ? 'dark' : 'light');
    } else {
        applyTheme(currentTheme);
    }

    const savedFormat = localStorage.getItem('format');
    if (savedFormat === '24h') {
        is24Hour = true;
        document.getElementById('format-toggle').textContent = '24H';
    } else {
        document.getElementById('format-toggle').textContent = '12H';
    }

    const savedTimeZone = localStorage.getItem('timezone');
    if (savedTimeZone) {
        selectedTimeZone = savedTimeZone;
        document.getElementById('timezone-select').value = selectedTimeZone;
    }
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    // Simple text indicator for now, or we could swap icons
    // Let's use a title attribute and maybe a small indicator
    let iconHtml = '';
    if (theme === 'light') {
        iconHtml = `<svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    } else if (theme === 'dark') {
        iconHtml = `<svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    } else {
        // System icon (monitor/laptop)
        iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    }
    btn.innerHTML = iconHtml;
    btn.title = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
}

// Event Listeners
document.getElementById('timezone-select').addEventListener('change', (e) => {
    selectedTimeZone = e.target.value;
    localStorage.setItem('timezone', selectedTimeZone);
    update();
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    // Cycle: Light -> Dark -> System -> Light
    if (currentTheme === 'light') currentTheme = 'dark';
    else if (currentTheme === 'dark') currentTheme = 'system';
    else currentTheme = 'light';
    
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon(currentTheme);
    
    if (currentTheme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(systemDark ? 'dark' : 'light');
    } else {
        applyTheme(currentTheme);
    }
});

document.getElementById('format-toggle').addEventListener('click', () => {
    is24Hour = !is24Hour;
    document.getElementById('format-toggle').textContent = is24Hour ? '24H' : '12H';
    localStorage.setItem('format', is24Hour ? '24h' : '12h');
    renderTimelineAxis();
    update();
});

// Scrubbing
const scheduleContainer = document.querySelector('.schedule-container');
const cursorOverlay = document.getElementById('cursor-overlay');

function handleScrub(e) {
    const rect = scheduleContainer.getBoundingClientRect();
    const sidebarWidth = 280; // Must match CSS var
    const trackWidth = rect.width - sidebarWidth;
    
    let clientX = e.clientX;
    if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
    
    let x = clientX - rect.left - sidebarWidth;
    x = Math.max(0, Math.min(x, trackWidth));
    
    const pct = x / trackWidth;
    const totalMinutes = pct * 24 * 60;
    
    const now = new Date();
    
    // Calculate offset
    let strSelected;
    if (selectedTimeZone === 'local') {
        strSelected = now.toLocaleString('en-US');
    } else {
        strSelected = now.toLocaleString('en-US', { timeZone: selectedTimeZone });
    }
    const dateSelected = new Date(strSelected);
    const dateLocal = new Date(now.toLocaleString('en-US'));
    
    const offsetMs = dateSelected.getTime() - dateLocal.getTime();
    
    // Target Local Time = Target Selected Time - Offset
    const targetSelectedDate = new Date(now);
    targetSelectedDate.setHours(0, 0, 0, 0);
    targetSelectedDate.setMinutes(totalMinutes);
    
    const targetLocalMs = targetSelectedDate.getTime() - offsetMs;
    scrubbedTime = new Date(targetLocalMs);
    
    update();
}

function stopScrub() {
    if (scrubbedTime) {
        // scrubbedTime = null; // Keep scrubbed state for inspection
        // update();
    }
}

// Double click to reset
cursorOverlay.addEventListener('dblclick', () => {
    scrubbedTime = null;
    update();
});

cursorOverlay.addEventListener('mousedown', (e) => {
    cursorOverlay.classList.add('scrubbing'); // Add class
    handleScrub(e);
    window.addEventListener('mousemove', handleScrub);
    window.addEventListener('mouseup', stopScrubOnce);
});

cursorOverlay.addEventListener('touchstart', (e) => {
    cursorOverlay.classList.add('scrubbing'); // Add class
    handleScrub(e);
    window.addEventListener('touchmove', handleScrub, { passive: false });
    window.addEventListener('touchend', stopScrubOnce);
}, { passive: false });

function stopScrubOnce() {
    cursorOverlay.classList.remove('scrubbing'); // Remove class
    window.removeEventListener('mousemove', handleScrub);
    window.removeEventListener('mouseup', stopScrubOnce);
    window.removeEventListener('touchmove', handleScrub);
    window.removeEventListener('touchend', stopScrubOnce);
    
    // Reset to current time when interaction ends
    scrubbedTime = null;
    update();
}

// Rendering
function renderStructure() {
    const container = document.getElementById('schedule-rows');
    container.innerHTML = sessions.map(session => `
        <div class="session-row" id="row-${session.id}">
            <div class="session-info">
                <div class="flag-icon"><span class="${session.flag}"></span></div>
                <div class="session-details">
                    <h3>${session.name}</h3>
                    <span class="session-time" id="time-${session.id}">--:--</span>
                    <span class="session-meta" id="meta-${session.id}">--</span>
                </div>
            </div>
            <div class="session-track" id="track-${session.id}">
                <!-- Bars injected here -->
            </div>
        </div>
    `).join('');
}

function renderTimelineAxis() {
    const container = document.getElementById('timeline-axis');
    container.innerHTML = '';
    
    // 24 hours
    for (let i = 0; i <= 24; i++) {
        const label = document.createElement('div');
        label.className = 'axis-label';
        label.style.left = `${(i / 24) * 100}%`;
        
        let text = i;
        let icon = '';
        
        if (!is24Hour) {
            if (i === 0 || i === 24) text = '12';
            else if (i === 12) text = '12';
            else text = i > 12 ? i - 12 : i;
        }
        
        // Add Sun/Moon icons
        if (i === 6) icon = '<span class="axis-icon">☀️</span>'; // Sunrise approx
        if (i === 12) icon = '<span class="axis-icon">☀️</span>'; // Noon
        if (i === 18) icon = '<span class="axis-icon">🌙</span>'; // Sunset approx
        if (i === 0 || i === 24) icon = '<span class="axis-icon">🌙</span>'; // Midnight
        
        // Icon first, then text (so icon is above text in column layout)
        label.innerHTML = `${icon}<span class="axis-time">${text}</span>`;
        container.appendChild(label);
    }
}

function updateDashboard(now) {
    // 1. Market Status (Open/Closed)
    // Check if ANY major session is open
    let openSessions = [];
    sessions.forEach(s => {
        if (checkSessionOpen(now, s)) openSessions.push(s.name);
    });
    
    const statusEl = document.getElementById('market-state');
    if (statusEl) {
        if (openSessions.length > 0) {
            statusEl.textContent = `Open (${openSessions.join(', ')})`;
            statusEl.style.color = 'var(--success-color)';
        } else {
            statusEl.textContent = 'Closed';
            statusEl.style.color = 'var(--text-muted)';
        }
    }

    // 2. Active Killzone / Overlap
    // Define Killzones (approximate for display)
    // London Open: 07:00 - 10:00 London
    // NY Open: 07:00 - 10:00 NY
    // London Close: 15:00 - 17:00 London
    
    let activeKillzones = [];
    
    // Helper to check time range in specific zone
    const checkTime = (zone, startH, endH) => {
        const timeStr = now.toLocaleTimeString('en-US', { timeZone: zone, hour12: false, hour: '2-digit', minute: '2-digit' });
        const [h, m] = timeStr.split(':').map(Number);
        const mins = h * 60 + m;
        const start = startH * 60;
        const end = endH * 60;
        return mins >= start && mins < end;
    };

    if (checkTime('Europe/London', 7, 10)) activeKillzones.push("London Open");
    if (checkTime('America/New_York', 7, 10)) activeKillzones.push("NY Open");
    if (checkTime('Europe/London', 15, 17)) activeKillzones.push("London Close");
    
    // Check Overlaps
    const isLondonOpen = checkSessionOpen(now, sessions.find(s => s.id === 'london'));
    const isNYOpen = checkSessionOpen(now, sessions.find(s => s.id === 'newyork'));
    const isTokyoOpen = checkSessionOpen(now, sessions.find(s => s.id === 'tokyo'));
    
    if (isLondonOpen && isNYOpen) activeKillzones.push("London/NY Overlap");
    if (isLondonOpen && isTokyoOpen) activeKillzones.push("London/Tokyo Overlap");

    const kzEl = document.getElementById('active-killzone');
    if (kzEl) {
        if (activeKillzones.length > 0) {
            kzEl.textContent = activeKillzones[0]; // Show primary
            kzEl.style.color = '#ef4444'; // Red for killzone
        } else {
            kzEl.textContent = 'None';
            kzEl.style.color = 'var(--text-muted)';
        }
    }

    // 3. Next Event
    // Find the next Open or Close event
    let minDiff = Infinity;
    let nextEventText = '--';
    
    sessions.forEach(s => {
        // Get current time in session zone
        const timeStr = now.toLocaleTimeString('en-US', { timeZone: s.timeZone, hour12: false, hour: '2-digit', minute: '2-digit' });
        const [h, m] = timeStr.split(':').map(Number);
        const currMins = h * 60 + m;
        
        const [startH, startM] = s.startLocal.split(':').map(Number);
        const startMins = startH * 60 + startM;
        
        const [endH, endM] = s.endLocal.split(':').map(Number);
        const endMins = endH * 60 + endM;
        
        // Calc time to Open
        let diffOpen = startMins - currMins;
        if (diffOpen < 0) diffOpen += 24 * 60;
        
        if (diffOpen < minDiff) {
            minDiff = diffOpen;
            nextEventText = `${s.name} Opens`;
        }
        
        // Calc time to Close
        let diffClose = endMins - currMins;
        if (diffClose < 0) diffClose += 24 * 60;
        
        if (diffClose < minDiff) {
            minDiff = diffClose;
            nextEventText = `${s.name} Closes`;
        }
    });
    
    const hrs = Math.floor(minDiff / 60);
    const mins = minDiff % 60;
    const nextEventEl = document.getElementById('next-event');
    if (nextEventEl) {
        nextEventEl.textContent = `${nextEventText} in ${hrs}h ${mins}m`;
    }
}

function update() {
    const realNow = new Date();
    const displayTime = scrubbedTime || realNow;
    
    // 1. Update Header Info
    // Update Timezone Offset Label
    const offsetLabel = document.getElementById('timezone-offset');
    if (offsetLabel) {
        let offsetStr = '';
        if (selectedTimeZone === 'local') {
            const offset = -realNow.getTimezoneOffset();
            const sign = offset >= 0 ? '+' : '-';
            const hours = Math.floor(Math.abs(offset) / 60);
            const mins = Math.abs(offset) % 60;
            offsetStr = `GMT${sign}${hours}:${mins.toString().padStart(2, '0')}`;
        } else {
            // Get offset for specific timezone
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: selectedTimeZone,
                timeZoneName: 'longOffset'
            }).formatToParts(realNow);
            const tzPart = parts.find(p => p.type === 'timeZoneName');
            offsetStr = tzPart ? tzPart.value.replace('GMT', 'GMT') : '';
        }
        offsetLabel.textContent = offsetStr;
    }

    // Update Main Clock - ALWAYS use realNow
    const timeOpts = { hour12: !is24Hour };
    const dateOpts = { weekday: 'short', month: 'short', day: 'numeric' };
    if (selectedTimeZone !== 'local') {
        timeOpts.timeZone = selectedTimeZone;
        dateOpts.timeZone = selectedTimeZone;
    }
    document.getElementById('local-clock').textContent = realNow.toLocaleTimeString('en-US', timeOpts);
    document.getElementById('local-date').textContent = realNow.toLocaleDateString('en-US', dateOpts);

    // 2. Update Rows (Use displayTime/scrubbedTime)
    sessions.forEach(session => {
        const sessionTimeStr = displayTime.toLocaleTimeString('en-US', { 
            timeZone: session.timeZone, 
            hour12: !is24Hour, 
            hour: 'numeric', 
            minute: '2-digit' 
        });
        document.getElementById(`time-${session.id}`).textContent = sessionTimeStr;
        
        const sessionDateStr = displayTime.toLocaleDateString('en-US', {
            timeZone: session.timeZone,
            weekday: 'short', month: 'short', day: 'numeric',
            timeZoneName: 'short'
        });
        document.getElementById(`meta-${session.id}`).textContent = sessionDateStr;
    });

    // 3. Update Timeline Bars
    updateTimelineBars(displayTime);

    // 4. Update Cursor
    updateCursor(displayTime);

    // 5. Update Volume
    updateVolume(displayTime);
    
    // 6. Update Dashboard
    updateDashboard(displayTime);
}

function checkSessionOpen(now, session) {
    const timeInZone24 = now.toLocaleTimeString('en-US', { 
        timeZone: session.timeZone, hour12: false, hour: '2-digit', minute: '2-digit' 
    });
    const [currH, currM] = timeInZone24.split(':').map(Number);
    const currMinutes = currH * 60 + currM;
    const [startH, startM] = session.startLocal.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const [endH, endM] = session.endLocal.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    if (startMinutes < endMinutes) {
        return currMinutes >= startMinutes && currMinutes < endMinutes;
    } else {
        return currMinutes >= startMinutes || currMinutes < endMinutes;
    }
}

function updateTimelineBars(now) {
    let strSelected;
    if (selectedTimeZone === 'local') {
        strSelected = now.toLocaleString('en-US');
    } else {
        strSelected = now.toLocaleString('en-US', { timeZone: selectedTimeZone });
    }
    const dateSelected = new Date(strSelected);
    
    sessions.forEach(session => {
        const track = document.getElementById(`track-${session.id}`);
        track.innerHTML = ''; 

        const strSession = now.toLocaleString('en-US', { timeZone: session.timeZone });
        const dateSession = new Date(strSession);
        
        const diffMs = dateSession.getTime() - dateSelected.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        
        const [startH, startM] = session.startLocal.split(':').map(Number);
        const [endH, endM] = session.endLocal.split(':').map(Number);
        
        const startAbsSession = startH + (startM / 60);
        const endAbsSession = endH + (endM / 60);
        
        let startAbsAxis = startAbsSession - diffHrs;
        let duration = endAbsSession - startAbsSession;
        if (duration < 0) duration += 24;
        
        let endAbsAxis = startAbsAxis + duration;
        
        while (startAbsAxis < 0) startAbsAxis += 24;
        while (startAbsAxis >= 24) startAbsAxis -= 24;
        endAbsAxis = startAbsAxis + duration;
        
        const drawBar = (start, end) => {
            if (start >= 24) return;
            if (end <= 0) return;
            
            const s = Math.max(0, start);
            const e = Math.min(24, end);
            
            const left = (s / 24) * 100;
            const width = ((e - s) / 24) * 100;
            
            const bar = document.createElement('div');
            bar.className = 'timeline-bar';
            bar.style.left = `${left}%`;
            bar.style.width = `${width}%`;
            bar.style.backgroundColor = session.color;
            
            const isOpen = checkSessionOpen(now, session);
            const label = document.createElement('div');
            label.className = 'bar-label';
            label.style.color = session.color;
            label.textContent = `${session.name.toUpperCase()} SESSION ${isOpen ? 'OPEN' : 'CLOSED'}`;
            
            if (width > 5) bar.appendChild(label);
            
            track.appendChild(bar);
        };
        
        drawBar(startAbsAxis, endAbsAxis);
        if (endAbsAxis > 24) {
            drawBar(0, endAbsAxis - 24);
        }
    });
}

function updateCursor(now) {
    let strSelected;
    if (selectedTimeZone === 'local') {
        strSelected = now.toLocaleString('en-US');
    } else {
        strSelected = now.toLocaleString('en-US', { timeZone: selectedTimeZone });
    }
    const dateSelected = new Date(strSelected);
    
    const h = dateSelected.getHours();
    const m = dateSelected.getMinutes();
    const pct = ((h * 60 + m) / (24 * 60)) * 100;
    
    const cursor = document.getElementById('cursor-line');
    cursor.style.left = `${pct}%`;

    // Update Tooltip
    const tooltip = document.getElementById('cursor-tooltip');
    const timeOpts = { hour12: !is24Hour, hour: 'numeric', minute: '2-digit' };
    const dateOpts = { weekday: 'short', month: 'short', day: 'numeric' };
    
    if (selectedTimeZone !== 'local') {
        timeOpts.timeZone = selectedTimeZone;
        dateOpts.timeZone = selectedTimeZone;
    }
    
    const timeStr = now.toLocaleTimeString('en-US', timeOpts);
    const dateStr = now.toLocaleDateString('en-US', dateOpts);
    
    tooltip.innerHTML = `<span class="tooltip-time">${timeStr}</span><span class="tooltip-date">${dateStr}</span>`;
}

// 0-23 UTC Volume Profile (Approximate based on forex market activity)
const volumeProfile = [
    15, 40, 40, 15, 20, 25, 30, 45, // 0-7 (Asian) - Updated 1-3 UTC for Medium volume (6:30-8:30 IST)
    65, 70, 65, 60, 65, 85, 95, 100, // 8-15 (London/NY)
    90, 70, 50, 40, 30, 25, 20, 15  // 16-23 (Close)
];

function getVolumeValue(date) {
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    
    const currentVal = volumeProfile[utcHours];
    const nextVal = volumeProfile[(utcHours + 1) % 24];
    
    // Cosine interpolation for smoother curve
    const mu = utcMinutes / 60;
    const mu2 = (1 - Math.cos(mu * Math.PI)) / 2;
    return (currentVal * (1 - mu2) + nextVal * mu2);
}

function updateVolume(now) {
    let strSelected;
    if (selectedTimeZone === 'local') {
        strSelected = now.toLocaleString('en-US');
    } else {
        strSelected = now.toLocaleString('en-US', { timeZone: selectedTimeZone });
    }
    const dateSelected = new Date(strSelected);
    const dateLocal = new Date(now.toLocaleString('en-US'));
    const offsetMs = dateSelected.getTime() - dateLocal.getTime();
    const offsetHrs = offsetMs / (1000 * 60 * 60);
    
    const points = [];
    const steps = 288; // Higher resolution (every 5 mins) for smoother curve
    
    for (let i = 0; i <= steps; i++) {
        const mins = i * (24 * 60 / steps);
        const sampleDate = new Date(now);
        sampleDate.setHours(0, 0, 0, 0);
        sampleDate.setMinutes(mins - (offsetHrs * 60));
        
        // Get volume from profile
        let y = getVolumeValue(sampleDate);
        
        points.push(y);
    }
    
    // Smooth Curve Generation
    // We need two paths: one for the stroke (line) and one for the fill (area)
    // The stroke path is just the line. The fill path needs to close at the bottom.
    
    let lineD = `M 0 ${100 - points[0]}`;
    
    for (let i = 1; i < points.length; i++) {
        const x = (i / steps) * 100;
        const y = 100 - points[i];
        
        // Cubic Bezier for smoother curves
        const prevX = ((i - 1) / steps) * 100;
        const prevY = 100 - points[i-1];
        
        const cp1x = prevX + (x - prevX) / 3;
        const cp1y = prevY;
        const cp2x = prevX + 2 * (x - prevX) / 3;
        const cp2y = y;
        
        lineD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y}`;
    }
    
    // Fill path is the line path + closing at the bottom
    const fillD = lineD + ` L 100 100 L 0 100 Z`;
    
    const track = document.getElementById('volume-track');
    let svg = track.querySelector('svg');
    
    if (!svg) {
        // Initial Creation
        track.innerHTML = `<svg class="volume-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
                <!-- Vertical Gradient for Stroke: Red -> Yellow -> Green -->
                <linearGradient id="stroke-grad" x1="0" x2="0" y1="1" y2="0">
                    <stop offset="0%" stop-color="#ef4444" /> <!-- Red (Low) -->
                    <stop offset="50%" stop-color="#eab308" /> <!-- Yellow (Medium) -->
                    <stop offset="100%" stop-color="#22c55e" /> <!-- Green (High) -->
                </linearGradient>
                
                <!-- Subtle Gray Gradient for Fill -->
                <linearGradient id="fill-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="rgba(0,0,0,0.05)" />
                    <stop offset="100%" stop-color="rgba(0,0,0,0)" />
                </linearGradient>
            </defs>
            
            <!-- Fill Area -->
            <path id="vol-fill-path" d="${fillD}" fill="url(#fill-grad)" stroke="none" />
            
            <!-- Stroke Line -->
            <path id="vol-stroke-path" d="${lineD}" fill="none" stroke="url(#stroke-grad)" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>`;
    } else {
        // Update existing paths for smooth transition
        const fillPath = document.getElementById('vol-fill-path');
        const strokePath = document.getElementById('vol-stroke-path');
        if (fillPath) fillPath.setAttribute('d', fillD);
        if (strokePath) strokePath.setAttribute('d', lineD);
    }
    
    const currentVol = getVolumeStatus(now);
    
    const badge = document.getElementById('vol-badge');
    if (badge) {
        badge.className = `volume-pill ${currentVol.class}`;
        badge.textContent = currentVol.level;
    }
}

function getVolumeStatus(date) {
    const val = getVolumeValue(date);
    
    if (val >= 80) return { level: 'Very High', class: 'very-high', color: '#ef4444' };
    if (val >= 60) return { level: 'High', class: 'high', color: 'var(--success-color)' };
    if (val >= 30) return { level: 'Medium', class: 'medium', color: 'var(--accent-color)' };
    return { level: 'Low', class: 'low', color: 'var(--text-muted)' };
}

init();