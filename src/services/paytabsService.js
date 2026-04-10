const path = require('path');
const https = require('https');
const dns = require('dns');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/** When PAYTABS_API_URL is not set, try these in order (wrong region often returns auth error). */
const REGION_ENDPOINTS = [
  'https://secure-global.paytabs.com/payment/request',
  'https://secure.paytabs.com/payment/request',
  'https://secure.paytabs.ae/payment/request',
  'https://secure.paytabs.sa/payment/request',
  'https://secure-egypt.paytabs.com/payment/request'
];

const REQUEST_TIMEOUT_MS = 45000;

function normalizeEnv(value) {
  let s = String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\r$/, '');
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function getConfig() {
  const profileId = normalizeEnv(process.env.PAYTABS_PROFILE_ID);
  const serverKey = normalizeEnv(process.env.PAYTABS_SERVER_KEY);
  if (!profileId || !serverKey) {
    const err = new Error('PayTabs is not configured (PAYTABS_PROFILE_ID / PAYTABS_SERVER_KEY)');
    err.statusCode = 503;
    throw err;
  }
  return { profileId, serverKey };
}

function assertValidPaytabsUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch {
    const e = new Error(`Invalid PAYTABS_API_URL or endpoint: ${urlString}`);
    e.statusCode = 400;
    throw e;
  }
  if (!u.hostname || !/^https:$/i.test(u.protocol)) {
    const e = new Error(`PayTabs URL must be https with a hostname: ${urlString}`);
    e.statusCode = 400;
    throw e;
  }
}

