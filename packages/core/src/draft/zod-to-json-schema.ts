import type { ZodSchema } from "zod";

type JsonSchema = Record<string, unknown>;

type ZodDef = {
  typeName?: string;
  shape?: () => Record<string, ZodSchema<unknown>>;
  values?: readonly string[];
  type?: ZodSchema<unknown>;
  innerType?: ZodSchema<unknown>;
  options?: ZodSchema<unknown>[];
};

function getDef(schema: ZodSchema<unknown>): ZodDef {
  return (schema as { _def: ZodDef })._def;
}

export function zodToJsonSchema<T>(schema: ZodSchema<T>): JsonSchema {
  const def = getDef(schema as ZodSchema<unknown>);

  switch (def.typeName) {
    case "ZodObject": {
      const shape = def.shape?.() ?? {};
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        const inner = getDef(value);
        if (inner.typeName !== "ZodDefault" && inner.typeName !== "ZodOptional") {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      };
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return {
        type: "array",
        items: def.type ? zodToJsonSchema(def.type) : {},
      };
    case "ZodEnum":
      return { type: "string", enum: [...(def.values ?? [])] };
    case "ZodDefault":
    case "ZodOptional":
      return def.innerType ? zodToJsonSchema(def.innerType) : {};
    case "ZodUnion": {
      const options = (def.options ?? []).map((option) => zodToJsonSchema(option));
      const enums = options
        .map((option) => option.enum)
        .filter((value): value is string[] => Array.isArray(value))
        .flat();
      if (enums.length === options.length && options.length > 0) {
        return { type: "string", enum: [...new Set(enums)] };
      }
      return { anyOf: options };
    }
    default:
      return {};
  }
}
