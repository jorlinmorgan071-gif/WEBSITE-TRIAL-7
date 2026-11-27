/**
 * TEST-ONLY loader hook: lets Node's native TypeScript type-stripping
 * resolve the app's extensionless relative imports ("./order" -> "./order.ts").
 * Used exclusively by scripts/test-unit.mjs via:
 *   node --import ./scripts/lib/ts-resolve.mjs scripts/test-unit.mjs
 */

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    const isRelative =
      specifier.startsWith("./") || specifier.startsWith("../");
    const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
    if (isRelative && !hasExtension) {
      return await next(`${specifier}.ts`, context);
    }
    throw error;
  }
}
