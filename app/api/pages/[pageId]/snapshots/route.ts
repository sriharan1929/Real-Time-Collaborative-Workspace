import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAccess, hasPermission } from "@/lib/membership";

interface RouteParams {
  params: Promise<{ pageId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageId } = await params;
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const access = await getWorkspaceAccess(page.workspaceId, user.id);
    if (!access.hasAccess || !access.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const snapshots = await prisma.pageSnapshot.findMany({
      where: { pageId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error("GET snapshots error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageId } = await params;
    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { workspaceId: true, content: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const access = await getWorkspaceAccess(page.workspaceId, user.id);
    if (!access.hasAccess || !access.role || !hasPermission(access.role, "EDITOR")) {
      return NextResponse.json({ error: "Insufficient permissions to create snapshot" }, { status: 403 });
    }

    const body = await req.json();
    const title = body.title?.trim() || `Snapshot at ${new Date().toLocaleTimeString()}`;
    const content = body.content !== undefined ? body.content : page.content;

    const snapshot = await prisma.pageSnapshot.create({
      data: {
        pageId,
        title,
        content,
        createdById: user.id,
      },
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    console.error("POST snapshot error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
