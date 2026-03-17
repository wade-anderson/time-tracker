// State & Storage
const STORAGE_KEY = 'timeTrackerState';

let state = {
    projects: [], // Array of string names
    tasks: []     // Array of objects { id, desc, project, start, end, durationMs }
};

// Initialization
function init() {
    loadState();
    setDefaultTimes();
    renderAll();
    setupEventListeners();
}

// Global exposure for inline onclick
window.deleteTask = function(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
};

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            state = JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse state", e);
        }
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
}

// Event Listeners setup
function setupEventListeners() {
    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('project-name');
        const name = input.value.trim();
        if (name && !state.projects.includes(name)) {
            state.projects.push(name);
            input.value = '';
            saveState();
        }
    });

    document.getElementById('task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const descInput = document.getElementById('task-desc');
        const projectInput = document.getElementById('task-project');
        const startInput = document.getElementById('task-start');
        const endInput = document.getElementById('task-end');

        const startTime = new Date(startInput.value);
        const endTime = new Date(endInput.value);

        if (endTime <= startTime) {
            alert("End time must be after start time.");
            return;
        }

        const task = {
            id: Date.now().toString(),
            desc: descInput.value.trim(),
            project: projectInput.value,
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            durationMs: endTime.getTime() - startTime.getTime()
        };

        state.tasks.unshift(task); // Add to beginning
        
        // Reset form
        descInput.value = '';
        setDefaultTimes();
        
        saveState();
    });

    document.getElementById('view-report').addEventListener('click', () => {
        const now = new Date();
        
        const todayTotal = state.tasks.filter(t => isSameDay(new Date(t.start), now)).reduce((sum, t) => sum + t.durationMs, 0);
        const startOfWeek = getStartOfWeek(now);
        const weekTotal = state.tasks.filter(t => new Date(t.start) >= startOfWeek).reduce((sum, t) => sum + t.durationMs, 0);
        
        const totals = {};
        state.projects.forEach(p => totals[p] = 0);
        state.tasks.forEach(t => {
            if (totals[t.project] !== undefined) totals[t.project] += t.durationMs;
        });

        let html = `
            <div style="font-family: Inter, sans-serif; color: #0f172a;">
                <p style="color: #64748b; margin-bottom: 24px; font-size: 0.9rem;">Report Generated on ${now.toLocaleString()}</p>
                
                <h3 style="font-size: 1.1rem; margin-bottom: 16px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; color: var(--primary-color);">Summary</h3>
                <div style="display: flex; gap: 40px; margin-bottom: 32px;">
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Today</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${formatDuration(todayTotal)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">This Week</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${formatDuration(weekTotal)}</div>
                    </div>
                </div>

                <h3 style="font-size: 1.1rem; margin-bottom: 16px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; color: var(--primary-color);">Projects & Tasks</h3>
        `;

        if (state.projects.length === 0) {
            html += `<p style="color: var(--text-secondary); font-style: italic;">No projects available.</p>`;
        } else {
            state.projects.forEach(p => {
                const projectTasks = state.tasks.filter(t => t.project === p);
                const projectTotal = totals[p];

                html += `
                    <div style="margin-bottom: 24px;">
                        <div style="margin-bottom: 12px; background-color: var(--bg-color); padding: 8px 12px; border-left: 4px solid var(--primary-color); display: flex; justify-content: space-between; align-items: center; border-radius: 0 4px 4px 0;">
                            <span style="font-weight: 600;">${p}</span>
                            <span style="font-size: 0.9rem; color: var(--primary-color); font-weight: 600;">Total: ${formatDuration(projectTotal)}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr>
                                    <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); width: 30%;">Date</th>
                                    <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); width: 50%;">Description</th>
                                    <th style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); width: 20%;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                if (projectTasks.length === 0) {
                    html += `<tr><td colspan="3" style="padding: 16px 8px; text-align: center; color: var(--text-secondary); font-style: italic;">No tasks logged.</td></tr>`;
                } else {
                    projectTasks.forEach(t => {
                        const startD = new Date(t.start);
                        const dateStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                        const timeStr = startD.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                        html += `
                            <tr>
                                <td style="padding: 12px 8px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary);">${dateStr} <span style="font-size: 0.75rem;">${timeStr}</span></td>
                                <td style="padding: 12px 8px; border-bottom: 1px solid var(--border-color); font-weight: 500;">${t.desc}</td>
                                <td style="padding: 12px 8px; border-bottom: 1px solid var(--border-color); text-align: right; font-weight: 600;">${formatDuration(t.durationMs)}</td>
                            </tr>
                        `;
                    });
                }

                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }

        html += `</div>`;

        // Inject HTML and show modal
        document.getElementById('report-content').innerHTML = html;
        document.getElementById('report-modal').classList.remove('hidden');
    });

    // Close modal handlers
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('hidden');
    });

    document.getElementById('report-modal').addEventListener('click', (e) => {
        if (e.target.id === 'report-modal') {
            document.getElementById('report-modal').classList.add('hidden');
        }
    });

    // Data Management
    document.getElementById('export-data').addEventListener('click', () => {
        const dataStr = JSON.stringify(state, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `TimeTracker_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-data-btn').addEventListener('click', () => {
        document.getElementById('import-data-input').click();
    });

    document.getElementById('import-data-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                // Basic validation
                if (importedData.projects && Array.isArray(importedData.tasks)) {
                    state = importedData;
                    saveState();
                    alert('Data imported successfully!');
                } else {
                    alert('Invalid file format. Please upload a valid TimeTracker backup.');
                }
            } catch (err) {
                alert('Error reading file. Make sure it is a valid JSON file.');
            }
            e.target.value = ''; // Reset input
        };
        reader.readAsText(file);
    });

    document.getElementById('reset-data').addEventListener('click', () => {
        if (confirm('Are you absolutely sure you want to delete ALL your projects and tasks? This cannot be undone.')) {
            state = { projects: [], tasks: [] };
            saveState();
        }
    });
}

