import { NextResponse } from "next/server";
import { getKnowledgeConfigService } from "@/lib/tools/integrations/knowledge";

// GET /api/knowledge/tags - Get all tag categories
export async function GET() {
  try {
    const configService = getKnowledgeConfigService();
    const categories = await configService.getTagCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to get tag categories:", error);
    return NextResponse.json(
      { error: "Failed to get tag categories" },
      { status: 500 }
    );
  }
}

// POST /api/knowledge/tags - Add new tag category
export async function POST(req: Request) {
  try {
    const category = await req.json();

    if (!category.id || !category.name) {
      return NextResponse.json(
        { error: "Category must have id and name" },
        { status: 400 }
      );
    }

    const configService = getKnowledgeConfigService();
    await configService.addTagCategory({
      id: category.id,
      name: category.name,
      description: category.description || "",
      color: category.color || "#6B7280",
      allowCustom: category.allowCustom ?? false,
      values: category.values || [],
    });

    const categories = await configService.getTagCategories();
    return NextResponse.json(categories, { status: 201 });
  } catch (error) {
    console.error("Failed to add tag category:", error);
    return NextResponse.json(
      { error: "Failed to add tag category" },
      { status: 500 }
    );
  }
}
