// State & Storage
const STORAGE_KEY = 'timeTrackerState';
let state = {
    consultant: { name: '', address: '', phone: '', email: '' },
    customers: [], // { id, name }
    projects: [],  // { id, name, customerId }
    tasks: [],     // { id, desc, projectId, start, end, durationMs, invoiceId }
    invoices: []   // { id, name, customerId, submissionDate }
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

window.openEditProjectModal = function(id) {
    const project = state.projects.find(p => p.id === id);
    if (!project) return;
    
    document.getElementById('edit-project-id').value = project.id;
    document.getElementById('edit-project-name').value = project.name;
    
    // Populate customer select in edit modal
    const customerSelect = document.getElementById('edit-project-customer');
    customerSelect.innerHTML = '<option value="" disabled>Select a Customer</option>' + 
        state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    customerSelect.value = project.customerId;
    
    document.getElementById('edit-project-modal').classList.remove('hidden');
};

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            
            // Ensure all customers have an hourlyRate and address
            if (parsed.customers) {
                parsed.customers.forEach(c => {
                    if (c.hourlyRate === undefined) c.hourlyRate = 0;
                    if (c.address === undefined) c.address = '';
                });
            }
            if (!parsed.consultant) {
                parsed.consultant = { name: '', address: '', phone: '', email: '' };
            }
            
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

            state = parsed;
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
    // Set Consultant Initial values
    document.getElementById('consultant-name').value = state.consultant.name || '';
    document.getElementById('consultant-address').value = state.consultant.address || '';
    document.getElementById('consultant-phone').value = state.consultant.phone || '';
    document.getElementById('consultant-email').value = state.consultant.email || '';

    // Event Listeners
    document.getElementById('consultant-form').addEventListener('submit', (e) => {
        e.preventDefault();
        state.consultant = {
            name: document.getElementById('consultant-name').value.trim(),
            address: document.getElementById('consultant-address').value.trim(),
            phone: document.getElementById('consultant-phone').value.trim(),
            email: document.getElementById('consultant-email').value.trim()
        };
        saveState();
        alert('Profile saved!');
        window.closeConsultantModal();
    });

    // Toolbar Listeners
    document.getElementById('toolbar-profile').addEventListener('click', () => {
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

    document.getElementById('close-consultant-modal').addEventListener('click', window.closeConsultantModal);
    document.getElementById('cancel-consultant').addEventListener('click', window.closeConsultantModal);
    
    document.getElementById('close-add-customer').addEventListener('click', window.closeAddCustomerModal);
    document.getElementById('cancel-add-customer').addEventListener('click', window.closeAddCustomerModal);

    document.getElementById('close-project-management').addEventListener('click', window.closeProjectManagementModal);
    document.getElementById('close-invoice-management').addEventListener('click', window.closeInvoiceManagementModal);
    
    document.getElementById('close-edit-project').addEventListener('click', window.closeEditProjectModal);
    document.getElementById('cancel-edit-project').addEventListener('click', window.closeEditProjectModal);

    document.getElementById('customer-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('customer-name');
        const rateInput = document.getElementById('customer-rate');
        const addressInput = document.getElementById('customer-address');
        const name = nameInput.value.trim();
        const rate = parseFloat(rateInput.value) || 0;
        const address = addressInput.value.trim();

        if (name) {
            const customer = { 
                id: Date.now().toString(), 
                name: name,
                hourlyRate: rate,
                address: address
            };
            state.customers.push(customer);
            nameInput.value = '';
            rateInput.value = '';
            addressInput.value = '';
            saveState();
        }
    });

    document.getElementById('edit-customer-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-customer-id').value;
        const name = document.getElementById('edit-customer-name').value.trim();
        const rate = parseFloat(document.getElementById('edit-customer-rate').value) || 0;
        const address = document.getElementById('edit-customer-address').value.trim();

        const customer = state.customers.find(c => c.id === id);
        if (customer) {
            customer.name = name;
            customer.hourlyRate = rate;
            customer.address = address;
            saveState();
            alert('Customer updated!');
            window.closeEditCustomerModal();
        }
    });

    // Helper for "Set to Now"
    const setTimeToNow = (inputId) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        document.getElementById(inputId).value = `${year}-${month}-${day}T${hours}:${mins}`;
    };

    const setStartNowBtn = document.getElementById('set-start-now');
    const setEndNowBtn = document.getElementById('set-end-now');
    if (setStartNowBtn) setStartNowBtn.addEventListener('click', () => setTimeToNow('task-start'));
    if (setEndNowBtn) setEndNowBtn.addEventListener('click', () => setTimeToNow('task-end'));

    document.getElementById('edit-project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-project-id').value;
        const name = document.getElementById('edit-project-name').value.trim();
        const customerId = document.getElementById('edit-project-customer').value;
        const project = state.projects.find(p => p.id === id);
        if (project && name && customerId) {
            project.name = name;
            project.customerId = customerId;
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
                customerId: customerInput.value
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

        if (endTime <= startTime) {
            alert("End time must be after start time.");
            return;
        }

        if (!invoiceInput.value) {
            alert("An active invoice is required to log a task.");
            return;
        }

        const task = {
            id: Date.now().toString(),
            desc: descInput.value.trim(),
            projectId: projectInput.value,
            invoiceId: invoiceInput.value,
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
        window.showReport();
    });

    window.showReport = function(invoiceId = null, reportType = 'billing') {
        const now = new Date();
        const invoice = invoiceId ? state.invoices.find(i => i.id === invoiceId) : null;
        const isGlobal = !invoiceId;
        const isBilling = reportType === 'billing' || isGlobal;
        const isTaskDetail = reportType === 'tasks';
        
        // Filter tasks
        const filteredTasks = invoiceId 
            ? state.tasks.filter(t => t.invoiceId === invoiceId)
            : state.tasks;

        const reportTitle = invoice 
            ? (isBilling ? `Billing Summary: ${invoice.name}` : `Task Detail Report: ${invoice.name}`)
            : "Summary Dashboard";
            
        const totalDuration = filteredTasks.reduce((sum, t) => sum + t.durationMs, 0);

        // Address display
        let fromHtml = '';
        if (state.consultant && state.consultant.name) {
            fromHtml = `
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; margin-bottom: 4px;">From</div>
                    <div style="font-weight: 700; font-size: 1rem;">${state.consultant.name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line;">${state.consultant.address}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${state.consultant.email} ${state.consultant.phone ? '| ' + state.consultant.phone : ''}</div>
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
                        <div style="font-weight: 700; font-size: 1rem;">${customer.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); white-space: pre-line;">${customer.address}</div>
                    </div>
                `;
            }
        }

        let html = `
            <div style="font-family: Inter, sans-serif; color: #0f172a;">
                <p style="color: #64748b; margin-bottom: 24px; font-size: 0.9rem;">Report Generated on ${now.toLocaleString()}</p>
                
                <h3 style="font-size: 1.1rem; margin-bottom: 24px; text-align: center; border-bottom: 2px solid var(--border-color); padding-bottom: 12px; color: var(--primary-color);">${reportTitle}</h3>
                
                ${invoice && invoice.startDate && invoice.submissionDate ? `
                    <p style="color: #64748b; margin-top: -16px; margin-bottom: 24px; font-size: 0.85rem; text-align: center;">
                        Period: ${new Date(invoice.startDate + 'T00:00:00').toLocaleDateString()} to ${new Date(invoice.submissionDate + 'T00:00:00').toLocaleDateString()}
                    </p>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; gap: 40px; margin-bottom: 32px; align-items: flex-start;">
                    ${fromHtml}
                    ${toHtml}
                </div>

                <div style="display: flex; gap: 40px; margin-bottom: 32px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Total Time</div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${formatDuration(totalDuration)}</div>
                    </div>
                    ${isBilling ? `
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">Total Amount</div>
                        <div id="report-total-amount" style="font-size: 1.5rem; font-weight: 700; color: #059669;">$0.00</div>
                    </div>
                    ` : ''}
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
            // BILLING REPORT: Show Projects with costs
            relevantProjects.forEach(p => {
                const customer = state.customers.find(c => c.id === p.customerId);
                const rate = (invoice && invoice.lockedRate !== undefined) ? invoice.lockedRate : (customer ? customer.hourlyRate : 0);
                const projectTotalMs = projectTotals[p.id] || 0;
                const projectAmount = (projectTotalMs / 3600000) * rate;
                const roundedAmount = Math.round(projectAmount);
                reportTotalAmount += roundedAmount;

                html += `
                    <div style="margin-bottom: 16px; padding: 12px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid var(--primary-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 600;">${p.name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatDuration(projectTotalMs)} at ${formatCurrency(rate)}/hr</div>
                        </div>
                        <div style="font-weight: 700; font-size: 1.1rem; color: var(--primary-color);">${formatCurrency(roundedAmount, 0)}</div>
                    </div>
                `;
            });
        } else {
            // TASK REPORT: Show individual tasks, NO costs
            relevantProjects.forEach(p => {
                const projectTasks = filteredTasks.filter(t => t.projectId === p.id);
                html += `
                    <div style="margin-bottom: 24px;">
                        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 12px; color: var(--text-secondary);">${p.name}</div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--border-color); text-align: left; color: var(--text-secondary);">
                                    <th style="padding: 8px 0;">Date</th>
                                    <th style="padding: 8px 0;">Description</th>
                                    <th style="padding: 8px 0; text-align: right;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${projectTasks.map(t => `
                                    <tr style="border-bottom: 1px solid #f1f5f9;">
                                        <td style="padding: 8px 0; white-space: nowrap;">${new Date(t.start).toLocaleDateString()}</td>
                                        <td style="padding: 8px 16px; color: #475569;">${t.desc}</td>
                                        <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatDuration(t.durationMs)}</td>
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
            const amountElement = document.getElementById('report-total-amount');
            if (amountElement) amountElement.textContent = formatCurrency(reportTotalAmount, 0);
        }
        
        document.getElementById('report-modal').classList.remove('hidden');
    };

    // Close modal handlers
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('report-modal').classList.add('hidden');
    });

    document.getElementById('print-report').addEventListener('click', () => {
        window.print();
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
        if (confirm('Are you absolutely sure you want to delete ALL your data? This cannot be undone.')) {
            state = { customers: [], projects: [], tasks: [], invoices: [] };
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
    renderProjectList();
    renderProjectManagementList();
    renderInvoiceList();
    renderTaskList();
    renderSummaries();
}

function renderCustomerOptions() {
    const projectCustSelect = document.getElementById('project-customer');
    const invoiceCustSelect = document.getElementById('invoice-customer');
    const curProjectCust = projectCustSelect.value;
    const curInvoiceCust = invoiceCustSelect.value;

    const options = '<option value="" disabled selected>Select a Customer</option>' + 
        state.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

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
                <strong>${c.name}</strong>
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
        state.projects.map(p => {
            const customer = state.customers.find(c => c.id === p.customerId);
            const label = customer ? `${customer.name} - ${p.name}` : p.name;
            return `<option value="${p.id}">${label}</option>`;
        }).join('');
    
    taskProjectSelect.innerHTML = optionsHtml;

    if (state.projects.find(p => p.id === currentTaskProject)) taskProjectSelect.value = currentTaskProject;
}

function renderInvoiceOptions() {
    const select = document.getElementById('task-invoice');
    const projectId = document.getElementById('task-project').value;
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
            html = customerInvoices.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
        }
    }

    select.innerHTML = html;
    
    // Auto-select logic: if we have a "best" invoice and 
    // either no value is selected OR the current selection is no longer valid
    const isCurrentValid = currentValue && state.invoices.find(i => i.id === currentValue && (project && i.customerId === project.customerId));
    
    if (autoSelectId && !isCurrentValid) {
        select.value = autoSelectId;
    } else {
        select.value = currentValue || "";
    }
}

