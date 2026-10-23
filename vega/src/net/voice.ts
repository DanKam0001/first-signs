// Spoken prompts: TV -> server `speak` -> `audio` (Polly mp3 URL) -> play with w3cmedia AudioPlayer (Vega).
// Coaching tips: TV -> server `coach` -> `coach_text` (Bedrock).
import { AudioPlayer } from '@amazon-devices/react-native-w3cmedia';
import { conn } from './connection';
import { settings } from '../store/settings';

let player: AudioPlayer | null = null;
let playerReady: Promise<AudioPlayer> | null = null;
const urlCache = new Map<string, string>();

function resolveUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = conn.httpBase();
  return base + (url.startsWith('/') ? url : `/${url}`);
}

function getPlayer(): Promise<AudioPlayer> {
  if (!playerReady) {
    const p = new AudioPlayer();
    playerReady = p
      .initialize()
      .then(() => {
        p.autoplay = false;
        player = p;
        return p;
      })
      .catch((e: unknown) => {
        playerReady = null;
        throw e;
      });
  }
  return playerReady;
}

export async function speak(text: string): Promise<void> {
  if (!settings.get().voice) return;
  try {
    let url = urlCache.get(text);
    if (!url) {
      const msg = await conn.request<{ url: string }>({ type: 'speak', text }, 6000);
      if (!msg?.url) return;
      url = resolveUrl(msg.url);
      urlCache.set(text, url);
    }
    const p = await getPlayer();
    p.pause();
    p.src = url;
    p.load();
    p.play();
  } catch (e) {
    // Voice is a nice-to-have; the screen always shows the same words.
    console.log('speak skipped:', (e as Error)?.message);
  }
}

export function stopSpeaking() {
  try {
    player?.pause();
  } catch {}
}

export async function coachTip(target: string, top: [string, number][], attempts: number): Promise<string | null> {
  try {
    const msg = await conn.request<{ text: string }>({ type: 'coach', target, top, attempts }, 10000);
    return msg?.text?.trim() || null;
  } catch {
    return null;
  }
}
