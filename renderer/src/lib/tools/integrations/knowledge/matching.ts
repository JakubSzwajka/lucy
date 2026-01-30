import type { Entity, EntityMatch, EntitySearchResult } from "./types";

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate normalized Levenshtein similarity (0-1)
 */
function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Tokenize a string into words
 */
function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Calculate Jaccard similarity between two token sets
 */
function tokenOverlapSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);

  return intersection.size / union.size;
}

/**
 * Calculate combined similarity score between query and target
 */
function calculateSimilarity(query: string, target: string): number {
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact match
  if (queryLower === targetLower) return 1.0;

  // Prefix match bonus
  if (targetLower.startsWith(queryLower)) return 0.95;

  // Contains match
  if (targetLower.includes(queryLower)) return 0.85;

  // Calculate multiple similarity metrics
  const levenshtein = levenshteinSimilarity(queryLower, targetLower);
  const tokenOverlap = tokenOverlapSimilarity(query, target);

  // Weighted combination (favor token overlap for name matching)
  return Math.max(
    levenshtein * 0.7 + tokenOverlap * 0.3,
    tokenOverlap * 0.7 + levenshtein * 0.3
  );
}

/**
 * Calculate the best similarity score for an entity (checking name and aliases)
 */
function calculateEntitySimilarity(query: string, entity: Entity): number {
  let maxScore = calculateSimilarity(query, entity.name);

  for (const alias of entity.aliases) {
    const aliasScore = calculateSimilarity(query, alias);
    if (aliasScore > maxScore) {
      maxScore = aliasScore;
    }
  }

  return maxScore;
}

/**
 * Search entities with fuzzy matching
 */
export function searchEntities(
  query: string,
  entities: Entity[],
  options: {
    type?: string;
    limit?: number;
    minScore?: number;
  } = {}
): EntitySearchResult {
  const { type, limit = 10, minScore = 0.3 } = options;

  // Filter by type if specified
  let filtered = entities;
  if (type) {
    filtered = entities.filter((e) => e.type === type);
  }

  // Calculate scores and filter
  const scored: EntityMatch[] = filtered
    .map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases,
      score: calculateEntitySimilarity(query, entity),
    }))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { matches: scored };
}

/**
 * Generate a URL-safe ID from a name
 */
export function nameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Check if an entity with similar name already exists
 */
export function findDuplicateEntity(
  name: string,
  entities: Entity[],
  threshold: number = 0.9
): Entity | null {
  for (const entity of entities) {
    const score = calculateEntitySimilarity(name, entity);
    if (score >= threshold) {
      return entity;
    }
  }
  return null;
}

export {
  levenshteinDistance,
  levenshteinSimilarity,
  tokenOverlapSimilarity,
  calculateSimilarity,
  tokenize,
};
