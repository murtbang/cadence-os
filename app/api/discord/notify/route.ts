import { NextRequest, NextResponse } from 'next/server';
import { sendWebhook } from '@/lib/discord';

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
  await sendWebhook(message);
  return NextResponse.json({ ok: true });
}
