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

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
