const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const FEATURE_PATH_SEGMENT = '/src/features/';

function ownFeatureId(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const idx = normalized.indexOf(FEATURE_PATH_SEGMENT);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + FEATURE_PATH_SEGMENT.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  return rest.slice(0, slash);
}

function resolveImportTarget(importerFilename, source) {
  if (typeof source !== 'string') return null;
  let resolved;
  if (source.startsWith('@/')) {
    resolved = path.join(REPO_ROOT, source.slice(2));
  } else if (source.startsWith('.')) {
    resolved = path.join(path.dirname(importerFilename), source);
  } else {
    return null;
  }
  return path.normalize(resolved).replace(/\\/g, '/');
}

function parseResolvedFeatureImport(resolvedPath) {
  const normalized = resolvedPath.replace(/\\/g, '/');
  const idx = normalized.indexOf(FEATURE_PATH_SEGMENT);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + FEATURE_PATH_SEGMENT.length);
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const [featureId, ...tail] = parts;
  if (tail.length === 0) return { featureId, isDeep: false };
  const base = tail[tail.length - 1]?.replace(/\.(tsx?|jsx?)$/, '') ?? '';
  if (tail.length === 1 && base === 'index') return { featureId, isDeep: false };
  return { featureId, isDeep: true };
}

function parseFeatureImportFromSource(importerFilename, source) {
  const resolved = resolveImportTarget(importerFilename, source);
  if (!resolved) return null;
  return parseResolvedFeatureImport(resolved);
}

const featurePublicEntryOnly = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Cross-feature imports must go through src/features/<name>/index.ts',
    },
    schema: [],
    messages: {
      deepFeatureImport:
        'Import feature "{{feature}}" only via src/features/{{feature}}/index.ts (not "{{source}}").',
    },
  },
  create(context) {
    const own = ownFeatureId(context.filename);
    if (!own) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;
        const parsed = parseFeatureImportFromSource(context.filename, source);
        if (!parsed?.isDeep) return;
        if (parsed.featureId === own) return;
        context.report({
          node: node.source,
          messageId: 'deepFeatureImport',
          data: { feature: parsed.featureId, source },
        });
      },
    };
  },
};

function isDatabaseConnectionImport(source) {
  if (source === 'expo-sqlite') return true;
  if (source === '@/src/core/database/connection') return true;
  if (source.endsWith('/database/connection') || source.endsWith('/database/connection.ts')) return true;
  if (source === './connection' || source === '../database/connection') return true;
  return false;
}

function mayImportDatabaseConnection(filename) {
  const normalized = filename.replace(/\\/g, '/');
  if (normalized.includes('/src/core/')) return true;
  if (/\/src\/features\/[^/]+\/storage\//.test(normalized)) return true;
  return false;
}

const databaseConnectionScope = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Only core and feature storage may import the DB connection layer',
    },
    schema: [],
    messages: {
      forbiddenDbImport:
        'Only src/core/** and src/features/*/storage/** may import the database connection (expo-sqlite / connection.ts).',
    },
  },
  create(context) {
    if (mayImportDatabaseConnection(context.filename)) return {};

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;
        if (!isDatabaseConnectionImport(source)) return;
        context.report({ node: node.source, messageId: 'forbiddenDbImport' });
      },
    };
  },
};

module.exports = {
  ownFeatureId,
  resolveImportTarget,
  parseResolvedFeatureImport,
  parseFeatureImportFromSource,
  default: {
    rules: {
      'feature-public-entry-only': featurePublicEntryOnly,
      'database-connection-scope': databaseConnectionScope,
    },
  },
};
