import type { ZodTypeAny } from 'zod';

/**
 * Minimal Zod → JSON Schema converter covering the subset used by native tool
 * inputs (objects, strings, numbers, booleans, arrays, enums, literals,
 * optional/default/nullable). Kept in-house to avoid an extra dependency; the
 * output feeds Anthropic tool-use `input_schema`.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

function convert(schema: ZodTypeAny): Record<string, unknown> {
  // Access zod v3 internal def. Typed as any deliberately: we only read it.
  const def = (schema as { _def: AnyDef })._def;
  const description = def.description;
  const withDesc = (node: Record<string, unknown>): Record<string, unknown> =>
    description ? { ...node, description } : node;

  switch (def.typeName) {
    case 'ZodString':
      return withDesc({ type: 'string' });
    case 'ZodNumber':
      return withDesc({ type: 'number' });
    case 'ZodBoolean':
      return withDesc({ type: 'boolean' });
    case 'ZodLiteral':
      return withDesc({ const: def.value });
    case 'ZodEnum':
      return withDesc({ type: 'string', enum: def.values });
    case 'ZodNativeEnum':
      return withDesc({ enum: Object.values(def.values ?? {}) });
    case 'ZodArray':
      return withDesc({ type: 'array', items: convert(def.type!) });
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return withDesc(convert(def.innerType!));
    case 'ZodEffects':
      return withDesc(convert(def.schema!));
    case 'ZodUnion':
      return withDesc({ anyOf: (def.options ?? []).map((o: ZodTypeAny) => convert(o)) });
    case 'ZodRecord':
      return withDesc({ type: 'object', additionalProperties: convert(def.valueType!) });
    case 'ZodObject': {
      const shape: Record<string, ZodTypeAny> = def.shape!();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!isOptional(value)) required.push(key);
      }
      return withDesc({
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
      });
    }
    default:
      // Unknown node: permissive object so tool-use still works.
      return withDesc({ type: 'object' });
  }
}

function isOptional(schema: ZodTypeAny): boolean {
  const name = (schema as { _def: AnyDef })._def.typeName;
  return name === 'ZodOptional' || name === 'ZodDefault';
}

interface AnyDef {
  typeName: string;
  description?: string;
  value?: unknown;
  values?: unknown;
  type?: ZodTypeAny;
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  valueType?: ZodTypeAny;
  options?: ZodTypeAny[];
  shape?: () => Record<string, ZodTypeAny>;
}
