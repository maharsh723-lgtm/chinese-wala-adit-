process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const telegramToken = '7912100960:AAGQXpd1mTWfOt3bAyuVvio0QBcnzNEUKK4';
const telegramChatId = '-5352187849';

async function sendTestMessage() {
  const messageText = `🧪 *BADIKATORI TELEGRAM TEST NOTIFICATION*\n\n` +
    `✅ Telegram Integration Verification\n` +
    `⏰ Time: ${new Date().toLocaleString('en-IN')}\n\n` +
    `_System status is active and connected._`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Test Button 1", callback_data: `test_click_1` },
        { text: "ℹ️ Test Button 2", callback_data: `test_click_2` }
      ]
    ]
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: messageText,
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
      })
    });
    const data = await res.json();
    console.log('Telegram Send Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to send Telegram test message:', err);
  }
}

sendTestMessage();
