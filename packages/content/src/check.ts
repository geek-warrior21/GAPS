import { pathToFileURL } from "node:url";

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  process.stderr.write(
    "Phase 2 deliverable: content:check is not implemented in Phase 0 (0 concepts, 0 templates).\n",
  );
  process.exitCode = 1;
}
