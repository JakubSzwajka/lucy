/**
 * Entity matching and fuzzy search
 */

import type { Entity, EntityMatch, EntitySearchResult } from "./types";
import { levenshteinSimilarity, tokenize } from "./utils";

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

  // Weighted combination
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

  let filtered = entities;
  if (type) {
    filtered = entities.filter((e) => e.type === type);
  }

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
