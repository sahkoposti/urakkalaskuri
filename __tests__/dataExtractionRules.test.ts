/** T-41 / D1: Android backup stays on (Eemil 24.11.2026); only the expo-secure-store secrets are excluded. */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../plugins/withDataExtractionRules');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { XML } = require('expo/config-plugins');

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8'));
type Rule = { $: { domain: string; path: string } };

async function sections(xml: string) {
  const root = (await XML.parseXMLAsync(xml))['data-extraction-rules'];
  return ['cloud-backup', 'device-transfer'].map((s) => root[s][0] as { exclude: Rule[]; include?: unknown });
}

describe('Android backup rules (T-41, D1)', () => {
  it('app.json loads the plugin and keeps allowBackup=true (D1 option b)', () => {
    expect(appJson.expo.android.allowBackup).toBe(true);
    expect(appJson.expo.plugins).toContain('./plugins/withDataExtractionRules');
  });

  it('D1: BACKUP_POLICY is the single switch and agrees with app.json allowBackup (a half swap fails)', () => {
    expect(plugin.POLICIES).toContain(plugin.BACKUP_POLICY);
    expect(appJson.expo.android.allowBackup).toBe(plugin.BACKUP_POLICY !== 'off');
    expect(plugin.BACKUP_POLICY).toBe('exclude-secrets');
  });

  it('the secure-store prefs file name matches expo-secure-store native code', () => {
    const kt = fs.readFileSync(
      require.resolve('expo-secure-store/android/src/main/java/expo/modules/securestore/SecureStoreModule.kt'),
      'utf8',
    );
    expect(kt).toMatch(/SHARED_PREFERENCES_NAME = "SecureStore"/);
    expect(plugin.SECURE_STORE_PREFS).toBe('SecureStore.xml');
  });

  it('exclude-secrets: cloud backup AND device transfer exclude only SecureStore.xml (database is backed up)', async () => {
    for (const sec of await sections(plugin.buildRulesXml())) {
      expect(sec.exclude.map((e) => e.$)).toEqual([{ domain: 'sharedpref', path: 'SecureStore.xml' }]);
      expect(sec.include).toBeUndefined();
    }
  });

  it('exclude-secrets: Android <= 11 full-backup-content excludes SecureStore.xml', async () => {
    const parsed = await XML.parseXMLAsync(plugin.buildFullBackupXml());
    const ex = parsed['full-backup-content'].exclude.map((e: Rule) => e.$);
    expect(ex).toEqual([{ domain: 'sharedpref', path: 'SecureStore.xml' }]);
    expect(parsed['full-backup-content'].include).toBeUndefined();
  });

  it("policy 'off' still builds the exclude-all rules and no full-backup file", async () => {
    for (const sec of await sections(plugin.buildRulesXml('off'))) {
      const ex = sec.exclude.map((e) => e.$);
      expect(ex.every((e) => e.path === '.')).toBe(true);
      expect(ex.map((e) => e.domain)).toEqual(expect.arrayContaining(['database', 'sharedpref', 'file', 'root', 'external']));
    }
    expect(plugin.buildFullBackupXml('off')).toBeNull();
    expect(() => plugin.buildRulesXml('nope')).toThrow(/unknown backup policy/);
  });

  it('the manifest gets dataExtractionRules and fullBackupContent (tools:replace keeps them over library manifests)', () => {
    const m = plugin.applyToManifest({ $: {}, application: [{ $: { 'android:allowBackup': 'true', 'tools:replace': 'android:icon' } }] });
    const a = m.application[0].$;
    expect(m.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
    expect(a['android:dataExtractionRules']).toBe('@xml/data_extraction_rules');
    expect(a['android:fullBackupContent']).toBe('@xml/backup_rules');
    expect(a['tools:replace'].split(',')).toEqual(['android:icon', 'android:dataExtractionRules', 'android:fullBackupContent']);
    expect(a['android:allowBackup']).toBe('true');
  });

  it('the dangerous mod writes both rule files into the Android project', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'der-'));
    const cfg = plugin({ name: 't', slug: 't' });
    const mod = cfg.mods.android.dangerous;
    await mod({ ...cfg, modResults: {}, modRequest: { platformProjectRoot: root, projectRoot: root, platform: 'android', modName: 'dangerous', nextMod: async (c: unknown) => c } });
    const dir = path.join(root, 'app', 'src', 'main', 'res', 'xml');
    expect(fs.readFileSync(path.join(dir, 'data_extraction_rules.xml'), 'utf8')).toBe(plugin.buildRulesXml());
    expect(fs.readFileSync(path.join(dir, 'backup_rules.xml'), 'utf8')).toBe(plugin.buildFullBackupXml());
  });
});
