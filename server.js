const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const os = require('os');

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    console.warn('[Warning] nodemailer is not installed. Run `npm install nodemailer` for full SMTP support.');
}

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8'
};

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Renders HTML to a print-identical PDF using headless Chrome/Chromium.
 * Matches browser's window.print() output exactly, including @media print, @page margins, and headers.
 */
function renderHtmlToPdf(htmlContent) {
    return new Promise((resolve, reject) => {
        const chromeCandidates = [
            'google-chrome',
            '/opt/google/chrome/chrome',
            'google-chrome-stable',
            'chromium',
            'chromium-browser'
        ];

        const tmpDir = os.tmpdir();
        const randId = Date.now() + '-' + Math.random().toString(36).slice(2);
        const tmpHtml = path.join(tmpDir, `report-${randId}.html`);
        const tmpPdf = path.join(tmpDir, `report-${randId}.pdf`);
        const userDir = path.join(tmpDir, `chrome-profile-${randId}`);

        fs.writeFileSync(tmpHtml, htmlContent, 'utf8');

        const cleanup = () => {
            try { fs.rmSync(tmpHtml, { force: true }); } catch (e) {}
            try { fs.rmSync(tmpPdf, { force: true }); } catch (e) {}
            try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {}
        };

        const tryCandidate = (index) => {
            if (index >= chromeCandidates.length) {
                cleanup();
                return reject(new Error('No Chrome or Chromium executable found to generate printout PDF.'));
            }

            const binary = chromeCandidates[index];
            const args = [
                '--headless',
                '--disable-gpu',
                '--no-sandbox',
                '--no-pdf-header-footer',
                `--user-data-dir=${userDir}`,
                `--print-to-pdf=${tmpPdf}`,
                tmpHtml
            ];

            execFile(binary, args, { timeout: 20000 }, (err) => {
                if (err) {
                    return tryCandidate(index + 1);
                }
                try {
                    const pdfBuffer = fs.readFileSync(tmpPdf);
                    cleanup();
                    resolve(pdfBuffer);
                } catch (readErr) {
                    tryCandidate(index + 1);
                }
            });
        };

        tryCandidate(0);
    });
}

async function handleGeneratePdf(req, res) {
    setCorsHeaders(res);

    let body = '';
    req.on('data', chunk => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
            req.destroy();
        }
    });

    req.on('end', async () => {
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
            return;
        }

        const { html, filename } = payload || {};
        if (!html) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'html content is required' }));
            return;
        }

        try {
            const pdfBuffer = await renderHtmlToPdf(html);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                filename: filename || 'report.pdf',
                base64: pdfBuffer.toString('base64'),
                size: pdfBuffer.length
            }));
        } catch (err) {
            console.error('[Generate PDF Error]', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
        }
    });
}

