// Fire TV with Vega OS (Kepler) remote, for a future Vega build. Not exercised yet.
// Pattern from AmazonAppDev/react-native-multi-tv-app-sample (MIT-0), RemoteControlManager.kepler.ts.
import mitt from 'mitt';
import { Key, KeyListener } from './keys';
import { onBack } from './back';

const MAP: Record<string, Key> = {
  left: Key.Left,
  right: Key.Right,
  up: Key.Up,
  down: Key.Down,
  select: Key.Enter,
  back: Key.Back,
  playpause: Key.PlayPause,
};

class RemoteControlManager {
  private em = mitt<{ key: Key }>();
  private handler: any;
  constructor() {
    const { TVEventHandler } = require('react-native');
    this.handler = new TVEventHandler();
    this.handler.enable(this, (_c: unknown, ev: { eventType: string; eventKeyAction?: number }) => {
      if (ev.eventKeyAction === 0 || ev.eventKeyAction === undefined) {
        const k = MAP[ev.eventType];
        if (k === Key.Back) onBack();
        else if (k) this.em.emit('key', k);
      }
    });
  }
  add = (l: KeyListener) => {
    this.em.on('key', l);
    return l;
  };
  remove = (l: KeyListener) => this.em.off('key', l);
  emit = (k: Key) => this.em.emit('key', k);
}

export default new RemoteControlManager();
