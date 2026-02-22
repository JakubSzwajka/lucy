# Filesystem

Sandboxed file I/O operations for agent tools.

## Public API

- `FilesystemService`, `createFilesystemService(config)` — scoped file read/write/list
- Types: `FileInfo`, `FilesystemServiceConfig`

## Responsibility Boundary

Owns file operations within a configured root directory. Does not manage tool registration — that's handled by `tools/`.
