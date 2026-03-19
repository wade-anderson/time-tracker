const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const assert = require('assert');

const htmlPath = path.join(__dirname, '..', 'index.html');
const jsPath = path.join(__dirname, '..', 'app.js');
const cssPath = path.join(__dirname, '..', 'style.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const script = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

async function runTests() {
    console.log("Starting Automated Test Suite...");
    
    // Initialize JSDOM
    const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
    const window = dom.window;
    const document = window.document;
    
    // Use JSDOM's native localStorage instead of custom mock
    window.alert = () => {};
    window.confirm = () => true;

    // Load App Script
    const scriptEl = document.createElement('script');
    scriptEl.textContent = script;
    document.body.appendChild(scriptEl);

    // Give it a tiny tick for event listeners to bind
    await new Promise(resolve => setTimeout(resolve, 50));
    
    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`✅ PASS: ${name}`);
            passed++;
        } catch (e) {
            console.error(`❌ FAIL: ${name}`);
            console.error('   ' + e.message);
            failed++;
        }
    }

    function getStoredState() {
        const str = window.localStorage.getItem('timeTrackerState');
        if (!str) return null;
        return JSON.parse(str);
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(!el) throw new Error("Element not found: " + id);
        el.value = val;
        el.dispatchEvent(new window.Event('change'));
    };

    const submitForm = (id) => {
        const form = document.getElementById(id);
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.click();
        else form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    };

    // tests
    test("Requirement 5: CSS contains print page number rules", () => {
        assert.ok(css.includes('@media print'), "CSS should contain a print media query");
        assert.ok(css.includes('@page'), "CSS should define a page rule inside print media");
        assert.ok(css.includes('@top-right'), "CSS should include a margin box for top-right");
        assert.ok(css.includes('content: "Page " counter(page)'), "CSS should set content to Page number counter");
    });

    test("13: Keyboard ESC cancels/closes active modals", () => {
        document.getElementById('toolbar-profile').click();
        assert.ok(!document.getElementById('consultant-modal').classList.contains('hidden'));
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
        assert.ok(document.getElementById('consultant-modal').classList.contains('hidden'));
    });

    test("2 & 9: Create customer with Requestors", () => {
        document.getElementById('toolbar-add-customer').click();
        setVal('customer-name', 'Acme Corp');
        setVal('customer-rate', '150');
        setVal('customer-requestors', 'Alice, Bob');
        submitForm('customer-form');
        
        const state = getStoredState();
        assert.ok(state, "State should be saved");
        assert.strictEqual(state.customers.length, 1);
        assert.strictEqual(state.customers[0].name, 'Acme Corp');
        assert.deepStrictEqual(state.customers[0].requestors, ['Alice', 'Bob']);
    });

    test("7: Project creation defaults to Active", () => {
        const state1 = getStoredState();
        document.getElementById('toolbar-manage-projects').click();
        setVal('project-name', 'Alpha Project');
        setVal('project-customer', state1.customers[0].id);
        submitForm('project-form');

        const newState = getStoredState();
        assert.strictEqual(newState.projects[0].status, 'active');
    });

    test("2: Invoices can be created", () => {
        const state1 = getStoredState();
        document.getElementById('toolbar-manage-invoices').click();
        setVal('invoice-name', 'INV-001');
        setVal('invoice-customer', state1.customers[0].id);
        setVal('invoice-start', '2026-01-01');
        setVal('invoice-date', '2026-01-31');
        submitForm('invoice-form');

        const newState = getStoredState();
        assert.strictEqual(newState.invoices.length, 1);
    });

    test("12.2 & 12.3: Quick Start Button creates In-Progress task", () => {
        let state1 = getStoredState();
        
        // Setup fields
        setVal('task-desc', 'My In Progress Task');
        setVal('task-project', state1.projects[0].id);
        setVal('task-invoice', state1.invoices[0].id);
        
        document.getElementById('log-in-progress-task').click();

        const newState = getStoredState();
        assert.strictEqual(newState.tasks.length, 1);
        const task = newState.tasks[0];
        assert.strictEqual(task.start, task.end);
        
        // Assert dashboard UI
        const inProgressCard = document.getElementById('in-progress-task-section');
        assert.ok(inProgressCard.style.display !== 'none');
        assert.ok(inProgressCard.innerHTML.includes('My In Progress Task'));
    });

    test("12.4: Complete In Progress Task button works", () => {
        let state1 = getStoredState();
        const task = state1.tasks[0];
        window.completeInProgressTask(task.id);

        let newState = getStoredState();
        const updatedTask = newState.tasks.find(t => t.id === task.id);
        assert.notStrictEqual(updatedTask.start, updatedTask.end, "End time should be updated");
    });

    test("12.5: Delete In Progress Task button works", () => {
        // Create another
        setVal('task-desc', 'Temp In Progress Task');
        document.getElementById('log-in-progress-task').click();
        let state1 = getStoredState();
        
        let tempTask = null;
        if (state1 && state1.tasks && state1.tasks.length > 0) {
            tempTask = state1.tasks[0]; 
        } else {
            throw new Error("Tasks array not found after creating in-progress task");
        }
        
        // Delete
        window.deleteTask(tempTask.id);
        let newState = getStoredState();
        assert.ok(newState.tasks.length < state1.tasks.length, "Task should be deleted");
    });

    console.log(`\nTests Completed: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
