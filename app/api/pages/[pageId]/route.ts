import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { verifyWorkspaceRole } from "@/lib/membership";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;

  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: {
        workspace: {
          select: { id: true, name: true, ownerId: true },
        },
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!page || page.isArchived) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const hasAccess = await verifyWorkspaceRole(page.workspaceId, user.id, "VIEWER");
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden: Not a workspace member." }, { status: 403 });
    }

    return NextResponse.json({ page });
  } catch (error) {
    console.error("Fetch page error:", error);
    return NextResponse.json({ error: "Failed to fetch page." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;

  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const canEdit = await verifyWorkspaceRole(page.workspaceId, user.id, "EDITOR");
    if (!canEdit) {
      return NextResponse.json(
        { error: "Forbidden: You must be an Editor or Owner to update this page." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title.trim() || "Untitled";
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.parentId !== undefined) updateData.parentId = body.parentId;
    if (body.isArchived !== undefined) updateData.isArchived = body.isArchived;

    const updated = await prisma.page.update({
      where: { id: pageId },
      data: updateData,
    });

    return NextResponse.json({ page: updated });
  } catch (error) {
    console.error("Update page error:", error);
    return NextResponse.json({ error: "Failed to update page." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await params;

  try {
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    const canDelete = await verifyWorkspaceRole(page.workspaceId, user.id, "EDITOR");
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.page.update({
      where: { id: pageId },
      data: { isArchived: true },
    });

    return NextResponse.json({ message: "Page deleted successfully." });
  } catch (error) {
    console.error("Delete page error:", error);
    return NextResponse.json({ error: "Failed to delete page." }, { status: 500 });
  }
}
