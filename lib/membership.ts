import { prisma } from "./prisma";
import { Role } from "@prisma/client";

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 4,
  EDITOR: 3,
  COMMENTER: 2,
  VIEWER: 1,
};

export function hasPermission(userRole: Role, minimumRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

export interface WorkspaceAccess {
  hasAccess: boolean;
  role: Role | null;
  isOwner: boolean;
}

export async function getWorkspaceAccess(
  workspaceId: string,
  userId: string
): Promise<WorkspaceAccess> {
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        select: {
          ownerId: true,
        },
      },
    },
  });

  if (!member) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (workspace && workspace.ownerId === userId) {
      return { hasAccess: true, role: "OWNER", isOwner: true };
    }

    return { hasAccess: false, role: null, isOwner: false };
  }

  const isOwner = member.role === "OWNER" || member.workspace.ownerId === userId;
  return {
    hasAccess: true,
    role: member.role,
    isOwner,
  };
}

export async function verifyWorkspaceRole(
  workspaceId: string,
  userId: string,
  minimumRole: Role = "VIEWER"
): Promise<boolean> {
  const access = await getWorkspaceAccess(workspaceId, userId);
  if (!access.hasAccess || !access.role) return false;
  return hasPermission(access.role, minimumRole);
}
