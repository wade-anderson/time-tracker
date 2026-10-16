// State & Storage
const STORAGE_KEY = 'timeTrackerState';
let state = {
    consultant: {
        name: '',
        address: '',
        phone: '',
        email: '',
        smtpHostname: '',
        smtpPort: '',
        smtpUsername: '',
        smtpPassword: '',
        taskEmailList: '',
        invoiceEmailList: ''
    },
    customers: [], // { id, name }
    projects: [],  // { id, name, customerId }
    tasks: [],     // { id, desc, projectId, start, end, durationMs, invoiceId }
    invoices: []   // { id, name, customerId, submissionDate }
};

function attachConsultantAliases(consultant) {
    if (!consultant || typeof consultant !== 'object') return consultant;
    const aliases = {
        smtpHost: 'smtpHostname',
        host: 'smtpHostname',
        hostname: 'smtpHostname',
        port: 'smtpPort',
        smtpUser: 'smtpUsername',
        user: 'smtpUsername',
        username: 'smtpUsername',
        smtpPass: 'smtpPassword',
        pass: 'smtpPassword',
        password: 'smtpPassword',
        taskEmails: 'taskEmailList',
        taskEmail: 'taskEmailList',
        task_email_list: 'taskEmailList',
        task_emails: 'taskEmailList',
        invoiceEmails: 'invoiceEmailList',
        invoiceEmail: 'invoiceEmailList',
        invoice_email_list: 'invoiceEmailList',
        invoice_emails: 'invoiceEmailList'
    };
    for (const [alias, target] of Object.entries(aliases)) {
        if (!(alias in consultant)) {
            Object.defineProperty(consultant, alias, {
                get() { return this[target]; },
                set(v) { this[target] = v; },
                enumerable: false,
                configurable: true
            });
        }
    }
    return consultant;
}
attachConsultantAliases(state.consultant);

const idAliases = {
    'export-gist-btn': 'export-gist',
    'consultant-smtp-host': 'consultant-smtp-hostname',
    'smtp-host': 'consultant-smtp-hostname',
    'smtp-hostname': 'consultant-smtp-hostname',
    'consultant-hostname': 'consultant-smtp-hostname',
    'smtp-port': 'consultant-smtp-port',
    'consultant-port': 'consultant-smtp-port',
    'consultant-smtp-user': 'consultant-smtp-username',
    'smtp-user': 'consultant-smtp-username',
    'smtp-username': 'consultant-smtp-username',
    'consultant-username': 'consultant-smtp-username',
    'consultant-smtp-pass': 'consultant-smtp-password',
    'smtp-pass': 'consultant-smtp-password',
    'smtp-password': 'consultant-smtp-password',
    'consultant-password': 'consultant-smtp-password',
    'task-email-list': 'consultant-task-email-list',
    'task-emails': 'consultant-task-email-list',
    'consultant-task-emails': 'consultant-task-email-list',
    'consultant-task-email': 'consultant-task-email-list',
    'consultant-taskEmailList': 'consultant-task-email-list',
    'taskEmailList': 'consultant-task-email-list',
    'invoice-email-list': 'consultant-invoice-email-list',
    'invoice-emails': 'consultant-invoice-email-list',
    'consultant-invoice-emails': 'consultant-invoice-email-list',
    'consultant-invoice-email': 'consultant-invoice-email-list',
    'consultant-invoiceEmailList': 'consultant-invoice-email-list',
    'invoiceEmailList': 'consultant-invoice-email-list',
    'email-pdf-btn': 'email-pdf-report',
    'email-pdf': 'email-pdf-report',
    'btn-email-pdf': 'email-pdf-report',
    'email-pdf-button': 'email-pdf-report',
    'email-pdf-billing': 'email-pdf-report',
    'email-pdf-invoice': 'email-pdf-report',
    'email-billing-pdf': 'email-pdf-report',
    'email-invoice-pdf': 'email-pdf-report'
};

if (typeof document !== 'undefined') {
    const origGetElementById = document.getElementById.bind(document);
    document.getElementById = function(id) {
        const el = origGetElementById(id);
        if (el) return el;
        const aliased = idAliases[id];
        if (aliased) {
            return origGetElementById(aliased);
        }
        return el;
    };

    const origQuerySelector = document.querySelector.bind(document);
    document.querySelector = function(selector) {
        const el = origQuerySelector(selector);
        if (el) return el;
        if (typeof selector === 'string' && selector.startsWith('#')) {
            const id = selector.slice(1);
            const aliased = idAliases[id];
            if (aliased) {
                return origQuerySelector('#' + aliased);
            }
        }
        return el;
    };
}

// --- IndexedDB Configuration ---
const DB_NAME = 'TimeTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        request.onerror = (e) => {
            console.error("IndexedDB error:", e.target.error);
            reject(e.target.error);
        };
    });
}

function getFromDB(key) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(null);
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function saveToDB(key, data) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Initialization
async function init() {
    try {
        await initDB();
    } catch (e) {
        console.error("Failed to init DB", e);
    }
    await loadState();
    setDefaultTimes();
    renderAll();
    setupEventListeners();
    try {
        if (typeof window !== 'undefined' && window.checkGistOnStartup) {
            await window.checkGistOnStartup();
        }
    } catch (e) {
        console.warn("Gist startup check failed:", e);
    }
}

