import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        _count: {
          select: { pages: true, members: true },
        },
        members: {
          where: { userId: user.id },
          select: { role: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formatted = workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      ownerId: w.ownerId,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      pageCount: w._count.pages,
      memberCount: w._count.members,
      currentUserRole: w.ownerId === user.id ? "OWNER" : w.members[0]?.role || "VIEWER",
    }));

    return NextResponse.json({ workspaces: formatted });
  } catch (error) {
    console.error("Fetch workspaces error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspaces." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Workspace name is required." },
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        pages: {
          create: {
            title: "Untitled Page",
            authorId: user.id,
            content: "",
          },
        },
      },
      include: {
        pages: true,
      },
    });

    return NextResponse.json(
      {
        workspace,
        firstPageId: workspace.pages[0]?.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create workspace error:", error);
    return NextResponse.json(
      { error: "Failed to create workspace." },
      { status: 500 }
    );
  }
}
