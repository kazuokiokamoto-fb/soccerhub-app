const MANAGER_ROLES = new Set(["owner", "coach", "manager"]);

export function isTeamManagerRole(input: {
  isOwner: boolean;
  memberRole: string | null;
}): boolean {
  if (input.isOwner) return true;
  return input.memberRole !== null && MANAGER_ROLES.has(input.memberRole);
}
