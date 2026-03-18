(function () {
    console.log("Generating data for 100 projects with 6 tasks each...");

    // Clear existing data
    localStorage.clear();

    const state = {
        consultant: {
            name: "Test Consultant",
            address: "123 Test St\nTest City, TS 12345",
            email: "test@example.com",
            phone: "555-0199"
        },
        customers: [{
            id: "cust-1",
            name: "Enterprise Client",
            address: "100 Corporate Way\nSuite 500\nBusiness District, BD 54321",
            hourlyRate: 150
        }],
        projects: [],
        tasks: [],
        invoices: [{
            id: "inv-1",
            customerId: "cust-1",
            name: "STRESS-TEST-INV",
            startDate: "2026-03-01",
            submissionDate: "2026-03-31",
            status: "active"
        }],
        nextId: 1000
    };

    // Create 100 projects
    for (let p = 1; p <= 100; p++) {
        const projectId = `proj-${p}`;
        state.projects.push({
            id: projectId,
            customerId: "cust-1",
            name: `Research & Development Phase ${p}`
        });

        // Add 6 tasks per project
        for (let t = 1; t <= 6; t++) {
            const taskDate = new Date("2026-03-01T09:00:00");
            taskDate.setDate(taskDate.getDate() + (p % 28)); // Distribute across the month
            
            const start = new Date(taskDate);
            start.setHours(9 + (t % 8));
            
            const end = new Date(start);
            end.setHours(start.getHours() + 1);

            state.tasks.push({
                id: `task-${p}-${t}`,
                projectId: projectId,
                invoiceId: "inv-1",
                description: `Execution and documentation of task iteration ${t} for R&D Phase ${p}. Included detailed analysis of results and planning for subsequent phases.`,
                start: start.toISOString(),
                end: end.toISOString(),
                durationMs: 3600000
            });
        }
    }

    localStorage.setItem('timeTrackerState', JSON.stringify(state));
    console.log("100 projects and 600 tasks generated safely. Reloading page...");
    window.location.reload();
})();