function renderInvoiceList() {
    const container = document.getElementById('invoice-management-list');
    if (!container) return;
    if (!state.invoices || state.invoices.length === 0) {
        container.innerHTML = '<p class="empty-state">No invoices created yet.</p>';
        return;
    }

    container.innerHTML = state.invoices.map(i => {
        const customer = state.customers.find(c => c.id === i.customerId);
        let actions = '';
        let statusBadge = `<span class="status-badge status-${i.status}">${i.status}</span>`;

        if (i.status === 'active') {
            actions = `<button class="btn-action" onclick="submitInvoice('${i.id}')">Submit</button>`;
        } else if (i.status === 'submitted') {
            actions = `<button class="btn-action" onclick="payInvoice('${i.id}')">Mark Paid</button>`;
        }

        return `
            <div class="invoice-item-compact">
                <div class="invoice-info">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <strong>${i.name}</strong>
                        ${statusBadge}
                    </div>
                    <span class="invoice-meta">${customer ? customer.name : 'Unknown'} &bull; Period: ${i.startDate} to ${i.submissionDate}</span>
                </div>
                <div class="invoice-actions" style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn-action-outline" onclick="showReport('${i.id}', 'tasks')" title="View Task Details (No Rates)">Tasks</button>
                    <button class="btn-action-outline" onclick="showReport('${i.id}', 'billing')" title="View Billing Summary">Billing</button>
                    ${actions}
                    <button class="btn-delete-small" onclick="deleteInvoice('${i.id}')" title="Delete Invoice">&times;</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderProjectList() {
    const list = document.getElementById('project-list');
    
    if (state.projects.length === 0) {
        list.innerHTML = '<p class="empty-state">No projects added yet.</p>';
        return;
    }

    // Calculate totals per project
    const totals = {};
    state.projects.forEach(p => totals[p.id] = 0);
    
    state.tasks.forEach(t => {
        if (totals[t.projectId] !== undefined) {
            totals[t.projectId] += t.durationMs;
        }
    });

    list.innerHTML = state.projects.map(p => {
        const customer = state.customers.find(c => c.id === p.customerId);
        return `
            <div class="project-item">
                <div style="display: flex; flex-direction: column;">
                    <span class="project-name">${p.name}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${customer ? customer.name : 'Unknown'}</span>
                </div>
                <span class="project-time">${formatDuration(totals[p.id])}</span>
            </div>
        `;
    }).join('');
}

function renderProjectManagementList() {
    const list = document.getElementById('project-management-list');
    if (!list) return;

    if (state.projects.length === 0) {
        list.innerHTML = '<p class="empty-state">No projects added yet.</p>';
        return;
    }

    list.innerHTML = state.projects.map(p => {
        const customer = state.customers.find(c => c.id === p.customerId);
        return `
            <div class="project-item">
                <div style="display: flex; flex-direction: column;">
                    <span class="project-name">${p.name}</span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${customer ? customer.name : 'Unknown Customer'}</span>
                </div>
                <div class="task-actions">
                    <button onclick="openEditProjectModal('${p.id}')" class="btn-action-outline">Edit</button>
                    <button onclick="deleteProject('${p.id}')" class="btn-delete-small">&times;</button>
                </div>
            </div>
        `;
    }).join('');
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
        
        const project = state.projects.find(p => p.id === t.projectId);
        const projectHtml = project ? `<span class="task-project-badge">${project.name}</span>` : '<span class="task-project-badge">Deleted Project</span>';
        
        const invoice = t.invoiceId ? state.invoices.find(i => i.id === t.invoiceId) : null;
        const invoiceHtml = invoice ? `<span class="task-invoice-badge">${invoice.name}</span>` : '';

        return `
            <div class="task-item">
                <div class="task-details">
                    <span class="task-desc">${t.desc}</span>
                    <span class="task-meta">
                        ${projectHtml}
                        ${invoiceHtml}
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
