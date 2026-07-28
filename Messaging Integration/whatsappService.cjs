const fs = require('fs');
const path = require('path');
const { db } = require('../db.cjs');

// Log file configuration
const LOG_FILE = path.join(__dirname, 'whatsapp.log');

/**
 * Helper to log message details and save to database
 */
function recordMessageRequest(poId, type, recipientNumber, content) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] TYPE: ${type} | TO: ${recipientNumber} | PO: ${poId}\nCONTENT: ${content}\nSTATUS: Pending Integration\n----------------------------------------\n`;
  
  // 1. Log to file
  try {
    fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
  } catch (err) {
    console.error('Failed to write to WhatsApp log file:', err);
  }

  // 2. Log to console
  console.log(`[WhatsApp Simulation Log]\n${logMessage}`);

  // 3. Save to database
  try {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    db.prepare(`
      INSERT INTO whatsapp_messages (id, poId, type, recipientNumber, messageContent, status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, poId, type, recipientNumber, content, 'Pending Integration', timestamp);
  } catch (err) {
    console.error('Failed to save WhatsApp message to database:', err);
  }
}

/**
 * Sends a Purchase Order confirmation message (Placeholder)
 */
async function sendPurchaseOrder(po, supplier) {
  const content = `Hello ${supplier.contactPerson || supplier.name},\n\nWe have generated a new Purchase Order: *${po.id}*.\nTotal Amount: Rs ${parseFloat(po.grandTotal).toFixed(2)}\nExpected Delivery Date: ${po.expectedDeliveryDate || 'N/A'}.\n\nPlease find the attached PO details. Kindly confirm acceptance.\n\nRegards,\nBadi Katori Team`;
  recordMessageRequest(po.id, 'purchase_order', supplier.whatsappNumber || supplier.mobileNumber, content);
  return { success: true, status: 'Pending Integration', messageId: `placeholder-${Date.now()}` };
}

/**
 * Sends a reminder message for PO review/payment (Placeholder)
 */
async function sendReminder(po, supplier) {
  const content = `Reminder: Purchase Order *${po.id}* is awaiting payment/review.\nGrand Total: Rs ${parseFloat(po.grandTotal).toFixed(2)}.\n\nPlease process it at your earliest convenience.\n\nRegards,\nBadi Katori Team`;
  recordMessageRequest(po.id, 'reminder', supplier.whatsappNumber || supplier.mobileNumber, content);
  return { success: true, status: 'Pending Integration', messageId: `placeholder-${Date.now()}` };
}

/**
 * Sends a delivery status reminder (Placeholder)
 */
async function sendDeliveryReminder(po, supplier) {
  const content = `Urgent: Delivery for Purchase Order *${po.id}* is expected by ${po.expectedDeliveryDate || 'today'}.\n\nPlease update the shipment dispatch status.\n\nRegards,\nBadi Katori Team`;
  recordMessageRequest(po.id, 'delivery_reminder', supplier.whatsappNumber || supplier.mobileNumber, content);
  return { success: true, status: 'Pending Integration', messageId: `placeholder-${Date.now()}` };
}

/**
 * Sends a payment reminder to admin/manager (Placeholder)
 */
async function sendPaymentReminder(po, supplier) {
  const content = `Alert: Payment for Purchase Order *${po.id}* to ${supplier.name} needs verification.\nAmount: Rs ${parseFloat(po.grandTotal).toFixed(2)}.\n\nRegards,\nBadi Katori Team`;
  recordMessageRequest(po.id, 'payment_reminder', supplier.whatsappNumber || supplier.mobileNumber, content);
  return { success: true, status: 'Pending Integration', messageId: `placeholder-${Date.now()}` };
}

module.exports = {
  sendPurchaseOrder,
  sendReminder,
  sendDeliveryReminder,
  sendPaymentReminder
};
