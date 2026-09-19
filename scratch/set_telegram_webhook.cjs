process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const telegramToken = '7912100960:AAGQXpd1mTWfOt3bAyuVvio0QBcnzNEUKK4';
const webhookUrl = 'https://ops.badikatori.in/api/telegram/webhook';

async function setWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['callback_query', 'message']
      })
    });
    const data = await res.json();
    console.log('Set Webhook Result:', JSON.stringify(data, null, 2));

    const checkRes = await fetch(`https://api.telegram.org/bot${telegramToken}/getWebhookInfo`);
    const checkData = await checkRes.json();
    console.log('Updated Webhook Info:', JSON.stringify(checkData, null, 2));
  } catch (err) {
    console.error('Error setting webhook:', err);
  }
}

setWebhook();
