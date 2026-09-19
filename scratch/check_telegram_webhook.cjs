process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const telegramToken = '7912100960:AAGQXpd1mTWfOt3bAyuVvio0QBcnzNEUKK4';

async function checkWebhook() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramToken}/getWebhookInfo`);
    const data = await res.json();
    console.log('Current Telegram Webhook Info:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching webhook info:', err);
  }
}

checkWebhook();
