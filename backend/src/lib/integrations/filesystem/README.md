# Filesystem Integration

Integration wrapper for local filesystem operations via `FilesystemService`.

## Public API

- `filesystemIntegration`
- `FilesystemService` re-export and filesystem types

## Use It Like This

Resolve integration client and use it in tool modules requiring local file access.
Base path is controlled by `FILESYSTEM_BASE_PATH` (default `lucy-data`).
