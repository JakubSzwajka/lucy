import { NextResponse } from "next/server";
import { getKnowledgeConfigService } from "@/lib/tools/integrations/knowledge";

interface RouteParams {
  params: Promise<{ categoryId: string }>;
}

// POST /api/knowledge/tags/[categoryId]/values - Add value to category
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { categoryId } = await params;
    const body = await req.json();

    if (!body.id || !body.name) {
      return NextResponse.json(
        { error: "Value must have id and name" },
        { status: 400 }
      );
    }

    const configService = getKnowledgeConfigService();
    const categories = await configService.getTagCategories();
    const category = categories.find((c) => c.id === categoryId);

    if (!category) {
      return NextResponse.json(
        { error: "Tag category not found" },
        { status: 404 }
      );
    }

    await configService.addTagValue(categoryId, {
      id: body.id,
      name: body.name,
    });

    const updatedCategories = await configService.getTagCategories();
    const updated = updatedCategories.find((c) => c.id === categoryId);

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    console.error("Failed to add tag value:", error);
    return NextResponse.json(
      { error: "Failed to add tag value" },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/tags/[categoryId]/values - Remove value from category (use body with valueId)
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { categoryId } = await params;
    const body = await req.json();

    if (!body.valueId) {
      return NextResponse.json(
        { error: "valueId is required in request body" },
        { status: 400 }
      );
    }

    const configService = getKnowledgeConfigService();
    const categories = await configService.getTagCategories();
    const category = categories.find((c) => c.id === categoryId);

    if (!category) {
      return NextResponse.json(
        { error: "Tag category not found" },
        { status: 404 }
      );
    }

    const valueExists = category.values.some((v) => v.id === body.valueId);
    if (!valueExists) {
      return NextResponse.json(
        { error: "Tag value not found" },
        { status: 404 }
      );
    }

    await configService.removeTagValue(categoryId, body.valueId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove tag value:", error);
    return NextResponse.json(
      { error: "Failed to remove tag value" },
      { status: 500 }
    );
  }
}
