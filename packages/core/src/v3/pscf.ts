/**
 * Core's V3 surface re-exports PSCF validation primitives from the dedicated
 * schema package. Keeping the implementation there lets portable tools use
 * PSCF without taking a dependency on ingestion or model providers.
 */
export * from "@polyscribe/schema";
export {
  calculatePscfCanonicalHash as hashPscfDocument,
  validatePscf as validatePscfDocument,
} from "@polyscribe/schema";
