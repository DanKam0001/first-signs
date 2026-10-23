export enum Key {
  Up = 'Up',
  Down = 'Down',
  Left = 'Left',
  Right = 'Right',
  Enter = 'Enter',
  Back = 'Back',
  PlayPause = 'PlayPause',
}
export type KeyListener = (key: Key) => void;
