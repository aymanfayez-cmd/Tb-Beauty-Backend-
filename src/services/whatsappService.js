const https = require('https');

function env(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}

function isEnabled() {
  return env('WHATSAPP_NOTIFY_ENABLED', 'false').toLowerCase() === 'true';
}

function cleanPhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

function postJson(urlString, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(payload, 'utf8')
        }
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = {};
          }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode || 0,
            body: parsed
          });
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function buildTemplateComponents(order, eventType) {
  const itemsCount = Array.isArray(order?.items) ? order.items.length : 0;
  const amount = Number(order?.finalAmount ?? order?.totalAmount ?? 0).toFixed(2);
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: String(eventType || 'ORDER_CONFIRMED') },
        { type: 'text', text: String(order?._id || order?.cartId || '') },
        { type: 'text', text: String(order?.customer?.fullName || 'Customer') },
        { type: 'text', text: `${amount} ${order?.currency || 'QAR'}` },
        { type: 'text', text: String(itemsCount) },
        { type: 'text', text: String(order?.customer?.phone || '-') }
      ]
    }
  ];
}

async function sendOrderWhatsappNotification(order, eventType) {
  if (!isEnabled()) return { skipped: true, reason: 'disabled' };

  const token = env('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = env('WHATSAPP_PHONE_NUMBER_ID');
  const to = cleanPhone(env('WHATSAPP_TO'));
  const templateName = env('WHATSAPP_TEMPLATE', 'order_notification');
  const languageCode = env('WHATSAPP_TEMPLATE_LANG', 'en');

  if (!token || !phoneNumberId || !to) {
    return { skipped: true, reason: 'missing_config' };
  }

  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: buildTemplateComponents(order, eventType)
    }
  };

  const result = await postJson(url, payload, token);
  if (!result.ok) {
    const msg = result?.body?.error?.message || `WhatsApp API error (${result.status})`;
    throw new Error(msg);
  }
  return { sent: true };
}

module.exports = { sendOrderWhatsappNotification };

