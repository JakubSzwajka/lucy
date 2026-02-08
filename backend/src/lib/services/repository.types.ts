// ============================================================================
// Repository Types
// ============================================================================

/**
 * Base query options for repository find operations
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * Result type for paginated queries
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Generic repository interface for CRUD operations
 * @template T - The entity type returned by the repository
 * @template TCreate - The type for creating new entities
 * @template TUpdate - The type for updating entities
 */
export interface Repository<T, TCreate, TUpdate> {
  findById(id: string, userId: string): T | null;
  findAll(userId: string, options?: QueryOptions): T[];
  create(data: TCreate, userId: string): T;
  update(id: string, data: TUpdate, userId: string): T | null;
  delete(id: string, userId: string): boolean;
}

/**
 * Extended repository interface with pagination support
 */
export interface PaginatedRepository<T, TCreate, TUpdate>
  extends Repository<T, TCreate, TUpdate> {
  findPaginated(userId: string, options?: QueryOptions): PaginatedResult<T>;
  count(userId: string): number;
}
