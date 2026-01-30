import type {
  KnowledgeConfig,
  TagCategory,
  TagValidationResult,
  TagValidationError,
} from "./types";

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
 * Find similar tags based on Levenshtein distance
 */
function findSimilarTags(
  input: string,
  config: KnowledgeConfig,
  limit: number = 3
): string[] {
  const allTags: Array<{ tag: string; distance: number }> = [];

  for (const category of config.tagCategories) {
    for (const value of category.values) {
      const fullTag = `${category.id}:${value.id}`;
      const distance = Math.min(
        levenshteinDistance(input.toLowerCase(), value.id.toLowerCase()),
        levenshteinDistance(input.toLowerCase(), fullTag.toLowerCase())
      );
      allTags.push({ tag: fullTag, distance });
    }
  }

  return allTags
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .filter((t) => t.distance <= 3) // Only suggest if reasonably close
    .map((t) => t.tag);
}

/**
 * Parse a tag string into category and value parts
 */
function parseTag(tag: string): { category: string | null; value: string } {
  const parts = tag.split(":");
  if (parts.length === 2) {
    return { category: parts[0].toLowerCase(), value: parts[1].toLowerCase() };
  }
  return { category: null, value: tag.toLowerCase() };
}

/**
 * Find a category that contains the given value
 */
function findCategoryForValue(
  value: string,
  config: KnowledgeConfig
): TagCategory | null {
  const lowerValue = value.toLowerCase();
  for (const category of config.tagCategories) {
    if (category.values.some((v) => v.id.toLowerCase() === lowerValue)) {
      return category;
    }
  }
  return null;
}

/**
 * Validate a single tag against the configuration
 */
function validateSingleTag(
  tag: string,
  config: KnowledgeConfig
): { normalized: string | null; error: TagValidationError | null } {
  const { category, value } = parseTag(tag);

  if (category) {
    // Full format: "category:value"
    const categoryDef = config.tagCategories.find(
      (c) => c.id.toLowerCase() === category
    );

    if (!categoryDef) {
      return {
        normalized: null,
        error: {
          input: tag,
          message: `Unknown category "${category}"`,
          suggestions: config.tagCategories
            .map((c) => `${c.id}:${value}`)
            .slice(0, 3),
        },
      };
    }

    const valueDef = categoryDef.values.find(
      (v) => v.id.toLowerCase() === value
    );

    if (valueDef) {
      // Exact match
      return { normalized: `${categoryDef.id}:${valueDef.id}`, error: null };
    }

    if (categoryDef.allowCustom) {
      // Allow custom value - add it normalized
      return { normalized: `${categoryDef.id}:${value}`, error: null };
    }

    // Unknown value in strict category
    return {
      normalized: null,
      error: {
        input: tag,
        message: `Unknown value "${value}" in category "${categoryDef.name}"`,
        suggestions: findSimilarTags(tag, config),
      },
    };
  } else {
    // Value only format: "finance"
    const matchingCategory = findCategoryForValue(value, config);

    if (matchingCategory) {
      const valueDef = matchingCategory.values.find(
        (v) => v.id.toLowerCase() === value
      );
      return {
        normalized: `${matchingCategory.id}:${valueDef!.id}`,
        error: null,
      };
    }

    // Check if it matches any category with allowCustom
    const customCategories = config.tagCategories.filter((c) => c.allowCustom);
    if (customCategories.length === 1) {
      // Only one custom category, assume it belongs there
      return { normalized: `${customCategories[0].id}:${value}`, error: null };
    }

    // Ambiguous - could not resolve
    return {
      normalized: null,
      error: {
        input: tag,
        message: `Could not resolve tag "${tag}" to a category`,
        suggestions: findSimilarTags(tag, config),
      },
    };
  }
}

/**
 * Validate and normalize an array of tags
 */
export function validateTags(
  tags: string[],
  config: KnowledgeConfig
): TagValidationResult {
  const normalizedTags: string[] = [];
  const errors: TagValidationError[] = [];

  for (const tag of tags) {
    const result = validateSingleTag(tag.trim(), config);

    if (result.normalized) {
      // Avoid duplicates
      if (!normalizedTags.includes(result.normalized)) {
        normalizedTags.push(result.normalized);
      }
    }

    if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    valid: errors.length === 0,
    normalizedTags,
    errors,
  };
}

/**
 * Get all valid tags as a flat list
 */
export function getAllValidTags(config: KnowledgeConfig): string[] {
  const tags: string[] = [];
  for (const category of config.tagCategories) {
    for (const value of category.values) {
      tags.push(`${category.id}:${value.id}`);
    }
  }
  return tags;
}

export { levenshteinDistance, parseTag, findSimilarTags };
