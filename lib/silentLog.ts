import { supabase } from '@/lib/supabase';
import { sendLogsWebhook } from '@/lib/discord';

const TZ = 'America/Los_Angeles';

function nowLabel(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: TZ,
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/**
 * Log a silent event: saved to Supabase (pre-read, no unread badge) + posted
 * to the #cadence-logs Discord channel.
 */
export async function logSilent(message: string): Promise<void> {
  const fullMessage = `${message} — ${nowLabel()}`;

  await Promise.all([
    supabase.from('notifications').insert({
      message: fullMessage,
      type:    'silent',
      read:    true,        // never counts toward unread badge
    }),
    sendLogsWebhook(`🪵 ${fullMessage}`),
  ]);
}