function getEndpointList() {
  const custom = normalizeEnv(process.env.PAYTABS_API_URL);
  if (custom) {
    assertValidPaytabsUrl(custom);
    return [custom];
  }
  if (normalizeEnv(process.env.PAYTABS_AUTO_REGION) === 'false') {
    return [REGION_ENDPOINTS[0]];
  }
  return [...REGION_ENDPOINTS];
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function hasRedirect(data) {
  return Boolean(data?.redirect_url || data?.redirectUrl);
}

function looksLikePaytabsAuthFailure(res, data) {
  const msg = String(data?.message || data?.msg || '').toLowerCase();
  const code = data?.code ?? data?.status;
  return (
    res.status === 401 ||
    res.status === 403 ||
    code === 401 ||
    code === 403 ||
    msg.includes('authentication') ||
    msg.includes('authorization header') ||
    msg.includes('check authentication') ||
    msg.includes('server key') ||
    msg.includes('invalid key')
  );
}

function buildAuthHeaders(serverKey) {
  const mode = normalizeEnv(process.env.PAYTABS_AUTH_MODE).toLowerCase();
  if (mode === 'bearer') {
    return [{ Authorization: `Bearer ${serverKey}` }];
  }
  if (mode === 'raw') {
    return [{ Authorization: serverKey }];
  }
  return [{ Authorization: serverKey }, { Authorization: `Bearer ${serverKey}` }];
}

/**
 * No axios / no fetch — avoids ERR_INVALID_IP_ADDRESS from broken HTTPS_PROXY + undici.
 * PAYTABS_IPV4_ONLY=true adds IPv4-only DNS (opt-in; was default on Windows and could break some Node builds).
 */
function getHttpsAgent() {
  const insecure = normalizeEnv(process.env.PAYTABS_TLS_INSECURE) === 'true';
  const useIpv4 = normalizeEnv(process.env.PAYTABS_IPV4_ONLY) === 'true';

  /** @type {import('https').AgentOptions} */
  const opts = { rejectUnauthorized: !insecure };
  if (useIpv4) {
    opts.lookup = (hostname, _options, callback) => {
      if (!hostname) {
        callback(new TypeError('lookup: hostname is required'));
        return;
      }
      dns.lookup(hostname, { family: 4 }, callback);
    };
  }
  return new https.Agent(opts);
}

function httpsPostJson(urlString, headers, jsonBody, agent, timeoutMs) {
  assertValidPaytabsUrl(urlString);
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const payload = typeof jsonBody === 'string' ? jsonBody : JSON.stringify(jsonBody);
    const hdr = {
      ...headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(payload, 'utf8')
    };

    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: 'POST',
        headers: hdr,
        agent
      },
      (incoming) => {
        let data = '';
        incoming.setEncoding('utf8');
        incoming.on('data', (c) => {
          data += c;
        });
        incoming.on('end', () => {
          resolve({
            status: incoming.statusCode || 0,
            ok: incoming.statusCode >= 200 && incoming.statusCode < 300,
            text: data
          });
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy(new Error(`HTTPS timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.on('close', () => clearTimeout(timer));
    req.write(payload);
    req.end();
  });
}

function formatNetworkError(err) {
  if (!err) return 'unknown error';
  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.code) parts.push(`code=${err.code}`);
  let c = err.cause;
  let depth = 0;
  while (c && typeof c === 'object' && depth < 5) {
    if (c.message) parts.push(c.message);
    if (c.code) parts.push(`cause=${c.code}`);
    c = c.cause;
    depth += 1;
  }
  return parts.filter(Boolean).join(' | ') || String(err);
}

function throwPaytabsError(message, lastData, lastUrl) {
  const err = new Error(message);
  err.statusCode = 502;
  err.paytabsData = lastData;
  err.paytabsHint =
    'Use Server Key from PayTabs → Developers → Key management. ' +
    `Last URL: ${lastUrl || 'n/a'}. ` +
    'Set PAYTABS_API_URL to the endpoint from your PayTabs dashboard (region). ' +
    'Optional: PAYTABS_AUTH_MODE=bearer. PAYTABS_AUTO_REGION=false disables trying multiple regions.';
  throw err;
}

/**
 * @param {object} payload - PayTabs payment/request body (without profile_id)
 */
async function createHostedPayment(payload) {
  const { profileId, serverKey } = getConfig();
  const profileNum = Number(profileId);
  const profileIdValue = Number.isFinite(profileNum) ? profileNum : profileId;

  const body = {
    profile_id: profileIdValue,
    ...payload
  };

  const endpoints = getEndpointList();
  const headerSets = buildAuthHeaders(serverKey);
  const httpsAgent = getHttpsAgent();

  if (normalizeEnv(process.env.PAYTABS_TLS_INSECURE) === 'true' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[PayTabs] PAYTABS_TLS_INSECURE=true — TLS verification OFF (dev only)');
  }

  let lastRes = null;
  let lastData = {};
  let lastText = '';
  let lastUrl = '';
  let lastNetworkError = null;

  for (const url of endpoints) {
    for (const headers of headerSets) {
      let res;
      let text;
      try {
        // eslint-disable-next-line no-await-in-loop
        const out = await httpsPostJson(url, headers, body, httpsAgent, REQUEST_TIMEOUT_MS);
        text = out.text;
        res = { ok: out.ok, status: out.status };
      } catch (netErr) {
        lastNetworkError = netErr;
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[PayTabs] network error:', url, formatNetworkError(netErr));
        }
        continue;
      }

      const data = parseJson(text);

      lastRes = res;
      lastData = data;
      lastText = text;
      lastUrl = url;

      if (res.ok && hasRedirect(data)) {
        if (process.env.NODE_ENV !== 'production' && endpoints.length > 1) {
          // eslint-disable-next-line no-console
          console.log('[PayTabs] OK →', url);
        }
        return {
          redirect_url: data.redirect_url || data.redirectUrl,
          tran_ref: data.tran_ref || data.tranRef,
          raw: data
        };
      }

      if (looksLikePaytabsAuthFailure(res, data)) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[PayTabs] retry (auth/region):', url, res.status, data?.message || data?.msg || '');
        }
        continue;
      }

      const message =
        data.message ||
        data.msg ||
        (lastText && lastText.length < 400 ? lastText : null) ||
        `PayTabs error HTTP ${res.status}`;
      throwPaytabsError(message, data, url);
    }
  }

  if (lastNetworkError) {
    const detail = formatNetworkError(lastNetworkError);
    const err = new Error(`Cannot reach PayTabs (${detail})`);
    err.statusCode = 502;
    err.paytabsHint =
      'ERR_INVALID_IP_ADDRESS usually means a bad HTTPS_PROXY/HTTP_PROXY (remove them in Windows env) or a broken proxy URL. ' +
      'PayTabs uses Node https only (no axios). Dev: PAYTABS_TLS_INSECURE=true if antivirus breaks SSL. ' +
      'Optional PAYTABS_IPV4_ONLY=true if you need IPv4-only DNS.';
    throw err;
  }

  const message =
    lastData.message ||
    lastData.msg ||
    (lastText && lastText.length < 400 ? lastText : null) ||
    `PayTabs error HTTP ${lastRes?.status || '?'}`;
  throwPaytabsError(message, lastData, lastUrl);
}

module.exports = { createHostedPayment, getConfig, REGION_ENDPOINTS };
