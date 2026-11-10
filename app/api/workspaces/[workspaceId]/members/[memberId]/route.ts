import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceAccess } from "@/lib/membership";
import { Role } from "@prisma/client";

interface RouteParams {
  params: Promise<{ workspaceId: string; memberId: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, memberId } = await params;
    const access = await getWorkspaceAccess(workspaceId, user.id);
    if (!access.isOwner) {
      return NextResponse.json({ error: "Only the workspace owner can modify member roles" }, { status: 403 });
    }

    const body = await req.json();
    const { role } = body;
    const validRoles: Role[] = ["OWNER", "EDITOR", "COMMENTER", "VIEWER"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error("PATCH workspace member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, memberId } = await params;
    const access = await getWorkspaceAccess(workspaceId, user.id);

    const member = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isSelf = member.userId === user.id;
    if (!access.isOwner && !isSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE workspace member error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
