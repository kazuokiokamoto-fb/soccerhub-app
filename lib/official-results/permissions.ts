// Production team_members_role_check allows owner, coach, and member.
// Filing follows owner_id, plus stored roles owner and coach.
const MANAGER_ROLES = new Set(["owner", "coach"]);

export function isTeamManagerRole(input: {
  isOwner: boolean;
  memberRole: string | null;
}): boolean {
  if (input.isOwner) return true;
  return input.memberRole !== null && MANAGER_ROLES.has(input.memberRole);
}
