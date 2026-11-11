import { createRequire } from 'module';
import path from 'path';

import { RuleTester } from 'eslint';

const nodeRequire = createRequire(__filename);
const boundariesModule = nodeRequire('../eslint/import-boundaries-core.cjs') as {
  default: { rules: Record<string, import('eslint').Rule.RuleModule> };
  parseFeatureImportFromSource: (
    importerFilename: string,
    source: string,
  ) => { featureId: string; isDeep: boolean } | null;
};

const boundaries = boundariesModule.default;
const { parseFeatureImportFromSource } = boundariesModule;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

const featureAProbe = path.join(__dirname, '../src/features/a/x/probe.ts');

ruleTester.run(
  'feature-public-entry-only',
  boundaries.rules['feature-public-entry-only'],
  {
    valid: [
      {
        filename: featureAProbe,
        code: "import { ok } from '../../b';",
      },
      {
        filename: featureAProbe,
        code: "import { ok } from '@/src/features/b';",
      },
      {
        filename: featureAProbe,
        code: "import { ok } from '@/src/features/b/index';",
      },
      {
        filename: featureAProbe,
        code: "import { ok } from '../storage/local';",
      },
    ],
    invalid: [
      {
        filename: featureAProbe,
        code: "import { y } from '../../b/deep/z';",
        errors: [{ messageId: 'deepFeatureImport' }],
      },
      {
        filename: featureAProbe,
        code: "import { y } from '@/src/features/b/deep/z';",
        errors: [{ messageId: 'deepFeatureImport' }],
      },
    ],
  },
);

describe('import boundary path resolution', () => {
  it('resolves relative and alias feature targets', () => {
    expect(parseFeatureImportFromSource(featureAProbe, '../../b/deep/z')).toEqual({
      featureId: 'b',
      isDeep: true,
    });
    expect(parseFeatureImportFromSource(featureAProbe, '../../b')).toEqual({
      featureId: 'b',
      isDeep: false,
    });
    expect(parseFeatureImportFromSource(featureAProbe, '@/src/features/b/deep/z')).toEqual({
      featureId: 'b',
      isDeep: true,
    });
    expect(parseFeatureImportFromSource(featureAProbe, '../storage/local')).toEqual({
      featureId: 'a',
      isDeep: true,
    });
  });
});
