/**
 * TEST-ONLY: registers the TypeScript resolve hook (see ts-resolve-hook.mjs).
 * Usage: node --import ./scripts/lib/ts-resolve.mjs <script>
 */

import { register } from "node:module";

register(new URL("./ts-resolve-hook.mjs", import.meta.url));
