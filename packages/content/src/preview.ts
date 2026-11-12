import { pathToFileURL } from "node:url";

const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  process.stdout.write(
    "content:preview is not populated in Phase 0; templates are authored in Phase 2.\n",
  );
}
