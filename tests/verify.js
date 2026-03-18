/**
 * Manual/Console Verification Script for Pagination
 * 
 * Instructions:
 * 1. Open TimeTracker in your browser.
 * 2. Copy and paste the content of generate_test_data.js into the console to setup 60+ tasks.
 * 3. Once the page reloads, run the code below in the console.
 */

(function() {
    console.log("Starting Pagination Verification...");
    
    // 1. Open the Task Report for the test invoice
    const testInvoice = JSON.parse(localStorage.getItem('timeTrackerState')).invoices.find(i => i.name === 'INV-2026-TEST');
    if (!testInvoice) {
        console.error("Test invoice not found. Please run generate_test_data.js first.");
        return;
    }

    // Trigger the report
    console.log("Opening Tasks Report...");
    window.showReport(testInvoice.id, 'tasks');

    // 2. Check for the page numbering element
    setTimeout(() => {
        const pageNumDiv = document.getElementById('print-page-num');
        if (pageNumDiv) {
            console.log("%c PASS %c Page numbering element (#print-page-num) found in DOM.", "background: #059669; color: white; padding: 2px 4px; border-radius: 3px;", "");
            
            // 3. Inspect the report body length
            const reportBody = document.getElementById('report-content');
            const height = reportBody.scrollHeight;
            console.log(`Report scroll height: ${height}px`);
            
            if (height > 2000) {
                console.log("%c PASS %c Report content is long enough to span multiple pages.", "background: #059669; color: white; padding: 2px 4px; border-radius: 3px;", "");
            } else {
                console.warn("Report content might not be long enough for multiple pages. Consider adding more tasks.");
            }

            console.log("\n%c FINAL STEP %c Use your browser's Print function (Ctrl+P / Cmd+P) to visually confirm:", "background: #2563eb; color: white; padding: 2px 4px; border-radius: 3px;", "");
            console.log("1. 'Page 1' appears at the top-right.");
            console.log("2. Scroll to page 2 and confirm 'Page 2' appears at the top-right.");
            console.log("3. Verify no data is cut off at the page transitions.");
        } else {
            console.error("FAILED: Page numbering element (#print-page-num) NOT found.");
        }
    }, 500);
})();
