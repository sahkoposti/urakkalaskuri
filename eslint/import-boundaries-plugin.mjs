/** @typedef {import('eslint').Rule.RuleModule} RuleModule */

const FEATURE_ALIAS_PREFIX = '@/src/features/';
const FEATURE_PATH_SEGMENT = '/src/features/';

/**
 * @param {string} filename
 * @returns {string | null}
 */
function ownFeatureId(filename) {
  const normalized = filename.replace(/\\/g, '/');
  const idx = normalized.indexOf(FEATURE_PATH_SEGMENT);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + FEATURE_PATH_SEGMENT.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return null;
  return rest.slice(0, slash);
}

/**
 * @param {string} source
 * @returns {{ featureId: string; isDeep: boolean } | null}
 */
function parseFeatureImport(source) {
  let path = source;
  if (path.startsWith(FEATURE_ALIAS_PREFIX)) {
    path = path.slice(FEATURE_ALIAS_PREFIX.length);
  } else {
    const rel = path.match(/(?:^|\/)src\/features\/(.+)$/);
    if (rel) path = rel[1];
    else if (!path.startsWith('.')) return null;
    else return null;
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const [featureId, ...rest] = parts;
  if (rest.length === 0) return { featureId, isDeep: false };
  if (rest.length === 1 && rest[0] === 'index') return { featureId, isDeep: false };
  if (rest.length === 1 && rest[0] === 'index.ts') return { featureId, isDeep: false };
  return { featureId, isDeep: true };
}

/** @type {RuleModule} */
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
        const parsed = parseFeatureImport(source);
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

/**
 * @param {string} filename
 */
function mayImportDatabaseConnection(filename) {
  const normalized = filename.replace(/\\/g, '/');
  if (normalized.includes('/src/core/')) return true;
  if (/\/src\/features\/[^/]+\/storage\//.test(normalized)) return true;
  return false;
}

/** @type {RuleModule} */
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

export default {
  rules: {
    'feature-public-entry-only': featurePublicEntryOnly,
    'database-connection-scope': databaseConnectionScope,
  },
};