async function handleSendEmail(req, res) {
    setCorsHeaders(res);

    let body = '';
    req.on('data', chunk => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) { // 50MB limit
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
            req.destroy();
        }
    });

    req.on('end', async () => {
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload: ' + err.message }));
            return;
        }

        const { smtp, email } = payload || {};
        if (!smtp || !smtp.hostname) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'SMTP hostname is required' }));
            return;
        }
        const rawRecipients = email.recipients || email.to || [];
        const recipientList = Array.isArray(rawRecipients)
            ? rawRecipients.flatMap(r => String(r).split(/[\s,;]+/)).map(e => e.trim()).filter(Boolean)
            : String(rawRecipients).split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);


        if (recipientList.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Recipient email ("to") is required' }));
            return;
        }

        if (!nodemailer) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'nodemailer is not installed on server' }));
            return;
        }

        const smtpPort = parseInt(smtp.port, 10) || 587;
        const isSecure = smtpPort === 465;

        const transportConfig = {
            host: smtp.hostname,
            port: smtpPort,
            secure: isSecure,
            tls: {
                rejectUnauthorized: false // support ProtonMail Bridge / local self-signed certs
            }
        };

        if (smtp.username) {
            transportConfig.auth = {
                user: smtp.username,
                pass: smtp.password || ''
            };
        }

        try {
            const transporter = nodemailer.createTransport(transportConfig);

            const attachments = [];
            const rawAttachments = email.attachments || (email.attachment ? [email.attachment] : []);
            for (const att of rawAttachments) {
                if (!att) continue;
                const filename = att.filename || att.name || 'document.pdf';
                const contentType = att.type || 'application/pdf';

                if (att.content) {
                    attachments.push({
                        filename,
                        content: Buffer.from(att.content, 'base64'),
                        contentType
                    });
                } else if (att.data) {
                    attachments.push({
                        filename,
                        content: Buffer.from(att.data, typeof att.data === 'string' && att.data.startsWith('%PDF') ? 'binary' : 'utf8'),
                        contentType
                    });
                }
            }

            // If printable HTML is provided, generate exact printout PDF via Chrome
            const printableHtml = email.html || email.reportHtml;
            if (printableHtml) {
                try {
                    console.log(`[SMTP Relay] Generating print-identical PDF using Chrome...`);
                    const exactPdfBuffer = await renderHtmlToPdf(printableHtml);
                    console.log(`[SMTP Relay] Generated PDF matching printout (${exactPdfBuffer.length} bytes)`);

                    const pdfFilename = email.filename || `${email.subject || 'report'}.pdf`;
                    const exactAttachment = {
                        filename: pdfFilename,
                        content: exactPdfBuffer,
                        contentType: 'application/pdf'
                    };

                    // Replace any fallback PDF attachment with the exact rendered PDF
                    const nonPdfAttachments = attachments.filter(a => !(a.filename && a.filename.toLowerCase().endsWith('.pdf')));
                    attachments.length = 0;
                    attachments.push(exactAttachment, ...nonPdfAttachments);
                } catch (pdfErr) {
                    console.warn(`[SMTP Relay] Headless Chrome PDF generation note: ${pdfErr.message}. Using fallback attachment.`);
                }
            }

            const mailOptions = {
                from: email.from || smtp.username || 'no-reply@timetracker.local',
                to: recipientList,
                subject: email.subject || email.title || 'TimeTracker Report',
                text: email.body || `Attached is your TimeTracker report (${email.filename || 'report.pdf'}).`,
                attachments
            };

            const recipientDisplay = recipientList.join(', ');
            console.log(`[SMTP Relay] Connecting to ${smtp.hostname}:${smtpPort}...`);
            const info = await transporter.sendMail(mailOptions);
            console.log(`[SMTP Relay] Success! Message ID: ${info.messageId} sent to ${recipientDisplay} (${recipientList.length} recipient${recipientList.length > 1 ? 's' : ''})`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                messageId: info.messageId,
                response: info.response
            }));
        } catch (err) {
            console.error(`[SMTP Relay Error] Failed sending to ${email.to}:`, err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: err.message || 'SMTP transmission failed',
                code: err.code
            }));
        }
    });
}

function serveStaticFile(req, res, pathname) {
    let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = parsedUrl.pathname;

    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === '/api/send-email' && req.method === 'POST') {
        handleSendEmail(req, res);
    } else if (pathname === '/api/generate-pdf' && req.method === 'POST') {
        handleGeneratePdf(req, res);
    } else if (pathname === '/api/status' || pathname === '/api/health') {
        setCorsHeaders(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'TimeTracker SMTP Relay Server', chromePdf: true }));
    } else {
        serveStaticFile(req, res, pathname);
    }
});

if (require.main === module) {
    server.listen(PORT, HOST, () => {
        console.log(`\n==================================================`);
        console.log(` TimeTracker Server with SMTP Relay Running!`);
        console.log(` URL: http://localhost:${PORT}`);
        console.log(` API: http://localhost:${PORT}/api/send-email`);
        console.log(`==================================================\n`);
    });
}

module.exports = server;
