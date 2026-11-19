# Host Folder Manager

Host Folder Manager is a Termix plugin for creating nested host folders and organizing existing folders and hosts.

## Features

- Create root folders and subfolders from a folder's menu.
- Drag a folder onto another folder to move it, including its descendant folders and hosts.
- Drag an owned host into a folder or back to the root.
- Keep newly created empty folders visible.

Termix stores folder paths with `/` separators. The plugin uses Termix's folder and host APIs, preserving folder-level access, defaults, credential folders, and host locks.

## Install

From this directory, install dependencies and build a plugin package:

```sh
npm install
npm run build
npm run pack
```

In Termix, open **Plugins → Install from file** and choose the generated `.tmxplug` file. Approve its UI surface and host-write capabilities. Termix still checks the signed-in user's existing host and credential permissions for every folder or host change.

## Development

With developer mode enabled on a Termix server:

```sh
npx termix-plugin dev --server http://localhost:30001 --key tmx_...
```

The current user must also have the plugin's **Organize host folders** permission to create or move folders and hosts.