// Helpers
function setDefaultTimes() {
    const now = new Date();
    // Use local time for setting datetime-local input
    // The input format is YYYY-MM-DDThh:mm
    
    // Convert current datetime to standard string format locally
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    
    const nowStr = `${year}-${month}-${day}T${hours}:${mins}`;
    
    // Set default start to 1 hour ago
    now.setHours(now.getHours() - 1);
    const sYear = now.getFullYear();
    const sMonth = String(now.getMonth() + 1).padStart(2, '0');
    const sDay = String(now.getDate()).padStart(2, '0');
    const sHours = String(now.getHours()).padStart(2, '0');
    const sMins = String(now.getMinutes()).padStart(2, '0');
    
    const startStr = `${sYear}-${sMonth}-${sDay}T${sHours}:${sMins}`;
    
    document.getElementById('task-end').value = nowStr;
    document.getElementById('task-start').value = startStr;
}

function formatDuration(ms) {
    if (ms < 0) ms = 0;
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// Get the start of the week (Sunday)
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Rendering
function renderAll() {
    renderProjectOptions();
    renderProjectList();
    renderTaskList();
    renderSummaries();
}

function renderProjectOptions() {
    const select = document.getElementById('task-project');
    const currentValue = select.value;
    
    // Keep placeholder
    select.innerHTML = '<option value="" disabled selected>Select a Project</option>';
    
    state.projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });

    if (state.projects.includes(currentValue)) {
        select.value = currentValue;
    } else if (state.projects.length > 0) {
        select.value = state.projects[0];
    }
}

function renderProjectList() {
    const list = document.getElementById('project-list');
    
    if (state.projects.length === 0) {
        list.innerHTML = '<p class="empty-state">No projects added yet.</p>';
        return;
    }

    // Calculate totals per project
    const totals = {};
    state.projects.forEach(p => totals[p] = 0);
    
    state.tasks.forEach(t => {
        if (totals[t.project] !== undefined) {
            totals[t.project] += t.durationMs;
        }
    });

    list.innerHTML = state.projects.map(p => `
        <div class="project-item">
            <span class="project-name">${p}</span>
            <span class="project-time">${formatDuration(totals[p])}</span>
        </div>
    `).join('');
}

function renderTaskList() {
    const list = document.getElementById('task-list');
    
    if (state.tasks.length === 0) {
        list.innerHTML = '<p class="empty-state">No tasks logged yet.</p>';
        return;
    }

    list.innerHTML = state.tasks.slice(0, 10).map(t => {
        const startD = new Date(t.start);
        const dateStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeStr = startD.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="task-item">
                <div class="task-details">
                    <span class="task-desc">${t.desc}</span>
                    <span class="task-meta">
                        <span class="task-project-badge">${t.project}</span>
                        ${dateStr} at ${timeStr}
                    </span>
                </div>
                <div class="task-actions">
                    <span class="task-duration">${formatDuration(t.durationMs)}</span>
                    <button class="btn-delete" onclick="deleteTask('${t.id}')" aria-label="Delete task">&times;</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderSummaries() {
    const now = new Date();
    const todayTotal = state.tasks
        .filter(t => isSameDay(new Date(t.start), now))
        .reduce((sum, t) => sum + t.durationMs, 0);

    const startOfWeek = getStartOfWeek(now);
    const weekTotal = state.tasks
        .filter(t => new Date(t.start) >= startOfWeek)
        .reduce((sum, t) => sum + t.durationMs, 0);

    document.getElementById('today-total').textContent = formatDuration(todayTotal);
    document.getElementById('week-total').textContent = formatDuration(weekTotal);
}

// Start
init();
