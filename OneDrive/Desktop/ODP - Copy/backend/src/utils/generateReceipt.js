const PDFDocument = require('pdfkit');

/**
 * Generates a donation receipt PDF in memory.
 * Returns a Buffer that can be attached to an email or sent as a download.
 *
 * @param {Object} opts
 * @param {string} opts.donorName
 * @param {string} opts.donorEmail
 * @param {string} opts.campaignTitle
 * @param {number} opts.amount          — in INR
 * @param {string} opts.donationId
 * @param {string} opts.razorpayPaymentId
 * @param {Date}   opts.paidAt
 * @param {boolean} opts.isAnonymous
 * @returns {Promise<Buffer>}
 */
const generateReceiptPDF = (opts) =>
  new Promise((resolve, reject) => {
    const {
      donorName, donorEmail, campaignTitle,
      amount, donationId, razorpayPaymentId,
      paidAt, isAnonymous
    } = opts;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PRIMARY   = '#0f766e';
    const TEXT      = '#374151';
    const MUTED     = '#6b7280';
    const LIGHT_BG  = '#f9fafb';
    const DATE_STR  = new Date(paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const AMT_STR   = `₹${Number(amount).toLocaleString('en-IN')}`;

    // ── Header bar ────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY);
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
       .text('OpenDonate', 50, 25);
    doc.fontSize(10).font('Helvetica')
       .text('Donation Receipt', 50, 52);

    // ── Receipt number / date ─────────────────────────────────────────
    doc.fillColor(MUTED).fontSize(9).font('Helvetica')
       .text(`Receipt #${String(donationId).slice(-10).toUpperCase()}`, 50, 100)
       .text(`Date: ${DATE_STR}`, 50, 114);

    // ── Divider ───────────────────────────────────────────────────────
    doc.moveTo(50, 135).lineTo(545, 135).strokeColor('#e5e7eb').lineWidth(1).stroke();

    // ── Amount highlight box ──────────────────────────────────────────
    doc.rect(50, 150, 495, 70).fillColor(LIGHT_BG).fill();
    doc.fillColor(MUTED).fontSize(10).font('Helvetica')
       .text('DONATION AMOUNT', 70, 165);
    doc.fillColor(PRIMARY).fontSize(28).font('Helvetica-Bold')
       .text(AMT_STR, 70, 182);

    // ── Donor details ─────────────────────────────────────────────────
    const row = (label, value, y) => {
      doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label, 50, y);
      doc.fillColor(TEXT).fontSize(10).font('Helvetica').text(value || '—', 200, y);
    };

    doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text('Donor Details', 50, 242);
    doc.moveTo(50, 257).lineTo(545, 257).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

    row('Name',   isAnonymous ? 'Anonymous Donor' : donorName,  268);
    row('Email',  isAnonymous ? '—' : donorEmail,                288);

    // ── Campaign details ──────────────────────────────────────────────
    doc.fillColor(TEXT).fontSize(11).font('Helvetica-Bold').text('Campaign Details', 50, 320);
    doc.moveTo(50, 335).lineTo(545, 335).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

    row('Campaign',   campaignTitle,       346);
    row('Payment ID', razorpayPaymentId,   366);
    row('Status',     'Paid',              386);

    // ── Tax note ──────────────────────────────────────────────────────
    doc.rect(50, 420, 495, 50).fillColor('#fffbeb').fill();
    doc.fillColor('#92400e').fontSize(9).font('Helvetica')
       .text(
         'This receipt is for your records. Donations made through OpenDonate may be eligible for ' +
         'tax benefits under Section 80G of the Income Tax Act (subject to the campaign\'s registration status).',
         60, 432, { width: 475 }
       );

    // ── Footer ────────────────────────────────────────────────────────
    doc.moveTo(50, 680).lineTo(545, 680).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
       .text('OpenDonate Platform  ·  Thank you for your generosity.', 50, 690, { align: 'center', width: 495 });

    doc.end();
  });

module.exports = { generateReceiptPDF };
