export {
  DEFAULT_IGNORE_GLOBS,
  DEFAULT_SECTION_ORDER,
  defaultConfig,
  draftSectionTypeSchema,
  EXAMPLE_CONFIG_YAML,
  parseConfig,
  polyScribeConfigSchema,
  type PolyScribeConfigFile,
  type PolyScribeConfigInput,
} from "./schema.js";

export {
  findConfigPath,
  loadConfig,
  validateConfigFile,
  type LoadConfigResult,
} from "./load.js";
