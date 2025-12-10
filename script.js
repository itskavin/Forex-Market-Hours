const sessions = [
    { id: "sydney", name: "Sydney", timeZone: "Australia/Sydney", startLocal: "08:00", endLocal: "17:00", color: "#3b82f6" },
    { id: "tokyo", name: "Tokyo", timeZone: "Asia/Tokyo", startLocal: "09:00", endLocal: "18:00", color: "#8b5cf6" },
    { id: "london", name: "London", timeZone: "Europe/London", startLocal: "08:00", "endLocal": "17:00", color: "#ef4444" },
    { id: "newyork", "name": "New York", "timeZone": "America/New_York", "startLocal": "08:00", "endLocal": "17:00", "color": "#10b981" }
];

let is24Hour = true;
let isDark = false;
let scrubbedTime = null; // If set, use this time instead of real time

// Initialize Settings
function initSettings() {
    // Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        isDark = true;
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        isDark = true;
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Format
    const savedFormat = localStorage.getItem('format');
    if (savedFormat === '12h') {
        is24Hour = false;
        document.getElementById('format-toggle').textContent = '12H';
    }
}

// Event Listeners
document.getElementById('theme-toggle').addEventListener('click', () => {
    isDark = !isDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

document.getElementById('format-toggle').addEventListener('click', () => {
    is24Hour = !is24Hour;
    document.getElementById('format-toggle').textContent = is24Hour ? '24H' : '12H';
    localStorage.setItem('format', is24Hour ? '24h' : '12h');
    renderGrid(); // Re-render to update static times
    renderTimelineAxis(); // Update axis labels
    update();
});

// Scrubbing Logic
const timelineVis = document.getElementById('timeline-vis');

function handleScrub(e) {
    const rect = timelineVis.getBoundingClientRect();
    let clientX = e.clientX;
    
    // Handle touch
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
    }
    
    let x = clientX - rect.left;
    // Clamp
    x = Math.max(0, Math.min(x, rect.width));
    
    const pct = x / rect.width;
    const totalMinutes = pct * 24 * 60;
    
    const now = new Date();
    const scrubDate = new Date(now);
    scrubDate.setHours(0, 0, 0, 0);
    scrubDate.setMinutes(totalMinutes);
    
    scrubbedTime = scrubDate;
    update(); // Force immediate update
}

function stopScrub() {
    if (scrubbedTime) {
        scrubbedTime = null;
        update();
    }
}

timelineVis.addEventListener('mousedown', (e) => {
    handleScrub(e);
    window.addEventListener('mousemove', handleScrub);
    window.addEventListener('mouseup', stopScrubOnce);
});

timelineVis.addEventListener('touchstart', (e) => {
    handleScrub(e);
    window.addEventListener('touchmove', handleScrub, { passive: false });
    window.addEventListener('touchend', stopScrubOnce);
}, { passive: false });

function stopScrubOnce() {
    window.removeEventListener('mousemove', handleScrub);
    window.removeEventListener('mouseup', stopScrubOnce);
    window.removeEventListener('touchmove', handleScrub);
    window.removeEventListener('touchend', stopScrubOnce);
    stopScrub();
}


function formatStaticTime(timeStr) {
    if (is24Hour) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatAxisTime(hour) {
    if (is24Hour) {
        return `${hour.toString().padStart(2, '0')}:00`;
    } else {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        if (hour === 24) return '12 AM'; // End
        return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
    }
}

function renderTimelineAxis() {
    const axis = document.getElementById('timeline-axis');
    axis.innerHTML = '';
    
    const steps = [0, 4, 8, 12, 16, 20, 24];
    steps.forEach(hour => {
        const span = document.createElement('span');
        span.textContent = formatAxisTime(hour);
        axis.appendChild(span);
    });
}

function getVolumeStatus(date) {
    // Heuristic based on open sessions
    // We need to check which sessions are open at 'date'
    let openCount = 0;
    let openSessions = [];

    sessions.forEach(session => {
        const timeInZoneStr = date.toLocaleTimeString('en-US', { timeZone: session.timeZone, hour12: false, hour: '2-digit', minute: '2-digit' });
        const [currH, currM] = timeInZoneStr.split(':').map(Number);
        const currMinutes = currH * 60 + currM;

        const [startH, startM] = session.startLocal.split(':').map(Number);
        const startMinutes = startH * 60 + startM;

        const [endH, endM] = session.endLocal.split(':').map(Number);
        const endMinutes = endH * 60 + endM;

        let isOpen = false;
        if (startMinutes < endMinutes) {
            if (currMinutes >= startMinutes && currMinutes < endMinutes) isOpen = true;
        } else {
            if (currMinutes >= startMinutes || currMinutes < endMinutes) isOpen = true;
        }

        if (isOpen) {
            openCount++;
            openSessions.push(session.id);
        }
    });

    // Determine Volume Level
    // 0 -> Low
    // 1 -> Low/Medium (Sydney=Low, Tokyo=Medium, London=High, NY=High)
    // 2+ -> High/Very High

    if (openCount === 0) return { level: 'Low', class: 'low', color: 'var(--text-muted)' };

    if (openCount === 1) {
        const id = openSessions[0];
        if (id === 'sydney') return { level: 'Low', class: 'low', color: 'var(--text-muted)' };
        if (id === 'tokyo') return { level: 'Medium', class: 'medium', color: 'var(--accent-color)' };
        return { level: 'High', class: 'high', color: 'var(--success-color)' }; // London or NY alone
    }

    if (openCount >= 2) {
        // Check for London + NY overlap
        if (openSessions.includes('london') && openSessions.includes('newyork')) {
            return { level: 'Very High', class: 'very-high', color: '#ef4444' };
        }
        // Check for London + Tokyo overlap
        if (openSessions.includes('london') && openSessions.includes('tokyo')) {
            return { level: 'High', class: 'high', color: 'var(--success-color)' };
        }
        // Sydney + Tokyo
        if (openSessions.includes('sydney') && openSessions.includes('tokyo')) {
            return { level: 'Medium', class: 'medium', color: 'var(--accent-color)' };
        }
        
        return { level: 'High', class: 'high', color: 'var(--success-color)' };
    }
    
    return { level: 'Low', class: 'low', color: 'var(--text-muted)' };
}

function update() {
    const realNow = new Date();
    const displayTime = scrubbedTime || realNow;
    
    // Update Header Clock
    document.getElementById('local-clock').textContent = displayTime.toLocaleTimeString('en-US', { hour12: !is24Hour });
    document.getElementById('local-date').textContent = displayTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    if (scrubbedTime) {
        document.getElementById('local-clock').style.color = 'var(--accent-color)';
    } else {
        document.getElementById('local-clock').style.color = 'var(--text-main)';
    }

    // Update Volume
    const vol = getVolumeStatus(displayTime);
    const volEl = document.getElementById('current-volume');
    volEl.textContent = vol.level;
    volEl.className = `volume-value ${vol.class}`;

    const grid = document.getElementById('sessions-grid');
    if (grid.children.length === 0) {
        renderGrid();
    }
    updateGrid(displayTime);
    updateTimeline(displayTime);
}

function renderGrid() {
    const grid = document.getElementById('sessions-grid');
    grid.innerHTML = sessions.map(session => `
        <div class="session-card" id="card-${session.id}">
            <div class="card-header">
                <div class="session-name">${session.name}</div>
                <div class="status-badge" id="status-${session.id}">--</div>
            </div>
            <div class="card-body">
                <div class="time-row">
                    <span class="label">Local Time</span>
                    <span class="value" id="time-${session.id}">--:--</span>
                </div>
                <div class="time-row">
                    <span class="label">Hours (Local)</span>
                    <span class="value">${formatStaticTime(session.startLocal)} - ${formatStaticTime(session.endLocal)}</span>
                </div>
                <div class="time-row">
                    <span class="label">Status</span>
                    <span class="value" id="your-time-${session.id}">--</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar" id="progress-${session.id}"></div>
                </div>
            </div>
        </div>
    `).join('');
}

function updateGrid(now) {
    sessions.forEach(session => {
        // 1. Get current time in session timezone for display
        const timeInZoneStr = now.toLocaleTimeString('en-US', { 
            timeZone: session.timeZone, 
            hour12: !is24Hour, 
            hour: 'numeric', 
            minute: '2-digit' 
        });
        document.getElementById(`time-${session.id}`).textContent = timeInZoneStr;

        // 2. Logic for open/closed (always uses 24h for calculation)
        const timeInZone24 = now.toLocaleTimeString('en-US', { 
            timeZone: session.timeZone, 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const [currH, currM] = timeInZone24.split(':').map(Number);
        const currMinutes = currH * 60 + currM;

        const [startH, startM] = session.startLocal.split(':').map(Number);
        const startMinutes = startH * 60 + startM;

        const [endH, endM] = session.endLocal.split(':').map(Number);
        const endMinutes = endH * 60 + endM;

        let isOpen = false;
        let progress = 0;

        // Handle simple case (start < end)
        if (startMinutes < endMinutes) {
            if (currMinutes >= startMinutes && currMinutes < endMinutes) {
                isOpen = true;
                progress = ((currMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
            }
        } else {
            // Handle crossing midnight
            if (currMinutes >= startMinutes || currMinutes < endMinutes) {
                isOpen = true;
                const totalDuration = (24 * 60) - startMinutes + endMinutes;
                const elapsed = currMinutes >= startMinutes ? (currMinutes - startMinutes) : ((24 * 60 - startMinutes) + currMinutes);
                progress = (elapsed / totalDuration) * 100;
            }
        }

        // Update UI
        const statusEl = document.getElementById(`status-${session.id}`);
        const cardEl = document.getElementById(`card-${session.id}`);
        const progressEl = document.getElementById(`progress-${session.id}`);
        const yourTimeEl = document.getElementById(`your-time-${session.id}`);

        if (isOpen) {
            statusEl.textContent = 'Open';
            statusEl.className = 'status-badge open';
            cardEl.classList.add('active');
            progressEl.style.width = `${progress}%`;
            progressEl.style.backgroundColor = session.color;
        } else {
            statusEl.textContent = 'Closed';
            statusEl.className = 'status-badge closed';
            cardEl.classList.remove('active');
            progressEl.style.width = '0%';
        }

        if (isOpen) {
            // Calculate remaining time
            let minsRemaining = 0;
            if (startMinutes < endMinutes) {
                minsRemaining = endMinutes - currMinutes;
            } else {
                // Crossing midnight
                if (currMinutes >= startMinutes) minsRemaining = (24*60 - currMinutes) + endMinutes;
                else minsRemaining = endMinutes - currMinutes;
            }
            
            const hrs = Math.floor(minsRemaining / 60);
            const mins = minsRemaining % 60;
            yourTimeEl.textContent = `Closes in ${hrs}h ${mins}m`;
            yourTimeEl.style.color = session.color;
        } else {
            // Calculate time to open
            let minsToOpen = 0;
            if (currMinutes < startMinutes) {
                minsToOpen = startMinutes - currMinutes;
            } else {
                minsToOpen = (24 * 60 - currMinutes) + startMinutes;
            }
            
            const hrs = Math.floor(minsToOpen / 60);
            const mins = minsToOpen % 60;
            yourTimeEl.textContent = `Opens in ${hrs}h ${mins}m`;
            yourTimeEl.style.color = 'var(--text-muted)';
        }
    });
}

function updateTimeline(now) {
    const container = document.getElementById('timeline-vis');
    container.innerHTML = ''; // Clear

    // 0. Draw Volume Strip (Background)
    // We want to draw blocks for every hour or 30 mins
    const volumeStrip = document.createElement('div');
    volumeStrip.className = 'timeline-volume-strip';
    
    // We'll sample every 30 mins (48 blocks)
    for (let i = 0; i < 48; i++) {
        const mins = i * 30;
        const sampleDate = new Date(now);
        sampleDate.setHours(0, 0, 0, 0);
        sampleDate.setMinutes(mins);
        
        const vol = getVolumeStatus(sampleDate);
        
        const block = document.createElement('div');
        block.className = 'volume-block';
        block.style.width = `${100/48}%`;
        block.style.backgroundColor = vol.color;
        block.title = `Volume: ${vol.level}`; // Tooltip
        volumeStrip.appendChild(block);
    }
    container.appendChild(volumeStrip);


    // 1. Draw current time marker
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const nowPct = ((nowH * 60 + nowM) / (24 * 60)) * 100;
    
    const marker = document.createElement('div');
    marker.className = 'current-time-marker';
    if (scrubbedTime) {
        marker.classList.add('scrubbing');
        marker.setAttribute('data-time', now.toLocaleTimeString('en-US', { hour12: !is24Hour, hour: 'numeric', minute: '2-digit' }));
    }
    marker.style.left = `${nowPct}%`;
    container.appendChild(marker);

    // 2. Draw session bars
    sessions.forEach((session, index) => {
        const sessionTimeStr = now.toLocaleString('en-US', { timeZone: session.timeZone });
        const sessionDate = new Date(sessionTimeStr);
        
        const diffMs = sessionDate.getTime() - now.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        
        const [startH, startM] = session.startLocal.split(':').map(Number);
        const [endH, endM] = session.endLocal.split(':').map(Number);
        
        const startAbsSession = startH + (startM / 60);
        const endAbsSession = endH + (endM / 60);
        
        let startAbsLocal = startAbsSession - diffHrs;
        
        let duration = endAbsSession - startAbsSession;
        if (duration < 0) duration += 24;
        
        let endAbsLocal = startAbsLocal + duration;
        
        while (startAbsLocal < 0) startAbsLocal += 24;
        while (startAbsLocal >= 24) startAbsLocal -= 24;
        
        endAbsLocal = startAbsLocal + duration;
        
        const drawBar = (start, end) => {
            if (start >= 24) return; 
            if (end <= 0) return; 
            
            const s = Math.max(0, start);
            const e = Math.min(24, end);
            
            const startPct = (s / 24) * 100;
            const widthPct = ((e - s) / 24) * 100;
            
            const bar = document.createElement('div');
            bar.className = 'timeline-bar';
            bar.style.left = `${startPct}%`;
            bar.style.width = `${widthPct}%`;
            bar.style.top = `${index * 25 + 10}px`;
            bar.style.backgroundColor = session.color;
            bar.textContent = session.name;
            container.appendChild(bar);
        };

        drawBar(startAbsLocal, endAbsLocal);
        
        if (endAbsLocal > 24) {
            drawBar(0, endAbsLocal - 24);
        }
    });
}

// Init
initSettings();
renderGrid();
renderTimelineAxis();
update();
setInterval(() => {
    if (!scrubbedTime) update();
}, 1000);
