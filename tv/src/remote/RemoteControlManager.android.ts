// Android TV / Fire OS remote. D-pad + OK come from react-native-keyevent (forwarded by the
// withKeyEvent config plugin); Back comes from BackHandler so the system Back gesture keeps working.
// Pattern from AmazonAppDev/react-native-multi-tv-app-sample (MIT-0).
import mitt from 'mitt';
import { BackHandler } from 'react-native';
import KeyEvent from 'react-native-keyevent';
import { Key, KeyListener } from './keys';
import { onBack } from './back';

const CODES: Record<number, Key> = {
  19: Key.Up,
  20: Key.Down,
  21: Key.Left,
  22: Key.Right,
  23: Key.Enter, // DPAD_CENTER
  66: Key.Enter, // ENTER
  160: Key.Enter, // NUMPAD_ENTER
  85: Key.PlayPause,
  126: Key.PlayPause,
  127: Key.PlayPause,
};

class RemoteControlManager {
  private em = mitt<{ key: Key }>();
  constructor() {
    KeyEvent.onKeyDownListener((e: { keyCode: number }) => {
      const k = CODES[e.keyCode];
      if (k) this.em.emit('key', k);
    });
    BackHandler.addEventListener('hardwareBackPress', () => onBack());
  }
  add = (l: KeyListener) => {
    this.em.on('key', l);
    return l;
  };
  remove = (l: KeyListener) => this.em.off('key', l);
  emit = (k: Key) => this.em.emit('key', k);
}

export default new RemoteControlManager();
