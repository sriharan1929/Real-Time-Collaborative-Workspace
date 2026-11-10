import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { verifyWorkspaceRole } from "@/lib/membership";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  const hasAccess = await verifyWorkspaceRole(workspaceId, user.id, "VIEWER");
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden: Not a workspace member" }, { status: 403 });
  }

  try {
    const pages = await prisma.page.findMany({
      where: {
        workspaceId,
        isArchived: false,
      },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    console.error("Fetch workspace pages error:", error);
    return NextResponse.json({ error: "Failed to fetch pages." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  const hasAccess = await verifyWorkspaceRole(workspaceId, user.id, "EDITOR");
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Forbidden: You must be an Editor or Owner to create pages." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const title = body?.title?.trim() || "Untitled";
    const icon = body?.icon || "";
    const content = body?.content || "";
    const parentId = body?.parentId || null;

    const page = await prisma.page.create({
      data: {
        title,
        icon,
        content,
        workspaceId,
        authorId: user.id,
        parentId,
      },
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error("Create page error:", error);
    return NextResponse.json({ error: "Failed to create page." }, { status: 500 });
  }
}
