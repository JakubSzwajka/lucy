# Filesystem Service Module

Safe local filesystem abstraction used by integrations/tools.

## Public API

- `FilesystemService`
- `createFilesystemService(subdir)`
- types: `FileInfo`, `FilesystemServiceConfig`

## Use It Like This

Create scoped service instances per subdirectory and use file operations through this API.
Path traversal protections are built in.
