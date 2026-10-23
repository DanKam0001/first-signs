import { Directions, SpatialNavigation } from 'react-tv-space-navigation';
import RemoteControlManager from './RemoteControlManager';
import { Key } from './keys';

const MAP: Partial<Record<Key, Directions>> = {
  [Key.Up]: Directions.UP,
  [Key.Down]: Directions.DOWN,
  [Key.Left]: Directions.LEFT,
  [Key.Right]: Directions.RIGHT,
  [Key.Enter]: Directions.ENTER,
};

SpatialNavigation.configureRemoteControl({
  remoteControlSubscriber: (callback) =>
    RemoteControlManager.add((k) => {
      const d = MAP[k];
      if (d) callback(d);
    }),
  remoteControlUnsubscriber: (listener) => RemoteControlManager.remove(listener),
});
