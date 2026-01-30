import { NextResponse } from "next/server";
import { getIndexManager } from "@/lib/tools/integrations/knowledge";
import { createFilesystemService } from "@/lib/services/filesystem";
import yaml from "yaml";

interface Entity {
  id: string;
  type: string;
  name: string;
  tags: string[];
}

// GET /api/knowledge/stats - Get graph statistics
export async function GET() {
  try {
    const indexManager = getIndexManager();
    const fs = createFilesystemService("entities");

    // Load all entities for stats
    const entityLoader = async (): Promise<Array<{ id: string; type: string; tags: string[]; name: string }>> => {
      const files = await fs.listFiles("", /\.yaml$/);
      const entities: Entity[] = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file);
          const entity = yaml.parse(content) as Entity;
          entities.push({
            id: entity.id,
            type: entity.type,
            name: entity.name,
            tags: entity.tags || [],
          });
        } catch {
          // Skip invalid files
        }
      }

      return entities;
    };

    const stats = await indexManager.getStats(entityLoader);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get graph stats:", error);
    return NextResponse.json(
      { error: "Failed to get graph statistics" },
      { status: 500 }
    );
  }
}
