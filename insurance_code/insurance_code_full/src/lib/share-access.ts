export function canOpenProtectedShareTarget(input: {
  loginRequired: boolean;
  isAuthenticated: boolean;
  isVerifiedBasic: boolean;
}) {
  void input;
  // Shared content pages are always viewable. Real-name gating is enforced
  // inside the target pages only for point-affecting actions such as sign-in
  // and redeem flows.
  return true;
}
