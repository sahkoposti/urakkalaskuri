import { readFileSync } from 'fs';
import path from 'path';

jest.mock('expo-constants', () => {
  const { readFileSync: read } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');
  const app = JSON.parse(read(join(__dirname, '../app.json'), 'utf8')) as { expo: { version: string } };
  return { expoConfig: { version: app.expo.version } };
});

import { formatAppVersionLabel, readAppVersion } from '../src/core/documents/appVersion';

describe('app version label', () => {
  it('matches app.json', () => {
    const app = JSON.parse(readFileSync(path.join(__dirname, '../app.json'), 'utf8')) as {
      expo: { version: string };
    };
    expect(app.expo.version).toBe('1.3.3');
    expect(formatAppVersionLabel(app.expo.version)).toBe('Versio 1.3.3');
    expect(readAppVersion()).toBe(app.expo.version);
    expect(formatAppVersionLabel(readAppVersion())).toBe('Versio 1.3.3');
    expect(formatAppVersionLabel('  1.3.3  ')).toBe('Versio 1.3.3');
    expect(formatAppVersionLabel('')).toBe('Versio');
  });
});
