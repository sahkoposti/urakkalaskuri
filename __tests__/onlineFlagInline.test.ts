/**
 * T-40: the online flag must be read as a static `process.env.EXPO_PUBLIC_ONLINE_SEND` so that
 * babel-preset-expo inlines it at build time, and the flag must not be set in eas.json or CI.
 */
import * as fs from 'fs';
import * as path from 'path';
import { transformSync } from '@babel/core';

const root = path.resolve(__dirname, '..');
const flagFile = path.join(root, 'src/core/online/flag.ts');

function compileForAndroid(envValue: string | undefined): string {
  const preset = require.resolve('babel-preset-expo', { paths: [path.dirname(require.resolve('expo/package.json'))] });
  const prev = process.env.EXPO_PUBLIC_ONLINE_SEND;
  const prevNode = process.env.NODE_ENV;
  if (envValue === undefined) delete process.env.EXPO_PUBLIC_ONLINE_SEND;
  else process.env.EXPO_PUBLIC_ONLINE_SEND = envValue;
  process.env.NODE_ENV = 'production';
  try {
    const out = transformSync(fs.readFileSync(flagFile, 'utf8'), {
      filename: flagFile,
      babelrc: false,
      configFile: false,
      presets: [preset],
      caller: { name: 'metro', bundler: 'metro', platform: 'android', isDev: false, isServer: false } as never,
    });
    return out?.code ?? '';
  } finally {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_ONLINE_SEND;
    else process.env.EXPO_PUBLIC_ONLINE_SEND = prev;
    process.env.NODE_ENV = prevNode;
  }
}

describe('online flag build-time inlining (T-40)', () => {
  it('flag.ts reads process.env.EXPO_PUBLIC_ONLINE_SEND directly', () => {
    const src = fs.readFileSync(flagFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).toContain('process.env.EXPO_PUBLIC_ONLINE_SEND');
    expect(src).not.toMatch(/process\.env\s*\[/);
    expect(src).not.toMatch(/=\s*process\.env\s*[),]/);
  });

  it('babel-preset-expo replaces the flag with a constant in an Android build', () => {
    const on = compileForAndroid('1');
    expect(on).not.toContain('process.env');
    expect(on).toContain('"1"');
    const off = compileForAndroid(undefined);
    expect(off).not.toContain('"1"');
  });

  it('the flag is not set in any eas.json profile or CI workflow', () => {
    const files = [path.join(root, 'eas.json')];
    const wf = path.join(root, '.github/workflows');
    if (fs.existsSync(wf)) for (const f of fs.readdirSync(wf)) files.push(path.join(wf, f));
    for (const f of files) {
      expect([path.relative(root, f), fs.readFileSync(f, 'utf8').includes('EXPO_PUBLIC_ONLINE_SEND')]).toEqual([
        path.relative(root, f),
        false,
      ]);
    }
  });
});
