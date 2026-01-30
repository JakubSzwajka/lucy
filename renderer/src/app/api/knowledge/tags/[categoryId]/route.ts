import { NextResponse } from "next/server";
import { getKnowledgeConfigService } from "@/lib/tools/integrations/knowledge";

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

// GET /api/knowledge/tags/[categoryId] - Get single category
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { categoryId } = await params;
    const configService = getKnowledgeConfigService();
    const categories = await configService.getTagCategories();

    const category = categories.find((c) => c.id === categoryId);

    if (!category) {
      return NextResponse.json(
        { error: "Tag category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to get tag category:", error);
    return NextResponse.json(
      { error: "Failed to get tag category" },
      { status: 500 }
    );
  }
}

// PUT /api/knowledge/tags/[categoryId] - Update category
export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const { categoryId } = await params;
    const updates = await req.json();
    const configService = getKnowledgeConfigService();

    const categories = await configService.getTagCategories();
    const existing = categories.find((c) => c.id === categoryId);

    if (!existing) {
      return NextResponse.json(
        { error: "Tag category not found" },
        { status: 404 }
      );
    }

    await configService.updateTagCategory(categoryId, updates);

    const updatedCategories = await configService.getTagCategories();
    const updated = updatedCategories.find((c) => c.id === categoryId);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update tag category:", error);
    return NextResponse.json(
      { error: "Failed to update tag category" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/tags/[categoryId] - Delete category
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { categoryId } = await params;
    const configService = getKnowledgeConfigService();

    const categories = await configService.getTagCategories();
    const existing = categories.find((c) => c.id === categoryId);

    if (!existing) {
      return NextResponse.json(
        { error: "Tag category not found" },
        { status: 404 }
      );
    }

    await configService.deleteTagCategory(categoryId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete tag category:", error);
    return NextResponse.json(
      { error: "Failed to delete tag category" },
      { status: 500 }
    );
  }
}
