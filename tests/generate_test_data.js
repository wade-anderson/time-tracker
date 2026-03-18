(function () {
    console.log("Generating test data for multi-page report...");

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
            name: "Big Corp Inc",
            address: "456 Enterprise Dr\nBusiness Park, BP 99999",
            hourlyRate: 150
        }],
        projects: [{
            id: "proj-1",
            customerId: "cust-1",
            name: "Massive Task Project"
        }],
        tasks: [],
        invoices: [{
            id: "inv-1",
            customerId: "cust-1",
            name: "INV-2026-TEST",
            startDate: "2026-03-01",
            submissionDate: "2026-03-31",
            status: "active"
        }],
        nextId: 100
    };

    // Add 60 tasks to ensure several pages (approx 15-20 per page)
    const startDate = new Date("2026-03-01T09:00:00");
    for (let i = 0; i < 60; i++) {
        const taskDate = new Date(startDate);
        taskDate.setDate(startDate.getDate() + Math.floor(i / 2));

        const start = new Date(taskDate);
        start.setHours(9 + (i % 8));

        const end = new Date(start);
        end.setHours(start.getHours() + 1);

        state.tasks.push({
            id: `task-${i}`,
            projectId: "proj-1",
            invoiceId: "inv-1",
            description: `Detailed task entry number ${i + 1} describing the work performed for the massive task project to ensure sufficient vertical height for pagination testing.`,
            start: start.toISOString(),
            end: end.toISOString(),
            durationMs: 3600000
        });
    }

    localStorage.setItem('timeTrackerState', JSON.stringify(state));
    console.log("Test data generated. Reloading page...");
    window.location.reload();
})();
