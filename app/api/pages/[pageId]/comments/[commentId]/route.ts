import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAccess, hasPermission } from "@/lib/membership";

interface RouteParams {
  params: Promise<{ pageId: string; commentId: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageId, commentId } = await params;
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        page: {
          select: { workspaceId: true },
        },
      },
    });

    if (!comment || comment.pageId !== pageId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const access = await getWorkspaceAccess(comment.page.workspaceId, user.id);
    if (!access.hasAccess || !access.role || !hasPermission(access.role, "COMMENTER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        resolved: typeof body.resolved === "boolean" ? body.resolved : comment.resolved,
        content: body.content?.trim() || comment.content,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error("PATCH comment error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageId, commentId } = await params;
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        page: { select: { workspaceId: true } },
      },
    });

    if (!comment || comment.pageId !== pageId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const access = await getWorkspaceAccess(comment.page.workspaceId, user.id);
    const isAuthor = comment.authorId === user.id;
    const isOwner = access.isOwner;

    if (!isAuthor && !isOwner) {
      return NextResponse.json({ error: "Only the author or workspace owner can delete this comment" }, { status: 403 });
    }

    await prisma.comment.delete({ where: { id: commentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
