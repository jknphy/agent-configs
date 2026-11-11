// Sets the Vertex project/region in the pi process env. pi's Vertex providers
// only read them from process.env (without them they hang on the GCE metadata
// lookup). The project is the key of the anthropic-vertex entry in auth.json.
// The Gemini CLI child must not inherit them, see glaipnir/hooks/20-vertex-env.sh.
// @ts-nocheck

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export default function () {
  try {
    const auth = JSON.parse(
      readFileSync(path.join(os.homedir(), ".pi", "agent", "auth.json"), "utf8"),
    );
    const project = auth["anthropic-vertex"]?.key;
    if (project) process.env.GOOGLE_CLOUD_PROJECT = project;
  } catch {}
  process.env.GOOGLE_CLOUD_LOCATION = "global";
}
