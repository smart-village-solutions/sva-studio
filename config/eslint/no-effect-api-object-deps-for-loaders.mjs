const REQUEST_METHOD_NAME_PATTERN = /^(load|refetch|reload)[A-Z0-9_]?/;

const isUseEffectCall = (callee) => {
  if (callee.type === 'Identifier') {
    return callee.name === 'useEffect';
  }

  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'React' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'useEffect'
  );
};

const unwrapChainExpression = (node) => {
  return node?.type === 'ChainExpression' ? node.expression : node;
};

const getMemberPropertyName = (node) => {
  if (node.property.type === 'Identifier' && !node.computed) {
    return node.property.name;
  }

  if (node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }

  return null;
};

const traverse = (node, visitorKeys, visit) => {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  visit(node);

  const keys = visitorKeys[node.type] ?? [];
  for (const key of keys) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        traverse(entry, visitorKeys, visit);
      }
      continue;
    }

    traverse(value, visitorKeys, visit);
  }
};

const collectTriggeredApiObjects = (effectCallback, visitorKeys) => {
  const triggeredApiObjects = new Set();
  const body = effectCallback.body;

  traverse(body, visitorKeys, (node) => {
    if (node.type !== 'CallExpression') {
      return;
    }

    const callee = unwrapChainExpression(node.callee);
    if (!callee || callee.type !== 'MemberExpression') {
      return;
    }

    const object = unwrapChainExpression(callee.object);
    if (!object || object.type !== 'Identifier' || !object.name.endsWith('Api')) {
      return;
    }

    const propertyName = getMemberPropertyName(callee);
    if (!propertyName || !REQUEST_METHOD_NAME_PATTERN.test(propertyName)) {
      return;
    }

    triggeredApiObjects.add(object.name);
  });

  return triggeredApiObjects;
};

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow useEffect dependencies on whole *Api objects when the effect triggers loader or refetch requests on that api.',
    },
    schema: [],
    messages: {
      avoidWholeApiDependency:
        'Avoid depending on whole API object "{{apiName}}" in useEffect when calling request methods on it. Depend on the specific callback or property instead.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        if (!isUseEffectCall(node.callee) || node.arguments.length < 2) {
          return;
        }

        const [effectCallback, dependencyArray] = node.arguments;
        if (
          !effectCallback ||
          (effectCallback.type !== 'ArrowFunctionExpression' && effectCallback.type !== 'FunctionExpression') ||
          !dependencyArray ||
          dependencyArray.type !== 'ArrayExpression'
        ) {
          return;
        }

        const triggeredApiObjects = collectTriggeredApiObjects(effectCallback, sourceCode.visitorKeys);
        if (triggeredApiObjects.size === 0) {
          return;
        }

        for (const dependency of dependencyArray.elements) {
          if (!dependency || dependency.type !== 'Identifier' || !triggeredApiObjects.has(dependency.name)) {
            continue;
          }

          context.report({
            node: dependency,
            messageId: 'avoidWholeApiDependency',
            data: {
              apiName: dependency.name,
            },
          });
        }
      },
    };
  },
};
