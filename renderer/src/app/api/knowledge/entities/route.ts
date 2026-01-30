import { NextResponse } from "next/server";
import { createFilesystemService } from "@/lib/services";
import yaml from "yaml";
import type { Entity } from "@/lib/tools/integrations/knowledge";

// GET /api/knowledge/entities - List entities (with optional type query param)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type");

    const fs = createFilesystemService("entities");
    const files = await fs.listFiles("", /\.yaml$/);

    const entities: Entity[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file);
        const entity = yaml.parse(content) as Entity;

        if (typeFilter && entity.type !== typeFilter) {
          continue;
        }

        entities.push(entity);
      } catch {
        // Skip files that can't be parsed
        console.warn(`Failed to parse entity file: ${file}`);
      }
    }

    // Sort by updatedAt (most recent first)
    entities.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json(entities);
  } catch (error) {
    console.error("Failed to list entities:", error);
    return NextResponse.json(
      { error: "Failed to list entities" },
      { status: 500 }
    );
  }
}

// POST /api/knowledge/entities - Create a new entity
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.id || !body.type || !body.name) {
      return NextResponse.json(
        { error: "Entity must have id, type, and name" },
        { status: 400 }
      );
    }

    const fs = createFilesystemService("entities");
    const filename = `${body.id}.yaml`;

    // Check if entity already exists
    if (fs.exists(filename)) {
      return NextResponse.json(
        { error: "Entity with this ID already exists" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const entity: Entity = {
      id: body.id,
      type: body.type,
      name: body.name,
      aliases: body.aliases || [],
      description: body.description,
      content: body.content,
      tags: body.tags || [],
      relations: body.relations || [],
      metadata: body.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await fs.writeFile(filename, yaml.stringify(entity));

    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    console.error("Failed to create entity:", error);
    return NextResponse.json(
      { error: "Failed to create entity" },
      { status: 500 }
    );
  }
}
