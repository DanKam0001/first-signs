// Web (and default) remote: keyboard arrows act as the D-pad, Enter is OK, Escape/Backspace is Back.
// Pattern from AmazonAppDev/react-native-multi-tv-app-sample (MIT-0).
import mitt from 'mitt';
import { Platform } from 'react-native';
import { Key, KeyListener } from './keys';
import { onBack } from './back';

const MAP: Record<string, Key> = {
  ArrowRight: Key.Right,
  ArrowLeft: Key.Left,
  ArrowUp: Key.Up,
  ArrowDown: Key.Down,
  Enter: Key.Enter,
  NumpadEnter: Key.Enter,
  Escape: Key.Back,
  Backspace: Key.Back,
  GoBack: Key.Back,
  BrowserBack: Key.Back,
  MediaPlayPause: Key.PlayPause,
};

class RemoteControlManager {
  private em = mitt<{ key: Key }>();
  constructor() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        const k = MAP[e.code] || MAP[e.key];
        if (!k) return;
        const el = e.target as HTMLElement | null;
        const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
        if (typing && k !== Key.Up && k !== Key.Down && k !== Key.Enter && e.key !== 'Escape') return;
        if (k === Key.Back || k === Key.Up || k === Key.Down) e.preventDefault();
        if (k === Key.Back) onBack();
        else this.em.emit('key', k);
      });
    }
  }
  add = (l: KeyListener) => {
    this.em.on('key', l);
    return l;
  };
  remove = (l: KeyListener) => this.em.off('key', l);
  emit = (k: Key) => this.em.emit('key', k);
}

export default new RemoteControlManager();
