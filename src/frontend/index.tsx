import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderTree,
  Server,
} from "lucide-react";
import {
  useHosts,
  usePermission,
  usePluginApi,
  useShell,
  useTranslation,
  type PluginHostRecord,
  type TermixApp,
} from "@termix-ssh/plugin-sdk/frontend";
import { LoadingState, PanelShell } from "@termix-ssh/plugin-sdk/ui";
import { getSSHFolders } from "@termix-ssh/plugin-sdk/ui";
import {
  folderAncestors,
  folderSegments,
  normalizeFolderPath,
  validFolderName,
} from "../shared/folder-path.js";
import "./style.css";

type FolderNode = {
  name: string;
  path: string;
  folders: FolderNode[];
  hosts: PluginHostRecord[];
};

type DragItem = { kind: "host"; hostId: string };

function buildFolderTree(
  paths: string[],
  hosts: PluginHostRecord[],
): FolderNode[] {
  const root: FolderNode[] = [];
  const nodes = new Map<string, FolderNode>();

  for (const path of paths) {
    let parent: FolderNode | undefined;
    let currentPath = "";
    for (const name of folderSegments(path)) {
      currentPath = currentPath ? `${currentPath} / ${name}` : name;
      let node = nodes.get(currentPath);
      if (!node) {
        node = { name, path: currentPath, folders: [], hosts: [] };
        nodes.set(currentPath, node);
        if (parent) parent.folders.push(node);
        else root.push(node);
      }
      parent = node;
    }
  }

  for (const host of hosts) {
    const path = host.folder ? normalizeFolderPath(host.folder) : "";
    const parent = path ? nodes.get(path) : undefined;
    if (parent) parent.hosts.push(host);
  }

  const sortNodes = (folders: FolderNode[]) => {
    folders.sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      folder.hosts.sort((a, b) => a.name.localeCompare(b.name));
      sortNodes(folder.folders);
    }
  };
  sortNodes(root);
  return root;
}

