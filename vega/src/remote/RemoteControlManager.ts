// Fire TV with Vega OS remote. D-pad / OK / play-pause come from TVEventHandler (Vega's UserInputManager);
// Back comes from BackHandler 'hardwareBackPress' (returning false lets Vega leave the app on the root screen).
// Pattern from AmazonAppDev/react-native-multi-tv-app-sample (MIT-0), RemoteControlManager.kepler.ts.
import mitt from 'mitt';
import { BackHandler } from 'react-native';
import { Key, KeyListener } from './keys';
import { onBack } from './back';

const MAP: Record<string, Key> = {
  left: Key.Left,
  right: Key.Right,
  up: Key.Up,
  down: Key.Down,
  select: Key.Enter,
  enter: Key.Enter, // VVD + inputd-cli KEY_ENTER arrive as 'enter'
  playpause: Key.PlayPause,
};

const DEBUG_KEYS = false; // true: relay raw HWEvents to the server as {type:'debug'} (stub logs them)
let lastBackAt = 0;
function handleBack(): boolean {
  // Back may arrive through both TVEventHandler and BackHandler; act once.
  const now = Date.now();
  if (now - lastBackAt < 300) return true;
  lastBackAt = now;
  return onBack();
}

class RemoteControlManager {
  private em = mitt<{ key: Key }>();
  private handler: any;
  constructor() {
    const { TVEventHandler } = require('react-native');
    this.handler = new TVEventHandler();
    this.handler.enable(this, (_c: unknown, ev: { eventType: string; eventKeyAction?: number }) => {
      if (DEBUG_KEYS) {
        try {
          require('../net/connection').conn.send({ type: 'debug', what: 'hwkey', ev });
        } catch {}
      }
      if (ev.eventKeyAction === 0 || ev.eventKeyAction === undefined) {
        if (ev.eventType === 'back') {
          handleBack();
          return;
        }
        const k = MAP[ev.eventType];
        if (k) this.em.emit('key', k);
      }
    });
    BackHandler.addEventListener('hardwareBackPress', handleBack);
  }
  add = (l: KeyListener) => {
    this.em.on('key', l);
    return l;
  };
  remove = (l: KeyListener) => this.em.off('key', l);
  emit = (k: Key) => this.em.emit('key', k);
}

export default new RemoteControlManager();
