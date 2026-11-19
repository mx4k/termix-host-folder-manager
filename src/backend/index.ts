import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import {
  normalizeFolderPath,
  validFolderPath,
} from "../shared/folder-path.js";

type PluginRequest = { body?: unknown };
type PluginResponse = {
  status(code: number): PluginResponse;
  json(body: unknown): PluginResponse;
};
type PluginHandler = (
  request: PluginRequest,
  response: PluginResponse,
) => unknown;
type PluginRouter = {
  use(...handlers: unknown[]): unknown;
  put(path: string, handler: PluginHandler): unknown;
  patch(path: string, handler: PluginHandler): unknown;
};

function bodyRecord(body: unknown): Record<string, unknown> | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  return body as Record<string, unknown>;
}

export async function activate(ctx: PluginContext): Promise<void> {
  const router = ctx.http.router<PluginRouter>();
  router.use(ctx.rbac.require("manage"));

  router.put("/folders", async (request, response) => {
    const path = bodyRecord(request.body)?.path;
    if (!validFolderPath(path)) {
      return response.status(400).json({ error: "Invalid folder path" });
    }

    const normalized = normalizeFolderPath(path);
    await ctx.hosts.folders.ensure(normalized);
    return response.json({ path: normalized });
  });

  router.patch("/hosts/folder", async (request, response) => {
    const body = bodyRecord(request.body);
    const hostId = Number(body?.hostId);
    const folderValue = body?.folder;
    if (!Number.isSafeInteger(hostId) || hostId <= 0) {
      return response.status(400).json({ error: "Invalid host ID" });
    }
    if (folderValue !== null && !validFolderPath(folderValue)) {
      return response.status(400).json({ error: "Invalid folder path" });
    }

    const folder =
      typeof folderValue === "string"
        ? normalizeFolderPath(folderValue)
        : null;
    const updated = await ctx.hosts.update(hostId, { folder });
    if (!updated) {
      return response.status(404).json({ error: "Host not found" });
    }
    return response.json({ folder: updated.folder });
  });
}
