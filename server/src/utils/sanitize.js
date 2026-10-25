// NoSQL-injection guard. Operator keys ("$ne", "$gt"...) and dotted keys are
// the vectors for Mongo injection, e.g. {"email": {"$ne": null}}.
// We delete them from any object that comes from the client.

export function deepSanitize(value) {
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) delete value[key];
      else value[key] = deepSanitize(value[key]);
    }
  }
  return value;
}
