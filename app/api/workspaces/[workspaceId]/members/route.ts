import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAccess } from "@/lib/membership";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const access = await getWorkspaceAccess(workspaceId, user.id);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    return NextResponse.json({
      members,
      ownerId: workspace?.ownerId,
      currentUserRole: access.role,
      isOwner: access.isOwner,
    });
  } catch (error) {
    console.error("GET workspace members error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const access = await getWorkspaceAccess(workspaceId, user.id);
    if (!access.isOwner) {
      return NextResponse.json({ error: "Only the workspace owner can add members" }, { status: 403 });
    }

    const body = await req.json();
    const { email, role } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User with this email not found. Please register the user first." },
        { status: 404 }
      );
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "User is already a member of this workspace" }, { status: 409 });
    }

    const validRoles: Role[] = ["OWNER", "EDITOR", "COMMENTER", "VIEWER"];
    const assignedRole: Role = validRoles.includes(role) ? role : "EDITOR";

    const newMember = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: assignedRole,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error("POST workspace member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