function FolderManagerTab() {
  const { t } = useTranslation();
  const { hosts, loaded } = useHosts();
  const canManage = usePermission("manage");
  const pluginApi = usePluginApi();
  const shell = useShell();
  const [paths, setPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const reload = async () => {
    setError("");
    try {
      const folders = await getSSHFolders();
      const next = new Set<string>();
      for (const folder of folders) {
        for (const ancestor of folderAncestors(folder.name)) next.add(ancestor);
      }
      for (const host of hosts) {
        if (!host.folder) continue;
        for (const ancestor of folderAncestors(host.folder)) next.add(ancestor);
      }
      setPaths([...next].sort((a, b) => a.localeCompare(b)));
    } catch {
      setError(t("ui.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loaded) void reload();
  }, [loaded, hosts]);

  const tree = useMemo(() => buildFolderTree(paths, hosts), [paths, hosts]);
  const rootHosts = hosts.filter((host) => !host.folder && !host.parentHostId);

  const createFolder = async (parentPath: string | null) => {
    const name = folderName.trim();
    if (!validFolderName(name)) {
      setError(t("ui.invalidName"));
      return;
    }
    const path = [parentPath, name].filter(Boolean).join(" / ");
    if (paths.includes(path)) {
      setError(t("ui.folderExists"));
      return;
    }
    setError("");
    try {
      await pluginApi.put("/folders", { path });
      setFolderName("");
      setCreating(null);
      if (parentPath) {
        setExpanded((current) => new Set(current).add(parentPath));
      }
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("ui.saveError"));
    }
  };

  const moveItem = async (item: DragItem, parentPath: string | null) => {
    setError("");
    try {
      const hostId = Number(item.hostId);
      if (!Number.isSafeInteger(hostId) || hostId <= 0) {
        throw new Error("Invalid host ID");
      }
      await pluginApi.patch("/hosts/folder", {
        hostId,
        folder: parentPath,
      });
      await shell?.hosts.reload();
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("ui.moveFailed"));
    }
  };

  const beginDrag = (event: DragEvent, item: DragItem) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/x-termix-host-folder",
      JSON.stringify(item),
    );
  };

  const dropItem = (event: DragEvent, parentPath: string | null) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-termix-host-folder");
    if (!raw) return;
    try {
      const item = JSON.parse(raw) as DragItem;
      if (item.kind === "host" && typeof item.hostId === "string") {
        void moveItem(item, parentPath);
      }
    } catch {
      setError(t("ui.moveFailed"));
    }
  };

  const renderFolders = (folders: FolderNode[]) =>
    folders.map((folder) => {
      const isExpanded = expanded.has(folder.path);
      return (
        <section
          className="hfm-folder"
          key={folder.path}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropItem(event, folder.path)}
        >
          <div className="hfm-folder-row">
            <button
              className="hfm-expand"
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(folder.path)) next.delete(folder.path);
                  else next.add(folder.path);
                  return next;
                })
              }
              aria-label={isExpanded ? t("ui.collapse") : t("ui.expand")}
            >
              {isExpanded ? <ChevronDown /> : <ChevronRight />}
            </button>
            <FolderTree className="hfm-icon" />
            <span className="hfm-folder-name" title={folder.path}>
              {folder.name}
            </span>
            {canManage && (
              <button
                className="hfm-add"
                title={t("ui.createChild")}
                aria-label={t("ui.createChild")}
                onClick={() => {
                  setCreating(folder.path);
                  setFolderName("");
                  setExpanded((current) => new Set(current).add(folder.path));
                }}
              >
                <FolderPlus />
              </button>
            )}
          </div>
          {isExpanded && (
            <div className="hfm-children">
              {creating === folder.path && (
                <form
                  className="hfm-create"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createFolder(folder.path);
                  }}
                >
                  <input
                    autoFocus
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                    aria-label={t("ui.folderName")}
                    placeholder={t("ui.folderName")}
                  />
                  <button
                    type="submit"
                    onClick={(event) => {
                      event.preventDefault();
                      void createFolder(folder.path);
                    }}
                  >
                    {t("ui.create")}
                  </button>
                  <button type="button" onClick={() => setCreating(null)}>
                    {t("ui.cancel")}
                  </button>
                </form>
              )}
              {folder.folders.length === 0 &&
                folder.hosts.length === 0 &&
                creating !== folder.path && (
                  <div className="hfm-empty-folder">{t("ui.emptyFolder")}</div>
                )}
              {renderFolders(folder.folders)}
              {folder.hosts.map((host) => {
                const hostCanMove =
                  canManage && !host.isShared && !host.parentHostId;
                return (
                  <div
                    className={`hfm-host${hostCanMove ? "" : " hfm-readonly"}`}
                    key={host.id}
                    draggable={hostCanMove}
                    onDragStart={(event) =>
                      hostCanMove &&
                      beginDrag(event, { kind: "host", hostId: host.id })
                    }
                    title={hostCanMove ? host.name : t("ui.sharedHost")}
                  >
                    <Server className="hfm-icon" />
                    <span>{host.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      );
    });

  return (
    <PanelShell icon={<FolderTree className="size-4" />} title={t("ui.title")}>
      <div className="hfm">
        <p className="hfm-description">{t("ui.description")}</p>
        <div className="hfm-toolbar">
          {canManage && (
            <button
              className="hfm-primary"
              onClick={() => {
                setCreating("");
                setFolderName("");
              }}
            >
              <FolderPlus className="hfm-icon" />
              {t("ui.createRoot")}
            </button>
          )}
          {!loading && loaded && paths.length === 0 && (
            <span className="hfm-muted">{t("ui.empty")}</span>
          )}
        </div>
        {creating === "" && canManage && (
          <form
            className="hfm-create"
            onSubmit={(event) => {
              event.preventDefault();
              void createFolder(null);
            }}
          >
            <input
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              aria-label={t("ui.folderName")}
              placeholder={t("ui.folderName")}
            />
            <button
              type="submit"
              onClick={(event) => {
                event.preventDefault();
                void createFolder(null);
              }}
            >
              {t("ui.create")}
            </button>
            <button type="button" onClick={() => setCreating(null)}>
              {t("ui.cancel")}
            </button>
          </form>
        )}
        <div
          className="hfm-root-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropItem(event, null)}
        >
          {t("ui.moveToRoot")}
          {rootHosts.map((host) => {
            const hostCanMove = canManage && !host.isShared;
            return (
              <div
                className={`hfm-host${hostCanMove ? "" : " hfm-readonly"}`}
                key={host.id}
                draggable={hostCanMove}
                onDragStart={(event) =>
                  hostCanMove &&
                  beginDrag(event, { kind: "host", hostId: host.id })
                }
                title={hostCanMove ? host.name : t("ui.sharedHost")}
              >
                <Server className="hfm-icon" />
                <span>{host.name}</span>
              </div>
            );
          })}
        </div>
        {loading ? (
          <LoadingState label={t("ui.loading")} />
        ) : (
          <div className="hfm-tree">{renderFolders(tree)}</div>
        )}
        {error && (
          <p className="hfm-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </PanelShell>
  );
}

export function activate(app: TermixApp) {
  app.registerRailItem({
    id: "host-folders",
    icon: FolderTree,
    titleKey: "tab.title",
    kind: "tab",
    permission: "use",
  });
  app.registerTab("host-folders", FolderManagerTab, {
    icon: FolderTree,
    titleKey: "tab.title",
    singleton: true,
    hostless: true,
  });
}
