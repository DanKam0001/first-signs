import { Platform } from 'react-native';
import { createStore } from './store';
import buildConfig from '../generated/config.json';

/** Build-time default (scripts/write-config.js), or on web ?server=... / the page's own host. */
export function defaultServerUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('server');
    if (q) return q;
  }
  return buildConfig.defaultServerUrl;
}

export type Settings = {
  serverUrl: string; // '' = use the default
  voice: boolean;
  mirrorTeacher: boolean;
  slowTeacher: boolean;
};

export const settings = createStore<Settings>('fs.settings.v1', {
  serverUrl: '',
  voice: true,
  mirrorTeacher: true,
  slowTeacher: false,
});

export function effectiveServerUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // An explicit ?server= in the address bar beats saved settings (handy for testing).
    const q = new URLSearchParams(window.location.search).get('server');
    if (q) return q;
  }
  return settings.get().serverUrl.trim() || defaultServerUrl();
}
