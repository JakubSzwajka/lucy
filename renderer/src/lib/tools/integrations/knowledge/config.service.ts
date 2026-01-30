import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";
import type {
  KnowledgeConfig,
  TagCategory,
  TagValue,
  EntityType,
} from "./types";
import { DEFAULT_TAG_CATEGORIES, DEFAULT_ENTITY_TYPES } from "./types";

const CONFIG_FILE = "knowledge.yaml";

class KnowledgeConfigService {
  private fs = createFilesystemService("config");
  private config: KnowledgeConfig | null = null;

  async getConfig(): Promise<KnowledgeConfig> {
    if (this.config) return this.config;

    if (!this.fs.exists(CONFIG_FILE)) {
      // Create default config
      const defaultConfig: KnowledgeConfig = {
        tagCategories: DEFAULT_TAG_CATEGORIES,
        entityTypes: DEFAULT_ENTITY_TYPES,
      };
      await this.fs.writeFile(CONFIG_FILE, yaml.stringify(defaultConfig));
      this.config = defaultConfig;
      return defaultConfig;
    }

    const content = await this.fs.readFile(CONFIG_FILE);
    this.config = yaml.parse(content) as KnowledgeConfig;
    return this.config;
  }

  async saveConfig(config: KnowledgeConfig): Promise<void> {
    await this.fs.writeFile(CONFIG_FILE, yaml.stringify(config));
    this.config = config;
  }

  // Tag category methods
  async getTagCategories(): Promise<TagCategory[]> {
    const config = await this.getConfig();
    return config.tagCategories;
  }

  async addTagCategory(category: TagCategory): Promise<void> {
    const config = await this.getConfig();
    const existing = config.tagCategories.findIndex((c) => c.id === category.id);
    if (existing >= 0) {
      config.tagCategories[existing] = category;
    } else {
      config.tagCategories.push(category);
    }
    await this.saveConfig(config);
  }

  async updateTagCategory(
    id: string,
    updates: Partial<TagCategory>
  ): Promise<void> {
    const config = await this.getConfig();
    const idx = config.tagCategories.findIndex((c) => c.id === id);
    if (idx >= 0) {
      config.tagCategories[idx] = { ...config.tagCategories[idx], ...updates };
      await this.saveConfig(config);
    }
  }

  async deleteTagCategory(id: string): Promise<void> {
    const config = await this.getConfig();
    config.tagCategories = config.tagCategories.filter((c) => c.id !== id);
    await this.saveConfig(config);
  }

  async addTagValue(categoryId: string, value: TagValue): Promise<void> {
    const config = await this.getConfig();
    const category = config.tagCategories.find((c) => c.id === categoryId);
    if (category) {
      const existing = category.values.findIndex((v) => v.id === value.id);
      if (existing >= 0) {
        category.values[existing] = value;
      } else {
        category.values.push(value);
      }
      await this.saveConfig(config);
    }
  }

  async removeTagValue(categoryId: string, valueId: string): Promise<void> {
    const config = await this.getConfig();
    const category = config.tagCategories.find((c) => c.id === categoryId);
    if (category) {
      category.values = category.values.filter((v) => v.id !== valueId);
      await this.saveConfig(config);
    }
  }

  // Entity type methods
  async getEntityTypes(): Promise<EntityType[]> {
    const config = await this.getConfig();
    return config.entityTypes;
  }

  async setEntityTypeEnabled(id: string, enabled: boolean): Promise<void> {
    const config = await this.getConfig();
    const entityType = config.entityTypes.find((t) => t.id === id);
    if (entityType) {
      entityType.enabled = enabled;
      await this.saveConfig(config);
    }
  }

  // Clear cache (useful for testing)
  clearCache(): void {
    this.config = null;
  }
}

// Singleton instance
let instance: KnowledgeConfigService | null = null;

export function getKnowledgeConfigService(): KnowledgeConfigService {
  if (!instance) {
    instance = new KnowledgeConfigService();
  }
  return instance;
}

export { KnowledgeConfigService };
