export type WorkspaceView = "/" | "/explore" | "/settings";
const routes = {
  "/": "/projects/$projectSlug",
  "/explore": "/projects/$projectSlug/explore",
  "/settings": "/projects/$projectSlug/settings",
} as const;
export function workspaceTarget(view: WorkspaceView, projectSlug?: string) {
  return projectSlug ? { to: routes[view], params: { projectSlug } } : { to: view };
}
export function workspaceView(path: string): WorkspaceView {
  if (path.endsWith("/explore")) return "/explore";
  if (path.endsWith("/settings")) return "/settings";
  return "/";
}
