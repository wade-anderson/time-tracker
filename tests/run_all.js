const fs = require('fs');
const path = require('path');
require('fake-indexeddb/auto');
const { JSDOM } = require('jsdom');
const assert = require('assert');

const htmlPath = path.join(__dirname, '..', 'index.html');
const jsPath = path.join(__dirname, '..', 'app.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const script = fs.readFileSync(jsPath, 'utf8');

async function runTests() {
    console.log("Starting Automated Test Suite...");
    
    // Initialize JSDOM
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
    const window = dom.window;
    const document = window.document;
    // Use JSDOM's native localStorage instead of custom mock
    window.alert = () => {};
    window.confirm = () => true;
    window.URL.createObjectURL = () => "blob:http://localhost/mock-url";
    window.URL.revokeObjectURL = () => {};
    
    // Inject fake-indexeddb into JSDOM
    window.indexedDB = global.indexedDB;
    window.IDBKeyRange = global.IDBKeyRange;

    // Load App Script
    const scriptEl = document.createElement('script');
    scriptEl.textContent = script.replace(/indexedDB\.open/g, 'window.indexedDB.open');
    document.body.appendChild(scriptEl);

    // Wait for App to Init DB
    await new Promise(resolve => setTimeout(resolve, 200));
    
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (e) {
            console.error(`❌ FAIL: ${name}`);
            console.error('   ' + e.stack);
            failed++;
        }
    }

    async function getStoredState() {
        return new Promise((resolve, reject) => {
            const req = window.indexedDB.open('TimeTrackerDB', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('app_state')) return resolve(null);
                const tx = db.transaction('app_state', 'readonly');
                const store = tx.objectStore('app_state');
                const getReq = store.get('timeTrackerState');
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => reject(getReq.error);
            };
            req.onerror = () => reject(req.error);
        });
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(!el) throw new Error("Element not found: " + id);
        el.value = val;
        el.dispatchEvent(new window.Event('change'));
    };

    const submitForm = async (id) => {
        const form = document.getElementById(id);
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.click();
        else form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
        
        // Wait for IDB to flush
        await new Promise(r => setTimeout(r, 50));
    };

    // tests
    await test("Requirement 5: CSS contains print page number rules", async () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
        assert.ok(css.includes('@media print'), "CSS should contain a print media query");
        assert.ok(css.includes('@page'), "CSS should define a page rule inside print media");
    });

    await test("13: Keyboard ESC cancels/closes active modals", async () => {
        document.getElementById('toolbar-profile').click();
        assert.ok(!document.getElementById('consultant-modal').classList.contains('hidden'));
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        assert.ok(document.getElementById('consultant-modal').classList.contains('hidden'));
    });

    await test("2 & 9: Create customer with Requestors", async () => {
        document.getElementById('toolbar-add-customer').click();
        setVal('customer-name', 'Acme Corp');
        setVal('customer-rate', '150');
        setVal('customer-requestors', 'Alice, Bob');
        await submitForm('customer-form');
        
        const state = await getStoredState();
        assert.ok(state, "State should be saved");
        assert.strictEqual(state.customers.length, 1);
        assert.strictEqual(state.customers[0].name, 'Acme Corp');
        assert.deepStrictEqual(state.customers[0].requestors, ['Alice', 'Bob']);
    });

    await test("7: Project creation defaults to Active", async () => {
        const state1 = await getStoredState();
        document.getElementById('toolbar-manage-projects').click();
        setVal('project-name', 'Alpha Project');
        setVal('project-customer', state1.customers[0].id);
        await submitForm('project-form');

        const newState = await getStoredState();
        assert.strictEqual(newState.projects[0].status, 'active');
    });

    await test("2: Invoices can be created", async () => {
        const state1 = await getStoredState();
        document.getElementById('toolbar-manage-invoices').click();
        setVal('invoice-name', 'INV-001');
        setVal('invoice-customer', state1.customers[0].id);
        setVal('invoice-start', '2026-01-01');
        setVal('invoice-date', '2026-01-31');
        await submitForm('invoice-form');

        const newState = await getStoredState();
        assert.strictEqual(newState.invoices.length, 1);
    });

    await test("12.2 & 12.3: Quick Start Button creates In-Progress task", async () => {
        let state1 = await getStoredState();
        
        // Setup fields
        setVal('task-desc', 'My In Progress Task');
        setVal('task-project', state1.projects[0].id);
        setVal('task-invoice', state1.invoices[0].id);
        
        document.getElementById('log-in-progress-task').click();
        await new Promise(r => setTimeout(r, 50));

        const newState = await getStoredState();
        assert.strictEqual(newState.tasks.length, 1);
        const task = newState.tasks[0];
        assert.strictEqual(task.start, task.end);
        
        // Assert dashboard UI
        const inProgressCard = document.getElementById('in-progress-task-section');
        assert.ok(inProgressCard.style.display !== 'none');
        assert.ok(inProgressCard.innerHTML.includes('My In Progress Task'));
    });

    await test("12.4: Complete In Progress Task button works", async () => {
        let state1 = await getStoredState();
        const task = state1.tasks[0];
        window.completeInProgressTask(task.id);
        await new Promise(r => setTimeout(r, 50));

        let newState = await getStoredState();
        const updatedTask = newState.tasks.find(t => t.id === task.id);
        assert.notStrictEqual(updatedTask.start, updatedTask.end, "End time should be updated");
    });

    await test("12.5: Delete In Progress Task button works", async () => {
        // Create another
        setVal('task-desc', 'Temp In Progress Task');
        document.getElementById('log-in-progress-task').click();
        await new Promise(r => setTimeout(r, 50));
        let state1 = await getStoredState();
        
        let tempTask = state1.tasks[0]; 
        
        // Delete
        window.deleteTask(tempTask.id);
        await new Promise(r => setTimeout(r, 50));

        let newState = await getStoredState();
        assert.ok(newState.tasks.length < state1.tasks.length, "Task should be deleted");
    });

    await test("Rounding and Standardized Invoice Totals", async () => {
        let dbState = await getStoredState();
        
        // 1. Clear tasks and projects to have a clean state for this test
        dbState.tasks = [];
        dbState.projects = [];
        dbState.invoices = [];
        
        // Create an invoice
        const invoiceId = "inv-test-round";
        dbState.invoices.push({
            id: invoiceId,
            customerId: dbState.customers[0].id,
            name: "INV-ROUND-TEST",
            startDate: "2026-05-01",
            submissionDate: "2026-05-31",
            status: "active"
        });

        // Create 2 projects under the same customer
        const projA = { id: "proj-a", customerId: dbState.customers[0].id, name: "Project A", status: "active" };
        const projB = { id: "proj-b", customerId: dbState.customers[0].id, name: "Project B", status: "active" };
        dbState.projects.push(projA, projB);

        // Save back
        await new Promise((resolve, reject) => {
            const req = global.indexedDB.open('TimeTrackerDB', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('app_state', 'readwrite');
                const store = tx.objectStore('app_state');
                const putReq = store.put(dbState, 'timeTrackerState');
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
        });

        // Spin up a new window to fetch from DB
        const testDom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
        const testWindow = testDom.window;
        const testDocument = testWindow.document;
        testWindow.alert = () => {};
        testWindow.confirm = () => true;
        testWindow.URL.createObjectURL = () => "blob:http://localhost/mock-url";
        testWindow.URL.revokeObjectURL = () => {};
        testWindow.indexedDB = global.indexedDB;
        testWindow.IDBKeyRange = global.IDBKeyRange;
        
        const scriptEl = testDocument.createElement('script');
        scriptEl.textContent = script.replace(/indexedDB\.open/g, 'window.indexedDB.open');
        testDocument.body.appendChild(scriptEl);
        
        await new Promise(resolve => setTimeout(resolve, 250));

        // Helper to set values in the testDocument
        const setTestVal = (id, val) => {
            const el = testDocument.getElementById(id);
            if(!el) throw new Error("Element not found: " + id);
            el.value = val;
            el.dispatchEvent(new testWindow.Event('change'));
        };

        // 2. Add an in-progress task and complete it after 6h 30m 30s.
        // It should round up to 6h 31m.
        testDocument.getElementById('toolbar-manage-projects').click(); // modal reset
        setTestVal('task-desc', 'In Progress Test Task');
        setTestVal('task-project', projA.id);
        setTestVal('task-invoice', invoiceId);
        
        testDocument.getElementById('log-in-progress-task').click();
        await new Promise(r => setTimeout(r, 100));
        
        let stateAfterStart = await getStoredState();
        let inProgress = stateAfterStart.tasks.find(t => t.start === t.end);
        assert.ok(inProgress, "In-progress task should be created");
        
        // Backdate the start time to exactly 6h 30m 30s ago
        const duration = 6 * 3600000 + 30 * 60000 + 30 * 1000; // 6h 30m 30s
        const fakeStart = new Date(Date.now() - duration);
        inProgress.start = fakeStart.toISOString();
        inProgress.end = fakeStart.toISOString();
        
        await new Promise((resolve, reject) => {
            const req = global.indexedDB.open('TimeTrackerDB', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('app_state', 'readwrite');
                const store = tx.objectStore('app_state');
                const putReq = store.put(stateAfterStart, 'timeTrackerState');
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
        });
        
        // Spin up another fresh window with updated start time
        const testDom2 = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
        const testWindow2 = testDom2.window;
        const testDocument2 = testDom2.window.document;
        testWindow2.alert = () => {};
        testWindow2.confirm = () => true;
        testWindow2.URL.createObjectURL = () => "blob:http://localhost/mock-url";
        testWindow2.URL.revokeObjectURL = () => {};
        testWindow2.indexedDB = global.indexedDB;
        testWindow2.IDBKeyRange = global.IDBKeyRange;
        
        const scriptEl2 = testDocument2.createElement('script');
        scriptEl2.textContent = script.replace(/indexedDB\.open/g, 'window.indexedDB.open');
        testDocument2.body.appendChild(scriptEl2);
        
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Complete the task in testWindow2
        testWindow2.completeInProgressTask(inProgress.id);
        await new Promise(r => setTimeout(r, 100));
        
        let stateAfterComplete = await getStoredState();
        let completedTask = stateAfterComplete.tasks.find(t => t.id === inProgress.id);
        
        // 6h 30m 30s should round up to 6h 31m = 391 minutes = 23,460,000 ms.
        assert.strictEqual(completedTask.durationMs, 23460000);
        
        // End time should match start + durationMs exactly
        const startMs = new Date(completedTask.start).getTime();
        const endMs = new Date(completedTask.end).getTime();
        assert.strictEqual(endMs - startMs, 23460000);

        // 3. Test standardized invoice total calculation:
        // Set up the following tasks:
        // Customer hourlyRate: 150.
        // Task A on proj-a: duration 1h 15m (4,500,000 ms). Amount: 1.25 * 150 = 187.50 -> rounds to 188.
        // Task B on proj-b: duration 1h 15m (4,500,000 ms). Amount: 1.25 * 150 = 187.50 -> rounds to 188.
        // Invoice total should be project-based sum of rounded amounts: 188 + 188 = 376.
        
        stateAfterComplete.tasks = [
            {
                id: "task-a",
                desc: "Task on Project A",
                projectId: projA.id,
                invoiceId: invoiceId,
                start: "2026-05-01T09:00:00.000Z",
                end: "2026-05-01T10:15:00.000Z",
                durationMs: 4500000 // 1h 15m
            },
            {
                id: "task-b",
                desc: "Task on Project B",
                projectId: projB.id,
                invoiceId: invoiceId,
                start: "2026-05-02T09:00:00.000Z",
                end: "2026-05-02T10:15:00.000Z",
                durationMs: 4500000 // 1h 15m
            }
        ];
        
        await new Promise((resolve, reject) => {
            const req = global.indexedDB.open('TimeTrackerDB', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('app_state', 'readwrite');
                const store = tx.objectStore('app_state');
                const putReq = store.put(stateAfterComplete, 'timeTrackerState');
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
        });
        
        // Spin up third window to view calculated total on invoice management card
        const testDom3 = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
        const testWindow3 = testDom3.window;
        const testDocument3 = testDom3.window.document;
        testWindow3.alert = () => {};
        testWindow3.confirm = () => true;
        testWindow3.URL.createObjectURL = () => "blob:http://localhost/mock-url";
        testWindow3.URL.revokeObjectURL = () => {};
        testWindow3.indexedDB = global.indexedDB;
        testWindow3.IDBKeyRange = global.IDBKeyRange;
        
        const scriptEl3 = testDocument3.createElement('script');
        scriptEl3.textContent = script.replace(/indexedDB\.open/g, 'window.indexedDB.open');
        testDocument3.body.appendChild(scriptEl3);
        
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Get the invoice item element content
        const invoiceListContainer = testDocument3.getElementById('invoice-management-list');
        const invoiceCardHtml = invoiceListContainer.innerHTML;
        
        // Assert invoice card displays $376 (the project-based sum of rounded amounts), NOT $375
        assert.ok(invoiceCardHtml.includes('$376'), "Invoice card should show $376 (sum of rounded project amounts)");
        assert.ok(!invoiceCardHtml.includes('$375'), "Invoice card should NOT show $375");
    });

    await test("Set to Now on start time sets end time to Now + 15 minutes", async () => {
        const setStartNowBtn = document.getElementById('set-start-now');
        assert.ok(setStartNowBtn, "Set to Now button for start time should exist");
        
        // Trigger click
        setStartNowBtn.click();
        
        const startVal = document.getElementById('task-start').value;
        const endVal = document.getElementById('task-end').value;
        
        assert.ok(startVal, "Start time should be set");
        assert.ok(endVal, "End time should be set");
        
        const startDate = new Date(startVal);
        const endDate = new Date(endVal);
        
        const diffMs = endDate.getTime() - startDate.getTime();
        assert.strictEqual(diffMs, 15 * 60 * 1000, "End time should be exactly 15 minutes after start time");
    });

    await test("End time increment buttons (+15m and +1h) correctly modify the end time", async () => {
        const incrementEnd15Btn = document.getElementById('increment-end-15');
        const incrementEnd1hBtn = document.getElementById('increment-end-1h');
        const taskEndInput = document.getElementById('task-end');
        
        assert.ok(incrementEnd15Btn, "+15m button should exist");
        assert.ok(incrementEnd1hBtn, "+1h button should exist");
        
        const formatDateLocal = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const mins = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${mins}`;
        };

        // Test clicking when input is empty
        taskEndInput.value = "";
        const nowLocalStr = formatDateLocal(new Date());
        incrementEnd15Btn.click();
        
        const val1 = new Date(taskEndInput.value).getTime();
        const val2 = new Date(nowLocalStr).getTime();
        const diff1 = val1 - val2;
        // The difference should be roughly 15 minutes (allowing for small delay / minute rollover)
        assert.ok(Math.abs(diff1 - 15 * 60 * 1000) <= 60000, "Should set end time to ~Now + 15m when clicked on empty input");
        
        // Test clicking when input has a value
        const prevTime = new Date(taskEndInput.value).getTime();
        incrementEnd1hBtn.click();
        const newTime = new Date(taskEndInput.value).getTime();
        assert.strictEqual(newTime - prevTime, 60 * 60 * 1000, "Should add exactly 1 hour to the existing end time");
    });

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