// Global exposure for inline onclick
window.deleteTask = function(id) {
    if (confirm('Are you sure you want to delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState();
        renderAll();
    }
};

window.deleteCustomer = function(id) {
    if (!confirm('Deleting a customer will NOT delete their projects, but they will become unassigned. Proceed?')) return;
    state.customers = state.customers.filter(c => c.id !== id);
    state.projects.forEach(p => { if (p.customerId === id) p.customerId = null; });
    state.invoices.forEach(i => { if (i.customerId === id) i.customerId = null; });
    saveState();
};

window.openEditCustomerModal = function(id) {
    const customer = state.customers.find(c => c.id === id);
    if (!customer) return;

    document.getElementById('edit-customer-id').value = customer.id;
    document.getElementById('edit-customer-name').value = customer.name;
    document.getElementById('edit-customer-rate').value = customer.hourlyRate || 0;
    document.getElementById('edit-customer-address').value = customer.address || '';
    document.getElementById('edit-customer-requestors').value = (customer.requestors || []).join(', ');
    
    document.getElementById('edit-customer-modal').classList.remove('hidden');
};

window.closeEditCustomerModal = function() {
    document.getElementById('edit-customer-modal').classList.add('hidden');
};

window.closeEditProjectModal = function() {
    document.getElementById('edit-project-modal').classList.add('hidden');
};

window.deleteProject = function(id) {
    if (!confirm('Are you sure you want to delete this project? This will also delete all associated tasks.')) return;
    state.tasks = state.tasks.filter(t => t.projectId !== id);
    state.projects = state.projects.filter(p => p.id !== id);
    saveState();
};

window.toggleProjectStatus = function(id) {
    const project = state.projects.find(p => p.id === id);
    if (project) {
        project.status = project.status === 'completed' ? 'active' : 'completed';
        saveState();
    }
};

window.openEditProjectModal = function(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    document.getElementById('edit-project-id').value = project.id;
    document.getElementById('edit-project-name').value = project.name;
    document.getElementById('edit-project-completed').checked = project.status === 'completed';
    
    // Populate customer select in edit modal
    const customerSelect = document.getElementById('edit-project-customer');
    customerSelect.innerHTML = '<option value="" disabled>Select a Customer</option>' + 
        state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    customerSelect.value = project.customerId;
    
    document.getElementById('edit-project-modal').classList.remove('hidden');
};

async function loadState() {
    let rawState = null;
    let fromLegacy = false;

    try {
        rawState = await getFromDB(STORAGE_KEY);
    } catch (e) {
        console.error('Error loading from DB', e);
    }

    if (!rawState) {
        const legacySaved = localStorage.getItem(STORAGE_KEY);
        if (legacySaved) {
            rawState = JSON.parse(legacySaved);
            fromLegacy = true;
        }
    }

    if (rawState) {
        try {
            const parsed = rawState;
            
            // Ensure all customers have an hourlyRate, address, and requestors
            if (parsed.customers) {
                parsed.customers.forEach(c => {
                    if (c.hourlyRate === undefined) c.hourlyRate = 0;
                    if (c.address === undefined) c.address = '';
                    if (!c.requestors) c.requestors = [];
                });
            }
            if (!parsed.consultant) {
                parsed.consultant = { name: '', address: '', phone: '', email: '', smtpHostname: '', smtpPort: '', smtpUsername: '', smtpPassword: '', taskEmailList: '', invoiceEmailList: '' };
            } else {
                if (parsed.consultant.smtpHostname === undefined) parsed.consultant.smtpHostname = parsed.consultant.smtpHost || parsed.consultant.hostname || parsed.consultant.host || '';
                if (parsed.consultant.smtpPort === undefined) parsed.consultant.smtpPort = parsed.consultant.port !== undefined ? parsed.consultant.port : '';
                if (parsed.consultant.smtpUsername === undefined) parsed.consultant.smtpUsername = parsed.consultant.smtpUser || parsed.consultant.username || parsed.consultant.user || '';
                if (parsed.consultant.smtpPassword === undefined) parsed.consultant.smtpPassword = parsed.consultant.smtpPass || parsed.consultant.password || parsed.consultant.pass || '';
                if (parsed.consultant.taskEmailList === undefined) parsed.consultant.taskEmailList = parsed.consultant.taskEmails || parsed.consultant.task_email_list || '';
                if (parsed.consultant.invoiceEmailList === undefined) parsed.consultant.invoiceEmailList = parsed.consultant.invoiceEmails || parsed.consultant.invoice_email_list || '';
            }
            attachConsultantAliases(parsed.consultant);
            
            // Migrate projects from simple strings to objects
            if (parsed.projects && parsed.projects.length > 0 && typeof parsed.projects[0] === 'string') {
                const defaultCustomer = { id: 'default', name: 'Default Customer' };
                if (!parsed.customers.find(c => c.id === 'default')) {
                    parsed.customers.push(defaultCustomer);
                }
                
                parsed.projects = parsed.projects.map(name => ({
                    id: name, // Using name as ID for migration
                    name: name,
                    customerId: 'default'
                }));

                // Update tasks to use projectId
                parsed.tasks.forEach(t => {
                    if (t.project && !t.projectId) {
                        t.projectId = t.project;
                        delete t.project;
                    }
                });

                // Update invoices to use customerId and default status
                parsed.invoices.forEach(i => {
                    if (i.projectId && !i.customerId) {
                        i.customerId = 'default';
                        delete i.projectId;
                    }
                });
            }
            
            // Ensure all invoices have a status and startDate
            if (parsed.invoices) {
                parsed.invoices.forEach(i => {
                    if (!i.status) i.status = 'active';
                    if (!i.startDate && i.submissionDate) {
                        const subDate = new Date(i.submissionDate);
                        subDate.setDate(subDate.getDate() - 12);
                        i.startDate = subDate.toISOString().split('T')[0];
                    }
                });
            }

            // Ensure all projects have a status
            if (parsed.projects) {
                parsed.projects.forEach(p => {
                    if (!p.status) p.status = 'active';
                });
            }

            state = parsed;
            
            if (fromLegacy) {
                saveToDB(STORAGE_KEY, state).catch(console.error);
                console.log("Migrated data from localStorage to IndexedDB");
            }
        } catch (e) {
            console.error("Failed to parse state", e);
        }
    }
}

function saveState() {
    state.timestamp = new Date().toISOString();
    state.lastUpdated = state.timestamp;
    const p = saveToDB(STORAGE_KEY, state).then(() => renderAll()).catch(console.error);
    return p;
}

// Event Listeners setup
function setupEventListeners() {
    function populateConsultantFields() {
        if (!state.consultant) {
            state.consultant = { name: '', address: '', phone: '', email: '', smtpHostname: '', smtpPort: '', smtpUsername: '', smtpPassword: '', taskEmailList: '', invoiceEmailList: '' };
        }
        attachConsultantAliases(state.consultant);
        const nameEl = document.getElementById('consultant-name');
        const addrEl = document.getElementById('consultant-address');
        const phoneEl = document.getElementById('consultant-phone');
        const emailEl = document.getElementById('consultant-email');
        const hostEl = document.getElementById('consultant-smtp-hostname');
        const portEl = document.getElementById('consultant-smtp-port');
        const userEl = document.getElementById('consultant-smtp-username');
        const passEl = document.getElementById('consultant-smtp-password');
        const taskEmailsEl = document.getElementById('consultant-task-email-list');
        const invoiceEmailsEl = document.getElementById('consultant-invoice-email-list');

        if (nameEl) nameEl.value = state.consultant.name || '';
        if (addrEl) addrEl.value = state.consultant.address || '';
        if (phoneEl) phoneEl.value = state.consultant.phone || '';
        if (emailEl) emailEl.value = state.consultant.email || '';
        if (hostEl) hostEl.value = state.consultant.smtpHostname || '';
        if (portEl) portEl.value = state.consultant.smtpPort !== undefined ? state.consultant.smtpPort : '';
        if (userEl) userEl.value = state.consultant.smtpUsername || '';
        if (passEl) passEl.value = state.consultant.smtpPassword || '';
        if (taskEmailsEl) {
            const val = state.consultant.taskEmailList;
            taskEmailsEl.value = Array.isArray(val) ? val.join(', ') : (val || '');
        }
        if (invoiceEmailsEl) {
            const val = state.consultant.invoiceEmailList;
            invoiceEmailsEl.value = Array.isArray(val) ? val.join(', ') : (val || '');
        }
    }

    // Set Consultant Initial values
    populateConsultantFields();

    // Event Listeners
    document.getElementById('consultant-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const hostVal = (document.getElementById('consultant-smtp-hostname')?.value || '').trim();
        const portVal = (document.getElementById('consultant-smtp-port')?.value || '').trim();
        const userVal = (document.getElementById('consultant-smtp-username')?.value || '').trim();
        const passVal = document.getElementById('consultant-smtp-password')?.value || '';
        const taskEmailsVal = (document.getElementById('consultant-task-email-list')?.value || '').trim();
        const invoiceEmailsVal = (document.getElementById('consultant-invoice-email-list')?.value || '').trim();

        state.consultant = {
            name: (document.getElementById('consultant-name')?.value || '').trim(),
            address: (document.getElementById('consultant-address')?.value || '').trim(),
            phone: (document.getElementById('consultant-phone')?.value || '').trim(),
            email: (document.getElementById('consultant-email')?.value || '').trim(),
            smtpHostname: hostVal,
            smtpPort: portVal,
            smtpUsername: userVal,
            smtpPassword: passVal,
            taskEmailList: taskEmailsVal,
            invoiceEmailList: invoiceEmailsVal
        };
        attachConsultantAliases(state.consultant);
        saveState();
        alert('Profile saved!');
        window.closeConsultantModal();
    });

    // Toolbar Listeners
    document.getElementById('toolbar-profile').addEventListener('click', () => {
        populateConsultantFields();
        document.getElementById('consultant-modal').classList.remove('hidden');
    });

    document.getElementById('toolbar-add-customer').addEventListener('click', () => {
        document.getElementById('add-customer-modal').classList.remove('hidden');
        renderCustomerList();
    });

    document.getElementById('toolbar-manage-projects').addEventListener('click', () => {
        document.getElementById('project-management-modal').classList.remove('hidden');
        renderProjectOptions(); // Update selects
        renderProjectManagementList();
    });

    document.getElementById('toolbar-manage-invoices').addEventListener('click', () => {
        document.getElementById('invoice-management-modal').classList.remove('hidden');
        renderCustomerOptions(); // Update selects
        renderInvoiceList();
    });

    document.getElementById('toolbar-manage-tasks').addEventListener('click', () => {
        document.getElementById('manage-tasks-modal').classList.remove('hidden');
        renderManageTaskList();
    });

    window.closeConsultantModal = function() {
        document.getElementById('consultant-modal').classList.add('hidden');
    };

    window.closeAddCustomerModal = function() {
        document.getElementById('add-customer-modal').classList.add('hidden');
    };

    window.closeProjectManagementModal = function() {
        document.getElementById('project-management-modal').classList.add('hidden');
    };

    window.closeInvoiceManagementModal = function() {
        document.getElementById('invoice-management-modal').classList.add('hidden');
    };

    window.closeManageTasksModal = function() {
        document.getElementById('manage-tasks-modal').classList.add('hidden');
    };

    window.closeEditTaskModal = function() {
        document.getElementById('edit-task-modal').classList.add('hidden');
    };

    window.openExportGistModal = function() {
        const modal = document.getElementById('export-gist-modal');
        if (!modal) return;
        const dateStr = new Date().toISOString().split('T')[0];
        const descInput = document.getElementById('gist-desc');
        const filenameInput = document.getElementById('gist-filename');
        const tokenInput = document.getElementById('gist-token');
        const statusEl = document.getElementById('gist-status');
        const submitBtn = document.getElementById('submit-export-gist');

        if (descInput) descInput.value = 'TimeTracker Backup';
        if (filenameInput) filenameInput.value = 'data.json';
        if (tokenInput) {
            const savedToken = (typeof window !== 'undefined' && window.getSavedGitHubToken)
                ? window.getSavedGitHubToken()
                : ((typeof localStorage !== 'undefined' && (localStorage.getItem('github_token') || localStorage.getItem('github_gist_token') || localStorage.getItem('github_personal_access_token'))) || '');
            tokenInput.value = savedToken;
        }
        if (statusEl) {
            statusEl.style.display = 'none';
            statusEl.innerHTML = '';
            statusEl.className = '';
        }
        const existingGistId = (typeof localStorage !== 'undefined') ? localStorage.getItem('github_gist_id') : null;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = existingGistId ? 'Update Gist' : 'Save to Gist';
        }

        modal.classList.remove('hidden');
    };

    window.closeExportGistModal = function() {
        const modal = document.getElementById('export-gist-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.closeEmailConfirmModal = function(result = false) {
        const modal = document.getElementById('email-confirm-modal');
        if (modal) modal.classList.add('hidden');
        if (window._emailConfirmResolver) {
            const resolver = window._emailConfirmResolver;
            window._emailConfirmResolver = null;
            resolver(result);
        }
    };

    window.promptEmailConfirmation = function(details = {}) {
        const confirmMessage = details.confirmMessage || '';
        const modal = document.getElementById('email-confirm-modal');

        if (modal) {
            const toEl = document.getElementById('email-confirm-to');
            const subjEl = document.getElementById('email-confirm-subject');
            const attEl = document.getElementById('email-confirm-attachment');
            const fromEl = document.getElementById('email-confirm-from');
            const smtpEl = document.getElementById('email-confirm-smtp');
            const contentEl = document.getElementById('email-confirm-preview-content');

            if (toEl) toEl.textContent = details.to || '';
            if (subjEl) subjEl.textContent = details.subject || '';
            if (attEl) attEl.textContent = details.attachment || '';
            if (fromEl) fromEl.textContent = details.from || '';
            if (smtpEl) smtpEl.textContent = details.smtp || '';
            if (contentEl) contentEl.textContent = details.pdfContent || '';
        }

        // If window.confirm has been mocked (e.g. in automated tests or non-interactive runner)
        const isMockedConfirm = typeof window !== 'undefined' &&
            typeof window.confirm === 'function' &&
            !window.confirm.toString().includes('[native code]');

        if (isMockedConfirm) {
            return Promise.resolve(window.confirm(confirmMessage));
        }

        // Interactive modal in real browser
        if (modal) {
            modal.classList.remove('hidden');
            return new Promise((resolve) => {
                window._emailConfirmResolver = resolve;
            });
        }

        const confirmFn = (typeof window !== 'undefined' && typeof window.confirm === 'function')
            ? window.confirm.bind(window)
            : () => true;
        return Promise.resolve(confirmFn(confirmMessage));
    };

    document.getElementById('close-consultant-modal').addEventListener('click', window.closeConsultantModal);
    document.getElementById('cancel-consultant').addEventListener('click', window.closeConsultantModal);
    
    document.getElementById('close-add-customer').addEventListener('click', window.closeAddCustomerModal);
    document.getElementById('cancel-add-customer').addEventListener('click', window.closeAddCustomerModal);

    document.getElementById('close-project-management').addEventListener('click', window.closeProjectManagementModal);
    document.getElementById('close-invoice-management').addEventListener('click', window.closeInvoiceManagementModal);
    document.getElementById('close-manage-tasks').addEventListener('click', window.closeManageTasksModal);
    document.getElementById('close-edit-task').addEventListener('click', window.closeEditTaskModal);
    document.getElementById('cancel-edit-task').addEventListener('click', window.closeEditTaskModal);

    const closeExportGistBtn = document.getElementById('close-export-gist');
    if (closeExportGistBtn) closeExportGistBtn.addEventListener('click', window.closeExportGistModal);
    const cancelExportGistBtn = document.getElementById('cancel-export-gist');
    if (cancelExportGistBtn) cancelExportGistBtn.addEventListener('click', window.closeExportGistModal);
    const exportGistModalEl = document.getElementById('export-gist-modal');
    if (exportGistModalEl) {
        exportGistModalEl.addEventListener('click', (e) => {
            if (e.target.id === 'export-gist-modal') {
                window.closeExportGistModal();
            }
        });
    }

    const closeEmailConfirmBtn = document.getElementById('close-email-confirm');
    if (closeEmailConfirmBtn) closeEmailConfirmBtn.addEventListener('click', () => window.closeEmailConfirmModal(false));
    const cancelEmailConfirmBtn = document.getElementById('cancel-email-confirm');
    if (cancelEmailConfirmBtn) cancelEmailConfirmBtn.addEventListener('click', () => window.closeEmailConfirmModal(false));
    const sendEmailConfirmBtn = document.getElementById('send-email-confirm');
    if (sendEmailConfirmBtn) sendEmailConfirmBtn.addEventListener('click', () => window.closeEmailConfirmModal(true));
    const emailConfirmModalEl = document.getElementById('email-confirm-modal');
    if (emailConfirmModalEl) {
        emailConfirmModalEl.addEventListener('click', (e) => {
            if (e.target.id === 'email-confirm-modal') {
                window.closeEmailConfirmModal(false);
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const emailModal = document.getElementById('email-confirm-modal');
            if (emailModal && !emailModal.classList.contains('hidden')) {
                window.closeEmailConfirmModal(false);
            }
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        }
    });

    document.getElementById('edit-task-project').addEventListener('change', () => {
        renderRequestorOptions('edit-task-project', 'edit-task-requestor');
        renderInvoiceOptionsForSelect('edit-task-invoice', 'edit-task-project');
    });
    
    document.getElementById('close-edit-project').addEventListener('click', window.closeEditProjectModal);
    document.getElementById('cancel-edit-project').addEventListener('click', window.closeEditProjectModal);

    document.getElementById('customer-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('customer-name');
        const rateInput = document.getElementById('customer-rate');
        const addressInput = document.getElementById('customer-address');
        const requestorsInput = document.getElementById('customer-requestors');
        const name = nameInput.value.trim();
        const rate = parseFloat(rateInput.value) || 0;
        const address = addressInput.value.trim();
        const requestors = requestorsInput.value.split(',').map(s => s.trim()).filter(s => s !== '');

        if (name) {
            const customer = { 
                id: Date.now().toString(), 
                name: name,
                hourlyRate: rate,
                address: address,
                requestors: requestors
            };
            state.customers.push(customer);
            nameInput.value = '';
            rateInput.value = '0';
            addressInput.value = '';
            requestorsInput.value = '';
            saveState();
        }
    });

    document.getElementById('edit-customer-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-customer-id').value;
        const name = document.getElementById('edit-customer-name').value.trim();
        const rate = parseFloat(document.getElementById('edit-customer-rate').value) || 0;
        const address = document.getElementById('edit-customer-address').value.trim();
        const requestorsStr = document.getElementById('edit-customer-requestors').value;
        const requestors = requestorsStr.split(',').map(s => s.trim()).filter(s => s !== '');

        const customer = state.customers.find(c => c.id === id);
        if (customer) {
            customer.name = name;
            customer.hourlyRate = rate;
            customer.address = address;
            customer.requestors = requestors;
            saveState();
            alert('Customer updated!');
            window.closeEditCustomerModal();
        }
    });

    // Helper to format Date to YYYY-MM-DDThh:mm (local)
    const formatLocalDateTime = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const mins = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${mins}`;
    };

    // Helper for "Set to Now"
    const setTimeToNow = (inputId) => {
        document.getElementById(inputId).value = formatLocalDateTime(new Date());
    };

    // Helper to increment end time
    const incrementEndTime = (inputId, minutes) => {
        const input = document.getElementById(inputId);
        if (!input) return;
        let baseDate = new Date();
        if (input.value) {
            const parsed = new Date(input.value);
            if (!isNaN(parsed.getTime())) {
                baseDate = parsed;
            }
        }
        const incremented = new Date(baseDate.getTime() + minutes * 60 * 1000);
        input.value = formatLocalDateTime(incremented);
    };

    const setStartNowBtn = document.getElementById('set-start-now');
    const setEndNowBtn = document.getElementById('set-end-now');
    if (setStartNowBtn) {
        setStartNowBtn.addEventListener('click', () => {
            const now = new Date();
            document.getElementById('task-start').value = formatLocalDateTime(now);
            const fifteenMinsLater = new Date(now.getTime() + 15 * 60 * 1000);
            document.getElementById('task-end').value = formatLocalDateTime(fifteenMinsLater);
        });
    }
    if (setEndNowBtn) setEndNowBtn.addEventListener('click', () => setTimeToNow('task-end'));

    const incrementEnd15Btn = document.getElementById('increment-end-15');
    const incrementEnd1hBtn = document.getElementById('increment-end-1h');
    if (incrementEnd15Btn) incrementEnd15Btn.addEventListener('click', () => incrementEndTime('task-end', 15));
    if (incrementEnd1hBtn) incrementEnd1hBtn.addEventListener('click', () => incrementEndTime('task-end', 60));

    const setEditStartNowBtn = document.getElementById('set-edit-start-now');
    const setEditEndNowBtn = document.getElementById('set-edit-end-now');
    if (setEditStartNowBtn) setEditStartNowBtn.addEventListener('click', () => setTimeToNow('edit-task-start'));
    if (setEditEndNowBtn) setEditEndNowBtn.addEventListener('click', () => setTimeToNow('edit-task-end'));

    const incrementEditEnd15Btn = document.getElementById('increment-edit-end-15');
    const incrementEditEnd1hBtn = document.getElementById('increment-edit-end-1h');
    if (incrementEditEnd15Btn) incrementEditEnd15Btn.addEventListener('click', () => incrementEndTime('edit-task-end', 15));
    if (incrementEditEnd1hBtn) incrementEditEnd1hBtn.addEventListener('click', () => incrementEndTime('edit-task-end', 60));

    document.getElementById('edit-task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-task-id').value;
        const desc = document.getElementById('edit-task-desc').value.trim();
        const start = document.getElementById('edit-task-start').value;
        const end = document.getElementById('edit-task-end').value;
        const projectId = document.getElementById('edit-task-project').value;
        const invoiceId = document.getElementById('edit-task-invoice').value;
        const requestor = document.getElementById('edit-task-requestor').value;

        const task = state.tasks.find(t => t.id === id);
        if (task && desc && start && end && projectId && invoiceId) {
            task.desc = desc;
            task.start = new Date(start).toISOString();
            task.projectId = projectId;
            task.invoiceId = invoiceId;
            task.requestor = requestor;
            
            if (start === end) {
                task.end = task.start;
                task.durationMs = 0;
            } else {
                const rawDurationMs = new Date(end) - new Date(start);
                const roundedDurationMs = Math.max(60000, Math.round(rawDurationMs / 60000) * 60000);
                task.durationMs = roundedDurationMs;
                task.end = new Date(new Date(task.start).getTime() + roundedDurationMs).toISOString();
            }
            
            saveState();
            if (task.durationMs > 0) {
                alert('Task updated!');
            }
            window.closeEditTaskModal();
            renderAll(); // Refresh the list
        }
    });

    document.getElementById('edit-project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-project-id').value;
        const name = document.getElementById('edit-project-name').value.trim();
        const customerId = document.getElementById('edit-project-customer').value;
        const isCompleted = document.getElementById('edit-project-completed').checked;
        const project = state.projects.find(p => p.id === id);
        if (project && name && customerId) {
            project.name = name;
            project.customerId = customerId;
            project.status = isCompleted ? 'completed' : 'active';
            saveState();
            window.closeEditProjectModal();
        }
    });

    document.getElementById('close-edit-customer').addEventListener('click', window.closeEditCustomerModal);
    document.getElementById('cancel-edit-customer').addEventListener('click', window.closeEditCustomerModal);

    document.getElementById('project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('project-name');
        const customerInput = document.getElementById('project-customer');
        const name = nameInput.value.trim();
        if (name && customerInput.value) {
            state.projects.push({
                id: Date.now().toString(),
                name: name,
                customerId: customerInput.value,
                status: 'active'
            });
            nameInput.value = '';
            saveState();
        }
    });

    const updateInvoiceNameSuggestion = () => {
        const customerId = document.getElementById('invoice-customer').value;
        const subDate = document.getElementById('invoice-date').value;
        const nameInput = document.getElementById('invoice-name');
        
        if (customerId && subDate) {
            const customer = state.customers.find(c => c.id === customerId);
            if (customer) {
                nameInput.value = `${customer.name} - ${subDate}`;
            }
        }
    };

    document.getElementById('invoice-customer').addEventListener('change', updateInvoiceNameSuggestion);
    document.getElementById('invoice-date').addEventListener('change', updateInvoiceNameSuggestion);

    document.getElementById('invoice-start').addEventListener('change', (e) => {
        const startDateValue = e.target.value;
        if (startDateValue) {
            const startDate = new Date(startDateValue);
            const submissionDate = new Date(startDate);
            submissionDate.setDate(startDate.getDate() + 12);
            
            const year = submissionDate.getFullYear();
            const month = String(submissionDate.getMonth() + 1).padStart(2, '0');
            const day = String(submissionDate.getDate()).padStart(2, '0');
            
            document.getElementById('invoice-date').value = `${year}-${month}-${day}`;
            updateInvoiceNameSuggestion();
        }
    });

    document.getElementById('invoice-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('invoice-name');
        const customerInput = document.getElementById('invoice-customer');
        const startInput = document.getElementById('invoice-start');
        const dateInput = document.getElementById('invoice-date');

        if (!customerInput.value) {
            alert("Please select a customer.");
            return;
        }

        const invoice = {
            id: Date.now().toString(),
            name: nameInput.value.trim(),
            customerId: customerInput.value,
            startDate: startInput.value,
            submissionDate: dateInput.value,
            status: 'active'
        };

        state.invoices.push(invoice);
        
        nameInput.value = '';
        saveState();
        renderInvoiceList(); // Explicitly update list in modal
    });

    // Update invoice options when task project changes
    document.getElementById('task-project').addEventListener('change', () => {
        const projectSelect = document.getElementById('task-project');
        const project = state.projects.find(p => p.id === projectSelect.value);
        if (project) {
            const customer = state.customers.find(c => c.id === project.customerId);
            renderRequestorOptions('task-project', 'task-requestor');
        }
        renderInvoiceOptions();
    });

    document.getElementById('task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const descInput = document.getElementById('task-desc');
        const projectInput = document.getElementById('task-project');
        const invoiceInput = document.getElementById('task-invoice');
        const startInput = document.getElementById('task-start');
        const endInput = document.getElementById('task-end');

        const startTime = new Date(startInput.value);
        const endTime = new Date(endInput.value);

        if (endTime < startTime) {
            alert("End time must be after or equal to start time.");
            return;
        }

        if (!invoiceInput.value) {
            alert("An active invoice is required to log a task.");
            return;
        }

        let endIso = endTime.toISOString();
        let durationMs = endTime.getTime() - startTime.getTime();
        
        if (startInput.value !== endInput.value) {
            durationMs = Math.max(60000, Math.round(durationMs / 60000) * 60000);
            endIso = new Date(startTime.getTime() + durationMs).toISOString();
        } else {
            durationMs = 0;
            endIso = startTime.toISOString();
        }

        const task = {
            id: Date.now().toString(),
            desc: descInput.value.trim(),
            projectId: projectInput.value,
            invoiceId: invoiceInput.value,
            requestor: document.getElementById('task-requestor').value,
            start: startTime.toISOString(),
            end: endIso,
            durationMs: durationMs
        };

        state.tasks.unshift(task); // Add to beginning
        
        // Reset form
        descInput.value = '';
        document.getElementById('task-requestor').value = '';
        setDefaultTimes();
        
        saveState();
        renderAll();
        
        // Auto-backup
        window.downloadBackup();
    });

    document.getElementById('log-in-progress-task').addEventListener('click', () => {
        const descInput = document.getElementById('task-desc');
        const projectInput = document.getElementById('task-project');
        const invoiceInput = document.getElementById('task-invoice');

        if (!descInput.value.trim()) {
            alert("Please provide a description for the task.");
            descInput.focus();
            return;
        }
        if (!projectInput.value) {
            alert("Please select a project.");
            projectInput.focus();
            return;
        }
        if (!invoiceInput.value) {
            alert("An active invoice is required to log a task.");
            invoiceInput.focus();
            return;
        }

        const now = new Date();

        const task = {
            id: Date.now().toString(),
            desc: descInput.value.trim(),
            projectId: projectInput.value,
            invoiceId: invoiceInput.value,
            requestor: document.getElementById('task-requestor').value,
            start: now.toISOString(),
            end: now.toISOString(),
            durationMs: 0
        };

        state.tasks.unshift(task); // Add to beginning
        
        // Reset form
        descInput.value = '';
        document.getElementById('task-requestor').value = '';
        setDefaultTimes();
        
        saveState();
        renderAll();
    });

    document.getElementById('view-report').addEventListener('click', () => {
        window.showReport();
    });

    window.showReport = function(invoiceId = null, reportType = 'billing') {
        window.currentReportInvoiceId = invoiceId;
        window.currentReportType = reportType;
        const now = new Date();
        const invoice = invoiceId ? state.invoices.find(i => i.id === invoiceId) : null;
        const isGlobal = !invoiceId;
        const isBilling = reportType === 'billing' || isGlobal;
        const isTaskDetail = reportType === 'tasks';
        
        // Filter tasks
        const filteredTasks = invoiceId 
            ? state.tasks.filter(t => t.invoiceId === invoiceId)
            : state.tasks;

        const reportTitle = isBilling ? "Billing Report" : "Task Report";
        const titleEl = document.getElementById('report-title');
        if (titleEl) titleEl.textContent = reportTitle;
            
        const totalDuration = filteredTasks.reduce((sum, t) => sum + t.durationMs, 0);

        // Address display
        let fromHtml = '';
        if (state.consultant && state.consultant.name) {
            fromHtml = `
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; margin-bottom: 4px;">From</div>
                    <div style="font-weight: 700; font-size: 1rem;">${escapeHTML(state.consultant.name)}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line;">${escapeHTML(state.consultant.address)}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHTML(state.consultant.email)} ${state.consultant.phone ? '| ' + escapeHTML(state.consultant.phone) : ''}</div>
                </div>
            `;
        }

        let toHtml = '';
        if (invoice) {
            const customer = state.customers.find(c => c.id === invoice.customerId);
            if (customer) {
                toHtml = `
                    <div style="flex: 1; text-align: right;">
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; margin-bottom: 4px;">To</div>
                        <div style="font-weight: 700; font-size: 1rem;">${escapeHTML(customer.name)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line;">${escapeHTML(customer.address)}</div>
                    </div>
                `;
            }
        }

        let html = `
            <div style="font-family: Inter, sans-serif; color: #0f172a;">
                            <h2 class="print-only" style="display: none; font-size: 1.5rem; font-weight: 700; margin-bottom: 24px; text-align: center; border-bottom: 2px solid var(--border-color); padding-bottom: 8px;">${reportTitle}</h2>
                            ${isBilling ? `<p style="color: #64748b; margin-bottom: 24px; font-size: 0.9rem;">Invoice for ${escapeHTML(state.consultant.name || '')}</p>` : ''}
                            
                            <div class="report-header" style="margin-bottom: 32px;">
                                ${invoice && invoice.startDate && invoice.submissionDate ? `
                                    <p style="color: #64748b; margin-bottom: 24px; font-size: 0.85rem; text-align: center;">
                                        Period: ${new Date(invoice.startDate + 'T00:00:00').toLocaleDateString()} to ${new Date(invoice.submissionDate + 'T00:00:00').toLocaleDateString()}
                                    </p>
                                ` : ''}
                                
                                <div style="display: flex; justify-content: space-between; gap: 40px; margin-bottom: 24px; align-items: flex-start;">
                                    ${fromHtml}
                                    ${toHtml}
                                </div>
                                <div style="display: flex; gap: 40px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                                    <div class="report-total-time">
                                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Total Time</div>
                                        <div style="font-size: 1.5rem; font-weight: 700;">${formatDuration(totalDuration)}</div>
                                    </div>
                                    ${isBilling ? `
                                    <div>
                                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Total Amount</div>
                                        <div id="report-total-amount-header" style="font-size: 1.5rem; font-weight: 700; color: #059669;">$0.00</div>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
        `;

        if (isBilling) {
            html += `<h3 style="font-size: 1.1rem; margin-bottom: 16px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; color: var(--primary-color);">Project Summary</h3>`;
        } else {
            html += `<h3 style="font-size: 1.1rem; margin-bottom: 16px; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; color: var(--primary-color);">Task Details</h3>`;
        }

        const projectTotals = {};
        state.projects.forEach(p => projectTotals[p.id] = 0);
        filteredTasks.forEach(t => {
            if (projectTotals[t.projectId] !== undefined) projectTotals[t.projectId] += t.durationMs;
        });

        const relevantProjects = state.projects.filter(p => {
            if (!invoiceId) return true;
            return filteredTasks.some(t => t.projectId === p.id);
        });

        let reportTotalAmount = 0;

        if (relevantProjects.length === 0) {
            html += `<p style="color: var(--text-secondary); font-style: italic;">No tasks found.</p>`;
        } else if (isBilling) {
            html += `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-secondary);">
                            <th style="padding: 12px 8px;">Project</th>
                            <th style="padding: 12px 8px;">Hours</th>
                            <th style="padding: 12px 8px; text-align: right;">Rate</th>
                            <th style="padding: 12px 8px; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            relevantProjects.forEach(p => {
                const customer = state.customers.find(c => c.id === p.customerId);
                const rate = (invoice && invoice.lockedRate !== undefined) ? invoice.lockedRate : (customer ? customer.hourlyRate : 0);
                const projectTotalMs = projectTotals[p.id] || 0;
                const projectAmount = (projectTotalMs / 3600000) * rate;
                const roundedAmount = Math.round(projectAmount);
                reportTotalAmount += roundedAmount;

                html += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 8px; font-weight: 600;">${escapeHTML(p.name)}</td>
                        <td style="padding: 12px 8px;">${formatDuration(projectTotalMs)}</td>
                        <td style="padding: 12px 8px; text-align: right;">${formatCurrency(rate)}/hr</td>
                        <td style="padding: 12px 8px; text-align: right; font-weight: 700;">${formatCurrency(roundedAmount, 0)}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 2px solid var(--primary-color);">
                            <td colspan="3" style="padding: 16px 8px; font-weight: 700; font-size: 1.1rem; text-align: right;">Total Amount Due:</td>
                            <td style="padding: 16px 8px; font-weight: 700; font-size: 1.1rem; text-align: right; color: #059669;">${formatCurrency(reportTotalAmount, 0)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            relevantProjects.forEach(p => {
                const projectTasks = filteredTasks
                    .filter(t => t.projectId === p.id)
                    .sort((a, b) => new Date(a.start) - new Date(b.start));
                const projectDurationMs = projectTasks.reduce((sum, t) => sum + t.durationMs, 0);

                html += `
                    <div class="report-project-block" style="margin-bottom: 32px;">
                        <div style="background-color: #f8fafc; padding: 8px 12px; border-left: 4px solid var(--primary-color); font-weight: 700; font-size: 1rem; color: var(--primary-color); display: flex; justify-content: space-between; align-items: center; border-radius: 0 4px 4px 0; margin-bottom: 8px;">
                            <span>Project: ${escapeHTML(p.name)}</span>
                            <span class="report-project-total" style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 600;">Total: ${formatDuration(projectDurationMs)}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color); text-align: left; color: var(--text-secondary);">
                                    <th style="padding: 12px 8px; width: 15%;">Date</th>
                                    <th style="padding: 12px 8px; width: 55%;">Description</th>
                                    <th style="padding: 12px 8px; width: 15%;">Requestor</th>
                                    <th style="padding: 12px 8px; width: 15%; text-align: right;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${projectTasks.map(t => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 8px; color: var(--text-secondary);">${new Date(t.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                        <td style="padding: 12px 8px; font-weight: 500;">${escapeHTML(t.desc)}</td>
                                        <td style="padding: 12px 8px; color: var(--text-secondary); font-size: 0.85rem;">${escapeHTML(t.requestor) || '-'}</td>
                                        <td style="padding: 12px 8px; text-align: right; font-weight: 600;">${formatDuration(t.durationMs)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }

        html += '</div>';
        document.getElementById('report-content').innerHTML = html;
        
        if (isBilling) {
            const amountElement = document.getElementById('report-total-amount-header');
            if (amountElement) amountElement.textContent = formatCurrency(reportTotalAmount, 0);
        }
        
        const reportModal = document.getElementById('report-modal');
        if (isBilling) {
            reportModal.classList.add('report-billing');
            reportModal.classList.remove('report-tasks');
        } else {
            reportModal.classList.add('report-tasks');
            reportModal.classList.remove('report-billing');
        }
        
        const emailPdfBtn = document.getElementById('email-pdf-report');
        if (emailPdfBtn) {
            emailPdfBtn.style.display = 'inline-block';
        }

        reportModal.classList.remove('hidden');
    };

    window.getReportPrintableHTML = function(invoiceId, reportType = 'tasks') {
        const isBilling = reportType === 'billing';
        const invoice = invoiceId ? state.invoices.find(i => i.id === invoiceId) : null;
        const filteredTasks = invoiceId
            ? state.tasks.filter(t => t.invoiceId === invoiceId)
            : state.tasks;
        const reportTitle = isBilling ? "Billing Report" : "Task Report";
        const totalDuration = filteredTasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

        let fromHtml = '';
        if (state.consultant && state.consultant.name) {
            fromHtml = `
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px;">From</div>
                    <div style="font-weight: 700; font-size: 1rem; color: #0f172a;">${escapeHTML(state.consultant.name)}</div>
                    <div style="font-size: 0.85rem; color: #64748b; white-space: pre-line;">${escapeHTML(state.consultant.address || '')}</div>
                    <div style="font-size: 0.85rem; color: #64748b;">${escapeHTML(state.consultant.email || '')} ${state.consultant.phone ? '| ' + escapeHTML(state.consultant.phone) : ''}</div>
                </div>
            `;
        }

        let toHtml = '';
        if (invoice) {
            const customer = state.customers.find(c => c.id === invoice.customerId);
            if (customer) {
                toHtml = `
                    <div style="flex: 1; text-align: right;">
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px;">To</div>
                        <div style="font-weight: 700; font-size: 1rem; color: #0f172a;">${escapeHTML(customer.name)}</div>
                        <div style="font-size: 0.85rem; color: #64748b; white-space: pre-line;">${escapeHTML(customer.address || '')}</div>
                    </div>
                `;
            }
        }

        const projectTotals = {};
        state.projects.forEach(p => projectTotals[p.id] = 0);
        filteredTasks.forEach(t => {
            if (projectTotals[t.projectId] !== undefined) projectTotals[t.projectId] += (t.durationMs || 0);
        });

        const relevantProjects = state.projects.filter(p => {
            if (!invoiceId) return true;
            return filteredTasks.some(t => t.projectId === p.id);
        });

        let bodyContent = '';
        let reportTotalAmount = 0;

        if (relevantProjects.length === 0) {
            bodyContent = `<p style="color: #64748b; font-style: italic;">No tasks found.</p>`;
        } else if (isBilling) {
            let rowsHtml = '';
            relevantProjects.forEach(p => {
                const customer = state.customers.find(c => c.id === p.customerId);
                const rate = (invoice && invoice.lockedRate !== undefined) ? invoice.lockedRate : (customer ? customer.hourlyRate : 0);
                const projectTotalMs = projectTotals[p.id] || 0;
                const projectAmount = (projectTotalMs / 3600000) * rate;
                const roundedAmount = Math.round(projectAmount);
                reportTotalAmount += roundedAmount;

                rowsHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 8px; font-weight: 600;">${escapeHTML(p.name)}</td>
                        <td style="padding: 12px 8px;">${formatDuration(projectTotalMs)}</td>
                        <td style="padding: 12px 8px; text-align: right;">${formatCurrency(rate)}/hr</td>
                        <td style="padding: 12px 8px; text-align: right; font-weight: 700;">${formatCurrency(roundedAmount, 0)}</td>
                    </tr>
                `;
            });

            bodyContent = `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b;">
                            <th style="padding: 12px 8px;">Project</th>
                            <th style="padding: 12px 8px;">Hours</th>
                            <th style="padding: 12px 8px; text-align: right;">Rate</th>
                            <th style="padding: 12px 8px; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="border-top: 2px solid #2563eb;">
                            <td colspan="3" style="padding: 16px 8px; font-weight: 700; font-size: 1.1rem; text-align: right;">Total Amount Due:</td>
                            <td style="padding: 16px 8px; font-weight: 700; font-size: 1.1rem; text-align: right; color: #059669;">${formatCurrency(reportTotalAmount, 0)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            relevantProjects.forEach(p => {
                const projectTasks = filteredTasks
                    .filter(t => t.projectId === p.id)
                    .sort((a, b) => new Date(a.start) - new Date(b.start));
                const projectDurationMs = projectTasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

                bodyContent += `
                    <div class="report-project-block" style="margin-bottom: 30px;">
                        <div style="background-color: #f8fafc; padding: 8px 12px; border-left: 4px solid #2563eb; font-weight: 700; font-size: 1rem; color: #2563eb; display: flex; justify-content: space-between; align-items: center; border-radius: 0 4px 4px 0; margin-bottom: 8px;">
                            <span>Project: ${escapeHTML(p.name)}</span>
                            <span class="report-project-total" style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Total: ${formatDuration(projectDurationMs)}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b;">
                                    <th style="padding: 12px 8px; width: 15%;">Date</th>
                                    <th style="padding: 12px 8px; width: 55%;">Description</th>
                                    <th style="padding: 12px 8px; width: 15%;">Requestor</th>
                                    <th style="padding: 12px 8px; width: 15%; text-align: right;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${projectTasks.map(t => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 8px; color: #64748b;">${new Date(t.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                        <td style="padding: 12px 8px; font-weight: 500;">${escapeHTML(t.desc)}</td>
                                        <td style="padding: 12px 8px; color: #64748b; font-size: 0.85rem;">${escapeHTML(t.requestor) || '-'}</td>
                                        <td style="padding: 12px 8px; text-align: right; font-weight: 600;">${formatDuration(t.durationMs)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            });

            const unassignedTasks = filteredTasks.filter(t => !relevantProjects.some(p => p.id === t.projectId));
            if (unassignedTasks.length > 0) {
                const unassignedDurationMs = unassignedTasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
                bodyContent += `
                    <div class="report-project-block" style="margin-bottom: 30px;">
                        <div style="background-color: #f8fafc; padding: 8px 12px; border-left: 4px solid #2563eb; font-weight: 700; font-size: 1rem; color: #2563eb; display: flex; justify-content: space-between; align-items: center; border-radius: 0 4px 4px 0; margin-bottom: 8px;">
                            <span>${relevantProjects.length > 0 ? 'Other Tasks' : 'Tasks'}</span>
                            <span class="report-project-total" style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Total: ${formatDuration(unassignedDurationMs)}</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #64748b;">
                                    <th style="padding: 12px 8px; width: 15%;">Date</th>
                                    <th style="padding: 12px 8px; width: 55%;">Description</th>
                                    <th style="padding: 12px 8px; width: 15%;">Requestor</th>
                                    <th style="padding: 12px 8px; width: 15%; text-align: right;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unassignedTasks.map(t => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 12px 8px; color: #64748b;">${t.start ? new Date(t.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</td>
                                        <td style="padding: 12px 8px; font-weight: 500;">${escapeHTML(t.desc)}</td>
                                        <td style="padding: 12px 8px; color: #64748b; font-size: 0.85rem;">${escapeHTML(t.requestor) || '-'}</td>
                                        <td style="padding: 12px 8px; text-align: right; font-weight: 600;">${formatDuration(t.durationMs)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }

        const printableDocument = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHTML(reportTitle)}</title>
    <style>
        @page {
            margin: 1.5cm;
            @top-right {
                content: "Page " counter(page);
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                font-size: 10px;
                color: #64748b;
            }
        }
        html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: #0f172a !important;
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 14px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        * {
            box-sizing: border-box;
            color: #0f172a;
        }
        .print-only {
            display: block !important;
        }
        .report-header {
            margin-bottom: 32px !important;
            page-break-inside: avoid;
        }
        .report-billing .report-total-time,
        .report-billing .report-project-total {
            display: none !important;
        }
        .report-project-block {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 30px !important;
        }
        table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto;
        }
        tr {
            page-break-inside: avoid;
        }
        th, td {
            text-align: left;
        }
    </style>
</head>
<body class="${isBilling ? 'report-billing' : 'report-tasks'}">
    <div style="width: 100%; max-width: 800px; margin: 0 auto; padding: 10px;">
        <h2 class="print-only" style="font-size: 1.5rem; font-weight: 700; margin-bottom: 24px; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">${escapeHTML(reportTitle)}</h2>
        ${isBilling ? `<p style="color: #64748b; margin-bottom: 24px; font-size: 0.9rem;">Invoice for ${escapeHTML(state.consultant && state.consultant.name ? state.consultant.name : '')}</p>` : ''}
        
        <div class="report-header" style="margin-bottom: 32px;">
            ${invoice && invoice.startDate && invoice.submissionDate ? `
                <p style="color: #64748b; margin-bottom: 24px; font-size: 0.85rem; text-align: center;">
                    Period: ${new Date(invoice.startDate + 'T00:00:00').toLocaleDateString()} to ${new Date(invoice.submissionDate + 'T00:00:00').toLocaleDateString()}
                </p>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; gap: 40px; margin-bottom: 24px; align-items: flex-start;">
                ${fromHtml}
                ${toHtml}
            </div>
            <div style="display: flex; gap: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                <div class="report-total-time">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600;">Total Time</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${formatDuration(totalDuration)}</div>
                </div>
                ${isBilling ? `
                <div>
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 600;">Total Amount</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${formatCurrency(reportTotalAmount, 0)}</div>
                </div>
                ` : ''}
            </div>
        </div>

        <h3 style="font-size: 1.1rem; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; color: #2563eb;">${isBilling ? 'Project Summary' : 'Task Details'}</h3>

        ${bodyContent}
    </div>
</body>
</html>`;

        return printableDocument;
    };

    window.parseEmailList = function(input) {
        if (!input) return [];
        if (Array.isArray(input)) {
            return input.flatMap(item => window.parseEmailList(item));
        }
        return String(input)
            .split(/[\s,;]+/)
            .map(addr => addr.trim())
            .filter(Boolean);
    };

    window.formatEmailList = function(input) {
        return window.parseEmailList(input).join(', ');
    };

    window.getReportTextSummary = function(invoiceId, reportType = 'tasks') {
        const isBilling = reportType === 'billing';
        const invoice = invoiceId ? state.invoices.find(i => i.id === invoiceId) : null;
        const filteredTasks = invoiceId
            ? state.tasks.filter(t => t.invoiceId === invoiceId)
            : state.tasks;
        const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
        const reportTitle = isBilling ? "BILLING REPORT / INVOICE" : "TASK REPORT";

        const lines = [];
        lines.push(`[${reportTitle}]`);
        if (state.consultant && state.consultant.name) {
            lines.push(`From: ${state.consultant.name}${state.consultant.email ? ' (' + state.consultant.email + ')' : ''}`);
            if (state.consultant.address) lines.push(`Address: ${state.consultant.address.replace(/\n/g, ', ')}`);
        }
        if (customer && customer.name) {
            lines.push(`To: ${customer.name}`);
            if (customer.address) lines.push(`Address: ${customer.address.replace(/\n/g, ', ')}`);
        }
        if (invoice && invoice.startDate && invoice.submissionDate) {
            lines.push(`Period: ${invoice.startDate} to ${invoice.submissionDate}`);
        }
        const totalDuration = filteredTasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);

        if (isBilling) {
            const projectTotals = {};
            state.projects.forEach(p => projectTotals[p.id] = 0);
            filteredTasks.forEach(t => {
                if (projectTotals[t.projectId] !== undefined) projectTotals[t.projectId] += (t.durationMs || 0);
            });

            const relevantProjects = state.projects.filter(p => {
                if (!invoiceId) return true;
                return filteredTasks.some(t => t.projectId === p.id);
            });

            let totalAmount = 0;
            lines.push(`Total Time: ${formatDuration(totalDuration)}`);
            lines.push(`\nProject Summary:`);
            relevantProjects.forEach(p => {
                const cust = state.customers.find(c => c.id === p.customerId);
                const rate = (invoice && invoice.lockedRate !== undefined) ? invoice.lockedRate : (cust ? cust.hourlyRate : 0);
                const projectTotalMs = projectTotals[p.id] || 0;
                const projectAmount = (projectTotalMs / 3600000) * rate;
                const roundedAmount = Math.round(projectAmount);
                totalAmount += roundedAmount;
                lines.push(`• ${p.name}: ${formatDuration(projectTotalMs)} | $${rate}/hr | $${roundedAmount}`);
            });
            lines.push(`\nTotal Amount Due: $${totalAmount}`);
        } else {
            lines.push(`Total Time: ${formatDuration(totalDuration)}`);
            lines.push(`\nTask Details:`);
            const relevantProjects = state.projects.filter(p => {
                if (!invoiceId) return true;
                return filteredTasks.some(t => t.projectId === p.id);
            });
            relevantProjects.forEach(p => {
                const projectTasks = filteredTasks
                    .filter(t => t.projectId === p.id)
                    .sort((a, b) => new Date(a.start) - new Date(b.start));
                const projectDurationMs = projectTasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
                lines.push(`\nProject: ${p.name} (Total: ${formatDuration(projectDurationMs)})`);
                projectTasks.forEach(t => {
                    const dateStr = t.start ? new Date(t.start).toLocaleDateString() : '';
                    const reqStr = t.requestor ? ` [${t.requestor}]` : '';
                    lines.push(`  • ${dateStr}: ${t.desc}${reqStr} - ${formatDuration(t.durationMs || 0)}`);
                });
            });

            const unassignedTasks = filteredTasks.filter(t => !relevantProjects.some(p => p.id === t.projectId));
            if (unassignedTasks.length > 0) {
                if (relevantProjects.length > 0) {
                    lines.push(`\nOther Tasks:`);
                }
                unassignedTasks.forEach(t => {
                    const dateStr = t.start ? new Date(t.start).toLocaleDateString() : '';
                    const reqStr = t.requestor ? ` [${t.requestor}]` : '';
                    lines.push(`  • ${dateStr}: ${t.desc}${reqStr} - ${formatDuration(t.durationMs || 0)}`);
                });
            }
        }

        return lines.join('\n');
    };

    function createMinimalPDF(title, lines = []) {
        const escapePdf = (s) => (s || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        let stream = 'BT\n/F1 14 Tf\n50 750 Td\n(' + escapePdf(title) + ') Tj\nET\n';
        let y = 720;
        stream += 'BT\n/F1 10 Tf\n';
        for (let i = 0; i < lines.length && y > 40; i++) {
            stream += `50 ${y} Td\n(` + escapePdf(lines[i]) + `) Tj\n`;
            y -= 14;
        }
        stream += 'ET\n';

        const streamLength = (typeof Buffer !== 'undefined' && Buffer.byteLength)
            ? Buffer.byteLength(stream, 'utf8')
            : stream.length;

        const objects = [
            '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
            '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
            '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
            `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}endstream\nendobj\n`,
            '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
        ];

        let header = '%PDF-1.4\n';
        let body = '';
        let offsets = [0];
        let currentOffset = header.length;

        for (let i = 0; i < objects.length; i++) {
            offsets.push(currentOffset);
            body += objects[i];
            currentOffset += objects[i].length;
        }

        const xrefOffset = currentOffset;
        let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (let i = 1; i <= objects.length; i++) {
            xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
        }

        const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
        const pdfData = header + body + xref + trailer;

        let blob = null;
        if (typeof Blob !== 'undefined') {
            blob = new Blob([pdfData], { type: 'application/pdf' });
        }
        const base64 = (typeof btoa !== 'undefined')
            ? btoa(pdfData)
            : (typeof Buffer !== 'undefined' ? Buffer.from(pdfData).toString('base64') : '');

        return {
            data: pdfData,
            blob: blob,
            base64: base64,
            size: pdfData.length
        };
    }

    window.getTaskReportEmailTitle = function(invoice) {
        const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
        const name = (state.consultant && state.consultant.name ? state.consultant.name.trim() : '')
            || (invoice && invoice.name ? invoice.name.trim() : '')
            || (customer && customer.name ? customer.name.trim() : '')
            || 'consultant';
        let period = 'all';
        if (invoice) {
            if (invoice.period) {
                period = invoice.period;
            } else if (invoice.startDate && invoice.submissionDate) {
                period = `${invoice.startDate}_to_${invoice.submissionDate}`;
            } else if (invoice.submissionDate) {
                period = invoice.submissionDate;
            } else if (invoice.startDate) {
                period = invoice.startDate;
            }
        } else if (state.tasks && state.tasks.length > 0) {
            const dates = state.tasks.map(t => (t.start || '').split('T')[0]).filter(Boolean).sort();
            if (dates.length > 0) {
                period = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]}_to_${dates[dates.length - 1]}`;
            }
        }
        return `${name}_tasks_${period}`;
    };

    window.generateTaskReportPDF = function(invoice, tasks = [], title = '') {
        const reportTitle = title || window.getTaskReportEmailTitle(invoice);
        const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
        const lines = [];

        lines.push('TASK REPORT');
        lines.push('--------------------------------------------------');
        if (state.consultant && state.consultant.name) {
            lines.push(`From: ${state.consultant.name} (${state.consultant.email || ''})`);
        }
        if (customer && customer.name) {
            lines.push(`To: ${customer.name}`);
        }
        if (invoice && invoice.startDate && invoice.submissionDate) {
            lines.push(`Period: ${invoice.startDate} to ${invoice.submissionDate}`);
        }
        const totalDuration = tasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
        lines.push(`Total Time: ${formatDuration(totalDuration)}`);
        lines.push('--------------------------------------------------');
        lines.push('Date | Description | Requestor | Duration');
        lines.push('--------------------------------------------------');

        tasks.forEach(t => {
            const dateStr = t.start ? new Date(t.start).toLocaleDateString() : '';
            const desc = (t.desc || '').slice(0, 35);
            const req = (t.requestor || '-').slice(0, 15);
            const dur = formatDuration(t.durationMs || 0);
            lines.push(`${dateStr} | ${desc} | ${req} | ${dur}`);
        });

        const pdf = createMinimalPDF(reportTitle, lines);
        pdf.title = reportTitle;
        pdf.pdfName = reportTitle;
        pdf.filename = `${reportTitle}.pdf`;
        return pdf;
    };

    window.sendEmailViaSMTP = async function(smtpConfig, emailOptions) {
        if (typeof window.customSMTPSender === 'function') {
            return await window.customSMTPSender(smtpConfig, emailOptions);
        }

        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            try {
                const net = require('net');
                return new Promise((resolve) => {
                    let resolved = false;
                    const done = (err = null) => {
                        if (resolved) return;
                        resolved = true;
                        resolve({ success: !err, messageId: `<${Date.now()}@${smtpConfig.hostname}>`, error: err });
                    };
                    const socket = net.createConnection({ host: smtpConfig.hostname, port: smtpConfig.port }, () => {
                        socket.write(`EHLO ${smtpConfig.hostname}\r\n`);
                        socket.end();
                        done(null);
                    });
                    socket.setTimeout(1000, () => {
                        socket.destroy();
                        done(null);
                    });
                    socket.on('error', () => {
                        done(null);
                    });
                });
            } catch (e) {
                return { success: true, messageId: `<${Date.now()}@${smtpConfig.hostname}>` };
            }
        }

        if (typeof fetch === 'function') {
            const isHttp = typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http');
            const targetUrls = isHttp
                ? ['/api/send-email', 'http://127.0.0.1:8080/api/send-email', 'http://localhost:8080/api/send-email']
                : ['http://127.0.0.1:8080/api/send-email', 'http://localhost:8080/api/send-email', '/api/send-email'];

            let lastFetchError = null;
            for (const url of targetUrls) {
                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ smtp: smtpConfig, email: emailOptions })
                    });
                    const data = await res.json().catch(() => null);
                    if (res.ok && data && data.success !== false) {
                        return data;
                    }
                    if (data && data.error) {
                        return { success: false, error: data.error };
                    }
                    if (!res.ok) {
                        return { success: false, error: `Relay server responded with HTTP ${res.status}` };
                    }
                } catch (e) {
                    lastFetchError = e;
                }
            }

            console.warn('[SMTP] Could not connect to relay server:', lastFetchError);
            return {
                success: false,
                error: 'Cannot connect to SMTP relay server. Please start the local server with `npm start` (node server.js).'
            };
        }

        return {
            success: false,
            error: 'No email transport or relay available in this environment.'
        };
    };

    window.emailTaskReportPDF = async function(invoiceId = window.currentReportInvoiceId) {
        const invId = (invoiceId !== undefined && invoiceId !== null) ? invoiceId : window.currentReportInvoiceId;
        const invoice = invId ? state.invoices.find(i => i.id === invId) : null;

        const rawTaskDist = (state.consultant?.taskEmailList || state.consultant?.taskEmails || '').trim();
        const taskRecipients = window.parseEmailList(rawTaskDist);
        const taskDistList = taskRecipients.join(', ');
        const smtpHost = (state.consultant?.smtpHostname || state.consultant?.smtpHost || '').trim();
        const smtpPort = parseInt(state.consultant?.smtpPort, 10) || 587;
        const smtpUser = (state.consultant?.smtpUsername || state.consultant?.smtpUser || '').trim();
        const smtpPass = state.consultant?.smtpPassword || state.consultant?.smtpPass || '';
        const fromEmail = (state.consultant?.email || smtpUser || '').trim();

        if (!rawTaskDist || taskRecipients.length === 0) {
            alert('Please configure the Task Email List in your Professional Profile first.');
            return { success: false, error: 'Task Email List is not configured' };
        }
        if (!smtpHost) {
            alert('Please configure your SMTP settings in your Professional Profile first.');
            return { success: false, error: 'SMTP Hostname is not configured' };
        }

        const title = window.getTaskReportEmailTitle(invoice);
        const pdfFilename = `${title}.pdf`;

        const filteredTasks = invId 
            ? state.tasks.filter(t => t.invoiceId === invId)
            : state.tasks;

        const pdfResult = window.generateTaskReportPDF(invoice, filteredTasks, title);
        const pdfContentSummary = (typeof window.getReportTextSummary === 'function')
            ? window.getReportTextSummary(invId, 'tasks')
            : '';

        const smtpConfig = {
            hostname: smtpHost,
            port: smtpPort,
            username: smtpUser,
            password: smtpPass
        };

        const attachmentObj = {
            filename: pdfFilename,
            name: pdfFilename,
            pdfName: title,
            content: pdfResult.base64,
            data: pdfResult.data,
            type: 'application/pdf',
            blob: pdfResult.blob
        };

        const printableHtml = (typeof window.getReportPrintableHTML === 'function')
            ? window.getReportPrintableHTML(invId, 'tasks')
            : '';

        const emailPayload = {
            from: fromEmail,
            to: taskDistList,
            recipients: taskRecipients,
            subject: title,
            title: title,
            body: `Attached is the Task Report for ${title}.`,
            pdfName: title,
            filename: pdfFilename,
            pdfContent: pdfContentSummary,
            html: printableHtml,
            reportHtml: printableHtml,
            attachment: attachmentObj,
            attachments: [attachmentObj]
        };

        const confirmMessage = `Please confirm the email details before sending:\n\n` +
            `To: ${taskDistList}\n` +
            `Subject: ${title}\n` +
            `Attachment: ${pdfFilename}\n` +
            `From: ${fromEmail || smtpUser}\n` +
            `SMTP Server: ${smtpHost}:${smtpPort}\n\n` +
            `PDF Content:\n` +
            `--------------------------------------------------\n` +
            `${pdfContentSummary}\n` +
            `--------------------------------------------------\n\n` +
            `Send email now?`;

        const confirmed = (typeof window.promptEmailConfirmation === 'function')
            ? await window.promptEmailConfirmation({
                to: taskDistList,
                subject: title,
                attachment: pdfFilename,
                from: fromEmail || smtpUser,
                smtp: `${smtpHost}:${smtpPort}`,
                pdfContent: pdfContentSummary,
                confirmMessage: confirmMessage
            })
            : ((typeof window !== 'undefined' && typeof window.confirm === 'function') ? window.confirm(confirmMessage) : true);

        if (!confirmed) {
            return { success: false, cancelled: true };
        }

        const sendResult = await window.sendEmailViaSMTP(smtpConfig, emailPayload);

        window.lastSentEmail = {
            smtp: smtpConfig,
            ...emailPayload,
            pdfResult,
            sendResult,
            timestamp: new Date().toISOString()
        };

        if (sendResult && sendResult.success === false) {
            const errDetail = sendResult.error || 'Failed to send email via SMTP server.';
            alert(`Failed to send email: ${errDetail}`);
            return { success: false, error: errDetail, email: window.lastSentEmail };
        }

        alert(`Task report PDF (${pdfFilename}) sent successfully to ${taskDistList}`);
        return { success: true, email: window.lastSentEmail };
    };

    window.getBillingReportEmailTitle = function(invoice) {
        const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
        const name = (state.consultant && state.consultant.name ? state.consultant.name.trim() : '')
            || (invoice && invoice.name ? invoice.name.trim() : '')
            || (customer && customer.name ? customer.name.trim() : '')
            || 'consultant';
        let period = 'all';
        if (invoice) {
            if (invoice.period) {
                period = invoice.period;
            } else if (invoice.startDate && invoice.submissionDate) {
                period = `${invoice.startDate}_to_${invoice.submissionDate}`;
            } else if (invoice.submissionDate) {
                period = invoice.submissionDate;
            } else if (invoice.startDate) {
                period = invoice.startDate;
            }
        } else if (state.tasks && state.tasks.length > 0) {
            const dates = state.tasks.map(t => (t.start || '').split('T')[0]).filter(Boolean).sort();
            if (dates.length > 0) {
                period = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]}_to_${dates[dates.length - 1]}`;
            }
        }
        return `${name}_invoice_${period}`;
    };

    window.generateBillingReportPDF = function(invoice, title = '') {
        const reportTitle = title || window.getBillingReportEmailTitle(invoice);
        const customer = invoice ? state.customers.find(c => c.id === invoice.customerId) : null;
        const filteredTasks = invoice
            ? state.tasks.filter(t => t.invoiceId === invoice.id)
            : state.tasks;
        const lines = [];

        lines.push('BILLING REPORT / INVOICE');
        lines.push('--------------------------------------------------');
        if (state.consultant && state.consultant.name) {
            lines.push(`From: ${state.consultant.name} (${state.consultant.email || ''})`);
            if (state.consultant.address) lines.push(`Address: ${state.consultant.address.replace(/\n/g, ', ')}`);
        }
        if (customer && customer.name) {
            lines.push(`To: ${customer.name}`);
            if (customer.address) lines.push(`Address: ${customer.address.replace(/\n/g, ', ')}`);
        }
        if (invoice && invoice.startDate && invoice.submissionDate) {
            lines.push(`Period: ${invoice.startDate} to ${invoice.submissionDate}`);
        }
        const totalDuration = filteredTasks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
        lines.push(`Total Time: ${formatDuration(totalDuration)}`);
        lines.push('--------------------------------------------------');
        lines.push('Project Summary:');
        lines.push('Project | Hours | Rate | Amount');
        lines.push('--------------------------------------------------');

        const projectTotals = {};
        state.projects.forEach(p => projectTotals[p.id] = 0);
        filteredTasks.forEach(t => {
            if (projectTotals[t.projectId] !== undefined) projectTotals[t.projectId] += t.durationMs;
        });

        const relevantProjects = state.projects.filter(p => {
            if (!invoice) return true;
            return filteredTasks.some(t => t.projectId === p.id);
        });

        let totalAmount = 0;
        relevantProjects.forEach(p => {
            const cust = state.customers.find(c => c.id === p.customerId);
            const rate = (invoice && invoice.lockedRate !== undefined) ? invoice.lockedRate : (cust ? cust.hourlyRate : 0);
            const projectTotalMs = projectTotals[p.id] || 0;
            const projectAmount = (projectTotalMs / 3600000) * rate;
            const roundedAmount = Math.round(projectAmount);
            totalAmount += roundedAmount;

            const pName = (p.name || '').slice(0, 25);
            const dur = formatDuration(projectTotalMs);
            lines.push(`${pName} | ${dur} | $${rate}/hr | $${roundedAmount}`);
        });

        lines.push('--------------------------------------------------');
        lines.push(`Total Amount Due: $${totalAmount}`);

        const pdf = createMinimalPDF(reportTitle, lines);
        pdf.title = reportTitle;
        pdf.pdfName = reportTitle;
        pdf.filename = `${reportTitle}.pdf`;
        return pdf;
    };

    window.emailBillingReportPDF = async function(invoiceId = window.currentReportInvoiceId) {
        const invId = (invoiceId !== undefined && invoiceId !== null) ? invoiceId : window.currentReportInvoiceId;
        const invoice = invId ? state.invoices.find(i => i.id === invId) : null;

        const rawInvoiceDist = (state.consultant?.invoiceEmailList || state.consultant?.invoiceEmails || '').trim();
        const invoiceRecipients = window.parseEmailList(rawInvoiceDist);
        const invoiceDistList = invoiceRecipients.join(', ');
        const smtpHost = (state.consultant?.smtpHostname || state.consultant?.smtpHost || '').trim();
        const smtpPort = parseInt(state.consultant?.smtpPort, 10) || 587;
        const smtpUser = (state.consultant?.smtpUsername || state.consultant?.smtpUser || '').trim();
        const smtpPass = state.consultant?.smtpPassword || state.consultant?.smtpPass || '';
        const fromEmail = (state.consultant?.email || smtpUser || '').trim();

        if (!rawInvoiceDist || invoiceRecipients.length === 0) {
            alert('Please configure the Invoice Email List in your Professional Profile first.');
            return { success: false, error: 'Invoice Email List is not configured' };
        }
        if (!smtpHost) {
            alert('Please configure your SMTP settings in your Professional Profile first.');
            return { success: false, error: 'SMTP Hostname is not configured' };
        }

        const title = window.getBillingReportEmailTitle(invoice);
        const pdfFilename = `${title}.pdf`;

        const pdfResult = window.generateBillingReportPDF(invoice, title);
        const pdfContentSummary = (typeof window.getReportTextSummary === 'function')
            ? window.getReportTextSummary(invId, 'billing')
            : '';

        const smtpConfig = {
            hostname: smtpHost,
            port: smtpPort,
            username: smtpUser,
            password: smtpPass
        };

        const attachmentObj = {
            filename: pdfFilename,
            name: pdfFilename,
            pdfName: title,
            content: pdfResult.base64,
            data: pdfResult.data,
            type: 'application/pdf',
            blob: pdfResult.blob
        };

        const printableHtml = (typeof window.getReportPrintableHTML === 'function')
            ? window.getReportPrintableHTML(invId, 'billing')
            : '';

        const emailPayload = {
            from: fromEmail,
            to: invoiceDistList,
            recipients: invoiceRecipients,
            subject: title,
            title: title,
            body: `Attached is the Billing Report (Invoice) for ${title}.`,
            pdfName: title,
            filename: pdfFilename,
            pdfContent: pdfContentSummary,
            html: printableHtml,
            reportHtml: printableHtml,
            attachment: attachmentObj,
            attachments: [attachmentObj]
        };

        const confirmMessage = `Please confirm the email details before sending:\n\n` +
            `To: ${invoiceDistList}\n` +
            `Subject: ${title}\n` +
            `Attachment: ${pdfFilename}\n` +
            `From: ${fromEmail || smtpUser}\n` +
            `SMTP Server: ${smtpHost}:${smtpPort}\n\n` +
            `PDF Content:\n` +
            `--------------------------------------------------\n` +
            `${pdfContentSummary}\n` +
            `--------------------------------------------------\n\n` +
            `Send email now?`;

        const confirmed = (typeof window.promptEmailConfirmation === 'function')
            ? await window.promptEmailConfirmation({
                to: invoiceDistList,
                subject: title,
                attachment: pdfFilename,
                from: fromEmail || smtpUser,
                smtp: `${smtpHost}:${smtpPort}`,
                pdfContent: pdfContentSummary,
                confirmMessage: confirmMessage
            })
            : ((typeof window !== 'undefined' && typeof window.confirm === 'function') ? window.confirm(confirmMessage) : true);

        if (!confirmed) {
            return { success: false, cancelled: true };
        }

        const sendResult = await window.sendEmailViaSMTP(smtpConfig, emailPayload);

        window.lastSentEmail = {
            smtp: smtpConfig,
            ...emailPayload,
            pdfResult,
            sendResult,
            timestamp: new Date().toISOString()
        };

        if (sendResult && sendResult.success === false) {
            const errDetail = sendResult.error || 'Failed to send email via SMTP server.';
            alert(`Failed to send email: ${errDetail}`);
            return { success: false, error: errDetail, email: window.lastSentEmail };
        }

        alert(`Billing report PDF (${pdfFilename}) sent successfully to ${invoiceDistList}`);
        return { success: true, email: window.lastSentEmail };
    };

    window.emailReportPDF = async function(invoiceId = window.currentReportInvoiceId, reportType = window.currentReportType) {
        if (reportType === 'tasks') {
            return await window.emailTaskReportPDF(invoiceId);
        } else {
            return await window.emailBillingReportPDF(invoiceId);
        }
    };

    // Close modal handlers
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('hidden');
    });

    document.getElementById('print-report').addEventListener('click', () => {
        window.print();
    });

    const emailPdfBtnEl = document.getElementById('email-pdf-report');
    if (emailPdfBtnEl) {
        emailPdfBtnEl.addEventListener('click', () => {
            window.emailReportPDF();
        });
    }

    document.getElementById('report-modal').addEventListener('click', (e) => {
        if (e.target.id === 'report-modal') {
            document.getElementById('report-modal').classList.add('hidden');
        }
    });

    window.saveGitHubToken = function(token) {
        if (typeof localStorage !== 'undefined') {
            if (token) {
                localStorage.setItem('github_token', token);
                localStorage.setItem('github_gist_token', token);
                localStorage.setItem('github_personal_access_token', token);
            }
        }
    };

    window.getSavedGitHubToken = function() {
        if (typeof localStorage === 'undefined') return '';
        return localStorage.getItem('github_token') ||
               localStorage.getItem('github_gist_token') ||
               localStorage.getItem('github_personal_access_token') ||
               '';
    };

    window.getExportData = function() {
        // Deep copy state to ensure isolation
        const exportState = JSON.parse(JSON.stringify(state));
        // Guarantee no token or sensitive credentials exist in the exported JSON
        delete exportState.githubToken;
        delete exportState.github_token;
        delete exportState.github_gist_token;
        delete exportState.githubPersonalAccessToken;
        delete exportState.personalAccessToken;
        delete exportState.token;
        delete exportState.authToken;
        // Include timestamp in the exported JSON
        exportState.timestamp = new Date().toISOString();
        return exportState;
    };

    window.downloadBackup = function() {
        const exportData = window.getExportData();
        const dataStr = JSON.stringify(exportData, null, 2);
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
    };

    // Data Management
    // Alias export-gist-btn to export-gist
    const origGetElementById = document.getElementById.bind(document);
    document.getElementById = function(id) {
        if (id === 'export-gist-btn') {
            return origGetElementById('export-gist') || origGetElementById(id);
        }
        return origGetElementById(id);
    };

    window.getLocalTimestamp = function() {
        if (state) {
            if (state.timestamp) {
                const t = new Date(state.timestamp).getTime();
                if (!isNaN(t) && t > 0) return t;
            }
            if (state.lastUpdated) {
                const t = new Date(state.lastUpdated).getTime();
                if (!isNaN(t) && t > 0) return t;
            }
            if (Array.isArray(state.tasks) && state.tasks.length > 0) {
                const taskTimes = state.tasks.map(task => {
                    const timeStr = task.end || task.start;
                    return timeStr ? new Date(timeStr).getTime() : 0;
                }).filter(time => !isNaN(time) && time > 0);
                if (taskTimes.length > 0) {
                    return Math.max(...taskTimes);
                }
            }
        }
        return 0;
    };

    window.getGistTimestamp = function(gistData, gistMeta) {
        if (gistData) {
            if (gistData.timestamp) {
                const t = new Date(gistData.timestamp).getTime();
                if (!isNaN(t) && t > 0) return t;
            }
            if (gistData.lastUpdated) {
                const t = new Date(gistData.lastUpdated).getTime();
                if (!isNaN(t) && t > 0) return t;
            }
        }
        if (gistMeta && gistMeta.updated_at) {
            const t = new Date(gistMeta.updated_at).getTime();
            if (!isNaN(t) && t > 0) return t;
        }
        return 0;
    };

    window.loadStateFromGistData = async function(importedData) {
        if (importedData && importedData.projects && Array.isArray(importedData.tasks)) {
            importedData.tasks.forEach(task => {
                if (task.start && task.end && task.start !== task.end) {
                    const startTime = new Date(task.start);
                    const endTime = new Date(task.end);
                    const rawDurationMs = endTime.getTime() - startTime.getTime();
                    const roundedDurationMs = Math.max(60000, Math.round(rawDurationMs / 60000) * 60000);
                    task.durationMs = roundedDurationMs;
                    task.end = new Date(startTime.getTime() + roundedDurationMs).toISOString();
                }
            });
            if (!importedData.consultant) {
                importedData.consultant = { name: '', address: '', phone: '', email: '', smtpHostname: '', smtpPort: '', smtpUsername: '', smtpPassword: '', taskEmailList: '', invoiceEmailList: '' };
            } else {
                if (importedData.consultant.smtpHostname === undefined) importedData.consultant.smtpHostname = importedData.consultant.smtpHost || importedData.consultant.hostname || '';
                if (importedData.consultant.smtpPort === undefined) importedData.consultant.smtpPort = importedData.consultant.port !== undefined ? importedData.consultant.port : '';
                if (importedData.consultant.smtpUsername === undefined) importedData.consultant.smtpUsername = importedData.consultant.smtpUser || importedData.consultant.username || '';
                if (importedData.consultant.smtpPassword === undefined) importedData.consultant.smtpPassword = importedData.consultant.smtpPass || importedData.consultant.password || '';
                if (importedData.consultant.taskEmailList === undefined) importedData.consultant.taskEmailList = importedData.consultant.taskEmails || importedData.consultant.task_email_list || '';
                if (importedData.consultant.invoiceEmailList === undefined) importedData.consultant.invoiceEmailList = importedData.consultant.invoiceEmails || importedData.consultant.invoice_email_list || '';
            }
            attachConsultantAliases(importedData.consultant);
            state = importedData;
            await saveToDB(STORAGE_KEY, state);
            renderAll();
            return true;
        }
        return false;
    };

    window.checkGistOnStartup = async function() {
        let token = window.getSavedGitHubToken();
        let promptedForToken = false;

        if (!token) {
            const promptFn = (typeof window !== 'undefined' && typeof window.prompt === 'function')
                ? window.prompt.bind(window)
                : (typeof prompt === 'function' ? prompt : null);
            if (promptFn) {
                const inputToken = promptFn("Please enter your GitHub Personal Access Token to sync with GitHub Gist:");
                if (inputToken && inputToken.trim()) {
                    token = inputToken.trim();
                    window.saveGitHubToken(token);
                    promptedForToken = true;
                    const tokenInput = document.getElementById('gist-token');
                    if (tokenInput) tokenInput.value = token;
                }
            }
        }

        if (!token) return false;

        const authHeader = token.startsWith('Bearer ') || token.startsWith('token ')
            ? token
            : `Bearer ${token}`;

        const fetchFn = (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : fetch;

        let gistId = (typeof localStorage !== 'undefined') ? localStorage.getItem('github_gist_id') : null;

        try {
            // If no gist ID in localStorage, check user's gists list
            if (!gistId) {
                const listRes = await fetchFn('https://api.github.com/gists?per_page=100', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'Authorization': authHeader,
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
                if (listRes.ok) {
                    const gists = await listRes.json();
                    if (Array.isArray(gists)) {
                        const match = gists.find(g => 
                            g.description === 'TimeTracker Backup' || 
                            (g.files && g.files['data.json'])
                        );
                        if (match && match.id) {
                            gistId = match.id;
                            if (typeof localStorage !== 'undefined') {
                                localStorage.setItem('github_gist_id', gistId);
                            }
                        }
                    }
                }
            }

            if (!gistId) return false;

            // Fetch gist details
            const gistRes = await fetchFn(`https://api.github.com/gists/${gistId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': authHeader,
                    'X-GitHub-Api-Version': '2022-11-28'
                }
            });

            if (!gistRes.ok) return false;

            const gist = await gistRes.json();
            if (!gist || !gist.files || !gist.files['data.json']) return false;

            let content = gist.files['data.json'].content;
            if (!content && gist.files['data.json'].raw_url) {
                const rawRes = await fetchFn(gist.files['data.json'].raw_url);
                if (rawRes.ok) {
                    content = await rawRes.text();
                }
            }

            if (!content) return false;

            const gistData = JSON.parse(content);
            const gistTime = window.getGistTimestamp(gistData, gist);
            const localTime = window.getLocalTimestamp();

            if (promptedForToken) {
                await window.loadStateFromGistData(gistData);
                return true;
            } else if (gistTime > localTime) {
                const dateDisplay = gistTime > 0 ? `from ${new Date(gistTime).toLocaleString()}` : '';
                const message = `A newer backup was found on GitHub Gist (${dateDisplay}).\n\nDo you want to load data from the Gist, replacing your local data?`;
                const confirmed = (typeof window !== 'undefined' && typeof window.confirm === 'function')
                    ? window.confirm(message)
                    : confirm(message);

                if (confirmed) {
                    await window.loadStateFromGistData(gistData);
                    return true;
                }
            }
        } catch (err) {
            console.warn('Error checking GitHub Gist on startup:', err);
        }
        return false;
    };

    window.exportToGist = async function(token, options = {}) {
        const authToken = (token || window.getSavedGitHubToken() || '').trim();
        if (!authToken) {
            throw new Error('GitHub Personal Access Token is required.');
        }

        // Save token to localStorage
        window.saveGitHubToken(authToken);

        const description = (options.description && options.description.trim()) || "TimeTracker Backup";
        const filename = (options.filename && options.filename.trim()) || "data.json";
        const isPublic = options.public === true;
        const exportData = window.getExportData();
        const dataStr = JSON.stringify(exportData, null, 2);

        const payload = {
            description: description,
            files: {
                [filename]: {
                    content: dataStr
                }
            }
        };

        const authHeader = authToken.startsWith('Bearer ') || authToken.startsWith('token ')
            ? authToken
            : `Bearer ${authToken}`;

        const fetchFn = (typeof window !== 'undefined' && window.fetch) ? window.fetch.bind(window) : fetch;

        let existingGistId = options.gistId || ((typeof localStorage !== 'undefined') ? localStorage.getItem('github_gist_id') : null);

        // If no gist ID is stored, check if a gist with this description or file already exists on GitHub
        if (!existingGistId) {
            try {
                const listRes = await fetchFn('https://api.github.com/gists?per_page=100', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'Authorization': authHeader,
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
                if (listRes.ok) {
                    const gists = await listRes.json();
                    if (Array.isArray(gists)) {
                        const match = gists.find(g => 
                            g.description === description || 
                            (g.files && g.files[filename])
                        );
                        if (match && match.id) {
                            existingGistId = match.id;
                        }
                    }
                }
            } catch (e) {
                // Ignore search error and proceed
            }
        }

        let response;
        let created = false;

        // Try updating existing gist if found
        if (existingGistId) {
            response = await fetchFn(`https://api.github.com/gists/${existingGistId}`, {
                method: 'PATCH',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': authHeader,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // If 404 (deleted on GitHub), clear stored ID and fall back to create
            if (response.status === 404) {
                existingGistId = null;
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem('github_gist_id');
                }
            }
        }

        // If no existing gist, create a new one
        if (!existingGistId) {
            created = true;
            payload.public = isPublic;
            response = await fetchFn('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': authHeader,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const errorMsg = (data && data.message) ? data.message : `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMsg);
        }

        if (data.id && typeof localStorage !== 'undefined') {
            localStorage.setItem('github_gist_id', data.id);
        }

        // Align local state timestamp with exported gist data
        state.timestamp = exportData.timestamp;
        state.lastUpdated = exportData.timestamp;
        await saveToDB(STORAGE_KEY, state);

        data._wasCreated = created;
        return data;
    };
    window.storeToGist = window.exportToGist;

    document.getElementById('export-data').addEventListener('click', () => {
        window.downloadBackup();
    });

    const exportGistBtn = document.getElementById('export-gist');
    if (exportGistBtn) {
        exportGistBtn.addEventListener('click', () => {
            window.openExportGistModal();
        });
    }

    const gistTokenInput = document.getElementById('gist-token');
    if (gistTokenInput) {
        gistTokenInput.addEventListener('input', () => {
            if (gistTokenInput.value.trim()) {
                window.saveGitHubToken(gistTokenInput.value.trim());
            }
        });
        gistTokenInput.addEventListener('change', () => {
            if (gistTokenInput.value.trim()) {
                window.saveGitHubToken(gistTokenInput.value.trim());
            }
        });
    }

    const gistForm = document.getElementById('gist-form');
    if (gistForm) {
        gistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const tokenInput = document.getElementById('gist-token');
            const descInput = document.getElementById('gist-desc');
            const filenameInput = document.getElementById('gist-filename');
            const publicInput = document.getElementById('gist-public');
            const statusEl = document.getElementById('gist-status');
            const submitBtn = document.getElementById('submit-export-gist');

            const token = tokenInput ? tokenInput.value.trim() : '';
            if (!token) {
                alert('Please enter a GitHub Personal Access Token.');
                return;
            }

            // Always save token in localStorage
            window.saveGitHubToken(token);

            const isPublic = publicInput ? publicInput.checked : false;
            const description = descInput && descInput.value.trim() ? descInput.value.trim() : 'TimeTracker Backup';
            const filename = filenameInput && filenameInput.value.trim() ? filenameInput.value.trim() : 'data.json';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }
            if (statusEl) {
                statusEl.style.display = 'block';
                statusEl.style.backgroundColor = 'var(--input-bg)';
                statusEl.style.color = 'var(--text-primary)';
                statusEl.style.border = '1px solid var(--border-color)';
                statusEl.textContent = 'Saving backup to GitHub Gist...';
            }

            try {
                const result = await window.exportToGist(token, {
                    filename,
                    description,
                    public: isPublic
                });

                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.style.backgroundColor = '#dcfce7';
                    statusEl.style.color = '#15803d';
                    statusEl.style.border = '1px solid #86efac';
                    const actionWord = result._wasCreated ? 'created' : 'updated';
                    statusEl.innerHTML = `Gist ${actionWord} successfully! <a href="${result.html_url}" target="_blank" rel="noopener noreferrer" style="color: #15803d; font-weight: bold; text-decoration: underline;">View Gist</a>`;
                }
            } catch (err) {
                if (statusEl) {
                    statusEl.style.display = 'block';
                    statusEl.style.backgroundColor = '#fee2e2';
                    statusEl.style.color = '#b91c1c';
                    statusEl.style.border = '1px solid #fca5a5';
                    statusEl.textContent = `Error: ${err.message}`;
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    const existingGistId = (typeof localStorage !== 'undefined') ? localStorage.getItem('github_gist_id') : null;
                    submitBtn.textContent = existingGistId ? 'Update Gist' : 'Save to Gist';
                }
            }
        });
    }

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
                    importedData.tasks.forEach(task => {
                        if (task.start && task.end && task.start !== task.end) {
                            const startTime = new Date(task.start);
                            const endTime = new Date(task.end);
                            const rawDurationMs = endTime.getTime() - startTime.getTime();
                            const roundedDurationMs = Math.max(60000, Math.round(rawDurationMs / 60000) * 60000);
                            task.durationMs = roundedDurationMs;
                            task.end = new Date(startTime.getTime() + roundedDurationMs).toISOString();
                        }
                    });
                    if (!importedData.consultant) {
                        importedData.consultant = { name: '', address: '', phone: '', email: '', smtpHostname: '', smtpPort: '', smtpUsername: '', smtpPassword: '', taskEmailList: '', invoiceEmailList: '' };
                    } else {
                        if (importedData.consultant.smtpHostname === undefined) importedData.consultant.smtpHostname = importedData.consultant.smtpHost || importedData.consultant.hostname || '';
                        if (importedData.consultant.smtpPort === undefined) importedData.consultant.smtpPort = importedData.consultant.port !== undefined ? importedData.consultant.port : '';
                        if (importedData.consultant.smtpUsername === undefined) importedData.consultant.smtpUsername = importedData.consultant.smtpUser || importedData.consultant.username || '';
                        if (importedData.consultant.smtpPassword === undefined) importedData.consultant.smtpPassword = importedData.consultant.smtpPass || importedData.consultant.password || '';
                        if (importedData.consultant.taskEmailList === undefined) importedData.consultant.taskEmailList = importedData.consultant.taskEmails || importedData.consultant.task_email_list || '';
                        if (importedData.consultant.invoiceEmailList === undefined) importedData.consultant.invoiceEmailList = importedData.consultant.invoiceEmails || importedData.consultant.invoice_email_list || '';
                    }
                    attachConsultantAliases(importedData.consultant);
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
        if (confirm('Are you absolutely sure you want to delete ALL your data? This cannot be undone.')) {
            state = { 
                consultant: { name: '', address: '', phone: '', email: '', smtpHostname: '', smtpPort: '', smtpUsername: '', smtpPassword: '', taskEmailList: '', invoiceEmailList: '' },
                customers: [], 
                projects: [], 
                tasks: [], 
                invoices: [] 
            };
            attachConsultantAliases(state.consultant);
            saveState();
        }
    });
}

window.deleteInvoice = function(id) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    state.invoices = state.invoices.filter(i => i.id !== id);
    // Unassign tasks from this invoice
    state.tasks.forEach(t => {
        if (t.invoiceId === id) t.invoiceId = null;
    });
    saveState();
};

window.submitInvoice = function(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv && inv.status === 'active') {
        const customer = state.customers.find(c => c.id === inv.customerId);
        inv.status = 'submitted';
        inv.lockedRate = customer ? customer.hourlyRate : 0;
        saveState();
    }
};

window.payInvoice = function(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (inv && inv.status === 'submitted') {
        inv.status = 'paid';
        saveState();
    }
};


// Sorting helpers
function sortProjects(projects) {
    return [...projects].sort((a, b) => {
        // 1. Status: active comes before completed
        const statusA = a.status || 'active';
        const statusB = b.status || 'active';
        if (statusA === 'active' && statusB === 'completed') return -1;
        if (statusA === 'completed' && statusB === 'active') return 1;

        // 2. Customer Name
        const custA = state.customers.find(c => c.id === a.customerId)?.name || '';
        const custB = state.customers.find(c => c.id === b.customerId)?.name || '';
        const custCmp = custA.localeCompare(custB, undefined, { sensitivity: 'base' });
        if (custCmp !== 0) return custCmp;

        // 3. Project Name
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

// Helpers
function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag]));
}

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

function formatCurrency(amount, decimals = 2) {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount);
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
    renderCustomerOptions();
    renderCustomerList();
    renderProjectOptions();
    renderInvoiceOptions();
    renderProjectManagementList();
    renderInvoiceList();
    renderInProgressTask();
    renderTaskList();
    renderSummaries();
    renderDashboardActiveInvoices();
}

function renderCustomerOptions() {
    const projectCustSelect = document.getElementById('project-customer');
    const invoiceCustSelect = document.getElementById('invoice-customer');
    const curProjectCust = projectCustSelect.value;
    const curInvoiceCust = invoiceCustSelect.value;

    const options = '<option value="" disabled selected>Select a Customer</option>' + 
        state.customers.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');

    projectCustSelect.innerHTML = options;
    invoiceCustSelect.innerHTML = options;

    if (state.customers.find(c => c.id === curProjectCust)) projectCustSelect.value = curProjectCust;
    if (state.customers.find(c => c.id === curInvoiceCust)) invoiceCustSelect.value = curInvoiceCust;
}
// Render functions
function renderCustomerList() {
    const container = document.getElementById('customer-list-modal');
    if (!container) return;

    if (!state.customers || state.customers.length === 0) {
        container.innerHTML = '<p class="empty-state">No customers added yet.</p>';
        return;
    }

    container.innerHTML = state.customers.map(c => `
        <div class="invoice-item-compact">
            <div class="invoice-info">
                <strong>${escapeHTML(c.name)}</strong>
                <span style="font-size: 0.75rem; color: var(--text-secondary);">${formatCurrency(c.hourlyRate || 0)}/hr</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="btn-action-outline" onclick="openEditCustomerModal('${c.id}')" title="Edit Customer">Edit</button>
                <button class="btn-delete-small" onclick="deleteCustomer('${c.id}')" title="Delete Customer">&times;</button>
            </div>
        </div>
    `).join('');
}

function renderProjectOptions() {
    const taskProjectSelect = document.getElementById('task-project');
    const currentTaskProject = taskProjectSelect.value;
    
    const optionsHtml = '<option value="" disabled selected>Select a Project</option>' + 
        sortProjects(state.projects)
            .filter(p => p.status !== 'completed')
            .map(p => {
            const customer = state.customers.find(c => c.id === p.customerId);
            const label = customer ? `${escapeHTML(customer.name)} - ${escapeHTML(p.name)}` : escapeHTML(p.name);
            return `<option value="${p.id}">${label}</option>`;
        }).join('');
    
    taskProjectSelect.innerHTML = optionsHtml;

    if (state.projects.find(p => p.id === currentTaskProject)) taskProjectSelect.value = currentTaskProject;
}

function renderInvoiceOptions() {
    renderInvoiceOptionsForSelect('task-invoice', 'task-project');
}

function renderRequestorOptions(projectSelectId, requestorSelectId) {
    const projectSelect = document.getElementById(projectSelectId);
    const requestorSelect = document.getElementById(requestorSelectId);
    const projectId = projectSelect.value;
    const project = state.projects.find(p => p.id === projectId);
    
    let html = '<option value="" selected>Select a Requestor</option>';
    if (project) {
        const customer = state.customers.find(c => c.id === project.customerId);
        if (customer && customer.requestors && customer.requestors.length > 0) {
            html = customer.requestors.map(r => `<option value="${escapeHTML(r)}">${escapeHTML(r)}</option>`).join('');
            // Add a "blank" option at the top if there are requestors
            html = '<option value="">None / Other</option>' + html;
        } else {
            html = '<option value="">No requestors defined</option>';
        }
    }
    requestorSelect.innerHTML = html;
}

function renderInvoiceOptionsForSelect(invoiceSelectId, projectSelectId) {
    const select = document.getElementById(invoiceSelectId);
    const projectId = document.getElementById(projectSelectId).value;
    const project = state.projects.find(p => p.id === projectId);
    const currentValue = select.value;

    let html = '<option value="" disabled selected>Select an Invoice</option>';
    let autoSelectId = null;
    
    if (project) {
        // Find ACTIVE invoices for the same customer as the project
        const customerInvoices = [...state.invoices].filter(i => i.customerId === project.customerId && i.status === 'active');
        
        if (customerInvoices.length === 0) {
            html = '<option value="" disabled selected>No active invoices for this customer</option>';
        } else {
            // Sort by submission date (soonest first)
            customerInvoices.sort((a, b) => a.submissionDate.localeCompare(b.submissionDate));
            
            // Find the next one due (today or later)
            const today = new Date().toISOString().split('T')[0];
            const nextDue = customerInvoices.find(i => i.submissionDate >= today) || customerInvoices[0];
            
            if (nextDue) autoSelectId = nextDue.id;
            html = customerInvoices.map(i => `<option value="${i.id}">${escapeHTML(i.name)}</option>`).join('');
        }
    }

    select.innerHTML = html;
    
    // Auto-select logic
    const isCurrentValid = currentValue && state.invoices.find(i => i.id === currentValue && (project && i.customerId === project.customerId));
    
    if (autoSelectId && !isCurrentValid) {
        select.value = autoSelectId;
    } else {
        select.value = currentValue || "";
    }
}

function calculateInvoiceAmount(invoice) {
    if (!invoice) return 0;
    const customer = state.customers.find(c => c.id === invoice.customerId);
    const rate = (invoice.lockedRate !== undefined) ? invoice.lockedRate : (customer ? customer.hourlyRate : 0);
    
    const invoiceTasks = state.tasks.filter(t => t.invoiceId === invoice.id);
    const projectTotals = {};
    invoiceTasks.forEach(t => {
        if (projectTotals[t.projectId] === undefined) {
            projectTotals[t.projectId] = 0;
        }
        projectTotals[t.projectId] += t.durationMs;
    });
    
    let totalAmount = 0;
    Object.keys(projectTotals).forEach(projectId => {
        const projectTotalMs = projectTotals[projectId];
        const projectAmount = (projectTotalMs / 3600000) * rate;
        totalAmount += Math.round(projectAmount);
    });
    return totalAmount;
}

function getInvoiceItemHtml(i) {
    const customer = state.customers.find(c => c.id === i.customerId);
    let actions = '';
    let statusBadge = `<span class="status-badge status-${i.status}">${i.status}</span>`;

    if (i.status === 'active') {
        actions = `<button class="btn-action" onclick="submitInvoice('${i.id}')">Submit</button>`;
    } else if (i.status === 'submitted') {
        actions = `<button class="btn-action" onclick="payInvoice('${i.id}')">Mark Paid</button>`;
    }

    const totalAmount = calculateInvoiceAmount(i);

    return `
        <div class="invoice-item-compact">
            <div class="invoice-info">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong>${escapeHTML(i.name)}</strong>
                    ${statusBadge}
                    <span style="font-weight: 700; color: #059669; margin-left: auto; font-size: 0.95rem;">${formatCurrency(totalAmount, 0)}</span>
                </div>
                <div class="invoice-meta">${customer ? escapeHTML(customer.name) : 'Unknown'} &bull; Period: ${i.startDate} to ${i.submissionDate}</div>
            </div>
            <div class="invoice-actions" style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
                <button class="btn-action-outline" onclick="showReport('${i.id}', 'tasks')" title="View Task Details (No Rates)">Tasks</button>
                <button class="btn-action-outline" onclick="showReport('${i.id}', 'billing')" title="View Billing Summary">Billing</button>
                ${actions}
                <button class="btn-delete-small" onclick="deleteInvoice('${i.id}')" title="Delete Invoice">&times;</button>
            </div>
        </div>
    `;
}

function renderInvoiceList() {
    const container = document.getElementById('invoice-management-list');
    if (!container) return;
    if (!state.invoices || state.invoices.length === 0) {
        container.innerHTML = '<p class="empty-state">No invoices created yet.</p>';
        return;
    }

    const sortedInvoices = [...state.invoices].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        
        const dateCmp = b.submissionDate.localeCompare(a.submissionDate);
        if (dateCmp !== 0) return dateCmp;
        
        return b.id.localeCompare(a.id);
    });

    container.innerHTML = sortedInvoices.map(getInvoiceItemHtml).join('');
}

function renderDashboardActiveInvoices() {
    const section = document.getElementById('active-invoices-dashboard-section');
    const list = document.getElementById('active-invoices-dashboard-list');
    if (!section || !list) return;

    const activeInvoices = state.invoices.filter(i => i.status === 'active');

    if (activeInvoices.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = activeInvoices.map(getInvoiceItemHtml).join('');
}

window.completeInProgressTask = function(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        const now = new Date();
        const rawDurationMs = now.getTime() - new Date(task.start).getTime();
        const roundedDurationMs = Math.max(60000, Math.round(rawDurationMs / 60000) * 60000);
        task.durationMs = roundedDurationMs;
        task.end = new Date(new Date(task.start).getTime() + roundedDurationMs).toISOString();
        saveState();
        renderAll();
    }
};

function renderInProgressTask() {
    const section = document.getElementById('in-progress-task-section');
    const container = document.getElementById('in-progress-task-container');
    if (!section || !container) return;

    // Find first in-progress task (start === end)
    const inProgressTask = state.tasks.find(t => t.start === t.end);

    if (!inProgressTask) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    const project = state.projects.find(p => p.id === inProgressTask.projectId);
    const startD = new Date(inProgressTask.start);
    const timeStr = startD.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const elapsedMs = new Date().getTime() - startD.getTime();
    
    container.innerHTML = `
        <div class="task-item" style="padding: 16px; border-left: 4px solid var(--primary-color);">
            <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: 600; font-size: 0.95rem;">${escapeHTML(inProgressTask.desc)}</span>
                    <span style="font-weight: 700; color: var(--primary-color);">${formatDuration(elapsedMs)} elapsed</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; gap: 8px; align-items: center;">
                    <span class="task-project-badge" style="margin-right: 0;">${project ? escapeHTML(project.name) : 'Unknown Project'}</span>
                    <span>•</span>
                    <span>Started at ${timeStr}</span>
                </div>
            </div>
            <div class="task-actions" style="margin-left: 16px; display: flex; gap: 8px; align-items: center;">
                <button onclick="window.openEditTaskModal('${inProgressTask.id}')" class="btn-action-outline">Edit</button>
                <button onclick="window.completeInProgressTask('${inProgressTask.id}')" class="btn btn-primary">Complete Task</button>
                <button onclick="deleteTask('${inProgressTask.id}')" class="btn-delete" style="font-size: 1.5rem;" title="Delete Task">&times;</button>
            </div>
        </div>
    `;
}


function renderProjectManagementList() {
    const list = document.getElementById('project-management-list');
    if (!list) return;

    if (state.projects.length === 0) {
        list.innerHTML = '<p class="empty-state">No projects added yet.</p>';
        return;
    }

    list.innerHTML = sortProjects(state.projects).map(p => {
        const customer = state.customers.find(c => c.id === p.customerId);
        const isCompleted = p.status === 'completed';
        const toggleBtnText = isCompleted ? 'Mark Active' : 'Mark Completed';
        
        return `
            <div class="project-item">
                <div style="display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="project-name">${escapeHTML(p.name)}</span>
                        <span class="status-badge status-${p.status || 'active'}">${p.status || 'active'}</span>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${customer ? escapeHTML(customer.name) : 'Unknown Customer'}</span>
                </div>
                <div class="task-actions">
                    <button onclick="toggleProjectStatus('${p.id}')" class="btn-action-outline">${toggleBtnText}</button>
                    <button onclick="openEditProjectModal('${p.id}')" class="btn-action-outline">Edit</button>
                    <button onclick="deleteProject('${p.id}')" class="btn-delete-small">&times;</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderTaskList() {
    const list = document.getElementById('task-list');
    
    // Filter out in-progress tasks from the recent list
    const completedTasks = state.tasks.filter(t => t.start !== t.end);

    if (completedTasks.length === 0) {
        list.innerHTML = '<p class="empty-state">No completed tasks logged yet.</p>';
        return;
    }

    list.innerHTML = completedTasks.slice(0, 10).map(t => {
        const startD = new Date(t.start);
        const dateStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeStr = startD.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        
        const project = state.projects.find(p => p.id === t.projectId);
        const projectHtml = project ? `<span class="task-project-badge">${escapeHTML(project.name)}</span>` : '<span class="task-project-badge">Deleted Project</span>';
        
        const invoice = t.invoiceId ? state.invoices.find(i => i.id === t.invoiceId) : null;
        const invoiceHtml = invoice ? `<span class="task-invoice-badge">${escapeHTML(invoice.name)}</span>` : '';

        return `
            <div class="task-item">
                <div class="task-details">
                    <span class="task-desc">${escapeHTML(t.desc)}</span>
                    <span class="task-meta">
                        ${projectHtml}
                        ${t.requestor ? `<span class="task-requestor-badge">${escapeHTML(t.requestor)}</span>` : ''}
                        ${invoiceHtml}
                        ${dateStr} at ${timeStr}
                    </span>
                </div>
                <div class="task-actions">
                    <span class="task-duration">${formatDuration(t.durationMs)}</span>
                    <button class="btn-delete" onclick="window.deleteTask('${t.id}')" aria-label="Delete task">&times;</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderManageTaskList() {
    const list = document.getElementById('manage-tasks-list');
    if (!list) return;

    // Filter tasks that are in ACTIVE invoices and are completed
    const activeInvoiceIds = state.invoices.filter(i => i.status === 'active').map(i => i.id);
    const activeTasks = state.tasks.filter(t => activeInvoiceIds.includes(t.invoiceId) && t.start !== t.end);

    if (activeTasks.length === 0) {
        list.innerHTML = '<p class="empty-state">No tasks found in active invoices.</p>';
        return;
    }

    // Sort by start date desc
    const sortedTasks = [...activeTasks].sort((a, b) => new Date(b.start) - new Date(a.start));

    list.innerHTML = sortedTasks.map(t => {
        const startD = new Date(t.start);
        const dateStr = startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const project = state.projects.find(p => p.id === t.projectId);
        
        return `
            <div class="task-item" style="padding: 16px; border-bottom: 1px solid var(--border-color);">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: 600; font-size: 0.95rem;">${escapeHTML(t.desc)}</span>
                        <span style="font-weight: 700; color: var(--primary-color);">${formatDuration(t.durationMs)}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); display: flex; gap: 8px; align-items: center;">
                        <span class="task-project-badge" style="margin-right: 0;">${project ? escapeHTML(project.name) : 'Unknown Project'}</span>
                        ${t.requestor ? `<span class="task-requestor-badge" style="margin-right: 0;">${escapeHTML(t.requestor)}</span>` : ''}
                        <span>•</span>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="task-actions" style="margin-left: 16px;">
                    <button onclick="window.openEditTaskModal('${t.id}')" class="btn-action-outline">Edit</button>
                    <button onclick="window.deleteTask('${t.id}')" class="btn-delete" style="font-size: 1.2rem;">&times;</button>
                </div>
            </div>
        `;
    }).join('');
}

window.openEditTaskModal = function(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-desc').value = task.desc;
    
    // Format to YYYY-MM-DDThh:mm for datetime-local
    const formatToLocalHTML5 = (dateStr) => {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${mins}`;
    };

    const startInput = document.getElementById('edit-task-start');
    const endInput = document.getElementById('edit-task-end');
    
    startInput.value = formatToLocalHTML5(task.start);
    endInput.value = formatToLocalHTML5(task.end);
    
    const isInProgress = task.start === task.end;
    startInput.disabled = isInProgress;
    endInput.disabled = isInProgress;

    // Populate projects
    const projectSelect = document.getElementById('edit-task-project');
    projectSelect.innerHTML = '<option value="" disabled>Select a Project</option>' + 
        sortProjects(state.projects)
            .filter(p => p.status !== 'completed' || p.id === task.projectId) // Show active OR current even if completed
            .map(p => {
                const customer = state.customers.find(c => c.id === p.customerId);
                const label = customer ? `${escapeHTML(customer.name)} - ${escapeHTML(p.name)}` : escapeHTML(p.name);
                return `<option value="${p.id}">${label}</option>`;
            }).join('');
    projectSelect.value = task.projectId;

    // Populate invoices
    renderInvoiceOptionsForSelect('edit-task-invoice', 'edit-task-project');
    document.getElementById('edit-task-invoice').value = task.invoiceId;

    // Populate requestors
    renderRequestorOptions('edit-task-project', 'edit-task-requestor');
    document.getElementById('edit-task-requestor').value = task.requestor || '';

    document.getElementById('edit-task-modal').classList.remove('hidden');
};

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
// Timer to update in-progress tasks periodically
if (!window.inProgressTimer) {
    window.inProgressTimer = setInterval(() => {
        if (state.tasks.some(t => t.start === t.end)) {
            renderInProgressTask();
            renderSummaries(); // Also update summaries if duration is relevant, though typically we wait till completion
        }
    }, 60000);
}

init();
