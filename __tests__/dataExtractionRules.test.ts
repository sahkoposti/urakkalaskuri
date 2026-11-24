/** T-41: Android 12+ data extraction rules keep all app data out of cloud backup and device-to-device transfer. */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../plugins/withDataExtractionRules');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { XML } = require('expo/config-plugins');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));

describe('data extraction rules (T-41)', () => {
  it('app.json loads the plugin, next to allowBackup=false', () => {
    expect(appJson.expo.android.allowBackup).toBe(false);
    expect(appJson.expo.plugins).toContain('./plugins/withDataExtractionRules');
  });

  it('the rules are valid XML and exclude the database and secure-store prefs from cloud backup AND device transfer', async () => {
    const parsed = await XML.parseXMLAsync(plugin.buildRulesXml());
    const root = parsed['data-extraction-rules'];
    for (const section of ['cloud-backup', 'device-transfer']) {
      const excludes = root[section][0].exclude.map((e: { $: { domain: string; path: string } }) => e.$);
      expect(excludes.every((e: { path: string }) => e.path === '.')).toBe(true);
      const domains = excludes.map((e: { domain: string }) => e.domain);
      expect(domains).toEqual(expect.arrayContaining(['database', 'sharedpref', 'file', 'root', 'external']));
      expect(root[section][0].include).toBeUndefined();
    }
  });

  it('the manifest gets android:dataExtractionRules (tools:replace keeps it over library manifests)', () => {
    const m = plugin.applyToManifest({ $: {}, application: [{ $: { 'android:allowBackup': 'false', 'tools:replace': 'android:icon' } }] });
    expect(m.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(m.application[0].$['android:dataExtractionRules']).toBe('@xml/data_extraction_rules');
    expect(m.application[0].$['tools:replace'].split(',')).toEqual(['android:icon', 'android:dataExtractionRules']);
    expect(m.application[0].$['android:allowBackup']).toBe('false');
  });

  it('the dangerous mod writes res/xml/data_extraction_rules.xml into the Android project', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'der-'));
    const cfg = plugin({ name: 't', slug: 't' });
    const mod = cfg.mods.android.dangerous;
    await mod({ ...cfg, modResults: {}, modRequest: { platformProjectRoot: root, projectRoot: root, platform: 'android', modName: 'dangerous', nextMod: async (c: unknown) => c } });
    const file = path.join(root, 'app', 'src', 'main', 'res', 'xml', 'data_extraction_rules.xml');
    expect(fs.readFileSync(file, 'utf8')).toBe(plugin.buildRulesXml());
  });
});
