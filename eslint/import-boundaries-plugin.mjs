import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('./import-boundaries-core.cjs');

export const ownFeatureId = core.ownFeatureId;
export const resolveImportTarget = core.resolveImportTarget;
export const parseResolvedFeatureImport = core.parseResolvedFeatureImport;
export const parseFeatureImportFromSource = core.parseFeatureImportFromSource;

export default core.default;
