import { NextResponse } from "next/server";
import { createFilesystemService } from "@/lib/services";
import yaml from "yaml";
import type { Entity } from "@/lib/tools/integrations/knowledge";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/knowledge/entities/[id] - Get entity by ID
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const fs = createFilesystemService("entities");
    const filename = `${id}.yaml`;

    if (!fs.exists(filename)) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    const content = await fs.readFile(filename);
    const entity = yaml.parse(content) as Entity;

    return NextResponse.json(entity);
  } catch (error) {
    console.error("Failed to get entity:", error);
    return NextResponse.json(
      { error: "Failed to get entity" },
      { status: 500 }
    );
  }
}

// PUT /api/knowledge/entities/[id] - Update entity
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const updates = await req.json();
    const fs = createFilesystemService("entities");
    const filename = `${id}.yaml`;

    if (!fs.exists(filename)) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    const content = await fs.readFile(filename);
    const existing = yaml.parse(content) as Entity;

    const updated: Entity = {
      ...existing,
      ...updates,
      id: existing.id, // Cannot change ID
      createdAt: existing.createdAt, // Cannot change creation date
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(filename, yaml.stringify(updated));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update entity:", error);
    return NextResponse.json(
      { error: "Failed to update entity" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/entities/[id] - Delete entity
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const fs = createFilesystemService("entities");
    const filename = `${id}.yaml`;

    if (!fs.exists(filename)) {
      return NextResponse.json(
        { error: "Entity not found" },
        { status: 404 }
      );
    }

    await fs.deleteFile(filename);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete entity:", error);
    return NextResponse.json(
      { error: "Failed to delete entity" },
      { status: 500 }
    );
  }
}
