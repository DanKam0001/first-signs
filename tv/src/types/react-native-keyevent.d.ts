declare module 'react-native-keyevent' {
  const KeyEvent: {
    onKeyDownListener(cb: (e: { keyCode: number; action: number; pressedKey: string }) => void): void;
    removeKeyDownListener(): void;
  };
  export default KeyEvent;
}
