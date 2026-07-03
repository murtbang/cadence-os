import { createPublicKey, verify } from 'node:crypto';

export function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  try {
    // Wrap raw 32-byte Ed25519 public key into DER SubjectPublicKeyInfo format
    const derPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const keyBytes  = Buffer.from(publicKey, 'hex');
    const keyObject = createPublicKey({ key: Buffer.concat([derPrefix, keyBytes]), format: 'der', type: 'spki' });

    return verify(
      null,
      Buffer.from(timestamp + body),
      keyObject,
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

export async function sendWebhook(content: string): Promise<void> {
  const url = process.env.DISCORD_ALERTS_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

// Plain channel webhooks can't carry buttons, but the bot can post them.
// Derive the channel from the existing webhook URL (no extra env var), then
// have the bot post the buttoned message there. Falls back to a plain webhook
// message if the bot can't post (e.g. missing Send Messages in that channel).
export async function sendWithButtons(content: string, components: unknown[]): Promise<void> {
  const webhookUrl = process.env.DISCORD_ALERTS_WEBHOOK_URL;
  const token      = process.env.DISCORD_BOT_TOKEN;

  if (webhookUrl && token) {
    try {
      const m = webhookUrl.match(/webhooks\/(\d+)\/([\w-]+)/);
      if (m) {
        // Look up the webhook to find which channel it posts to
        const whRes = await fetch(`https://discord.com/api/v10/webhooks/${m[1]}/${m[2]}`);
        if (whRes.ok) {
          const { channel_id } = await whRes.json();
          if (channel_id) {
            const res = await fetch(`https://discord.com/api/v10/channels/${channel_id}/messages`, {
              method:  'POST',
              headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' },
              body:    JSON.stringify({ content, components }),
            });
            if (res.ok) return;
            console.error('sendWithButtons bot post failed:', res.status, await res.text());
          }
        }
      }
    } catch (err) {
      console.error('sendWithButtons error:', err);
    }
  }

  // Fallback — plain text via webhook, no buttons
  await sendWebhook(content);
}

export async function sendLogsWebhook(content: string): Promise<void> {
  const url = process.env.DISCORD_LOGS_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}
