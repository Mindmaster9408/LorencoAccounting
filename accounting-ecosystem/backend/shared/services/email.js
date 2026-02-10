/**
 * Email Service Placeholder
 * Future: integrate with SendGrid, Mailgun, etc.
 */

async function sendEmail({ to, subject, body, html }) {
  console.log(`📧 Email queued: To=${to}, Subject=${subject}`);
  // TODO: Implement actual email sending
  return { success: true, message: 'Email service not yet configured' };
}

async function sendPayslipEmail(employee, payslipPdf) {
  return sendEmail({
    to: employee.email,
    subject: `Payslip - ${employee.full_name}`,
    body: 'Please find your payslip attached.',
  });
}

module.exports = { sendEmail, sendPayslipEmail };
