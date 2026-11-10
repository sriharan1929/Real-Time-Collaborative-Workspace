import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAccess, hasPermission } from "@/lib/membership";

interface RouteParams {
  params: Promise<{ pageId: string; snapshotId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageId, snapshotId } = await params;
    const snapshot = await prisma.pageSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        page: { select: { workspaceId: true } },
      },
    });

    if (!snapshot || snapshot.pageId !== pageId) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const access = await getWorkspaceAccess(snapshot.page.workspaceId, user.id);
    if (!access.hasAccess || !access.role || !hasPermission(access.role, "EDITOR")) {
      return NextResponse.json({ error: "Insufficient permissions to restore snapshot" }, { status: 403 });
    }

    const currentPage = await prisma.page.findUnique({
      where: { id: pageId },
      select: { content: true },
    });

    if (currentPage && currentPage.content) {
      await prisma.pageSnapshot.create({
        data: {
          pageId,
          title: `Pre-restore Backup (${new Date().toLocaleTimeString()})`,
          content: currentPage.content,
          createdById: user.id,
        },
      });
    }

    const updatedPage = await prisma.page.update({
      where: { id: pageId },
      data: {
        content: snapshot.content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, page: updatedPage, restoredContent: snapshot.content });
  } catch (error) {
    console.error("POST restore snapshot error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
