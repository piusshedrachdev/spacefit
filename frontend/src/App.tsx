/**
 * Phase 1 scaffold placeholder. Real routing and the shared chrome land in
 * Phase 2/3 of frontend_react_migration_plan.md; until then the legacy static
 * site keeps serving every real URL from frontend/legacy/.
 */
export default function App() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-space-md px-margin text-center">
      <img src="/logo.jpeg" alt="SpaceFit" className="w-24 rounded-xl shadow-sm" />
      <h1 className="font-headline-lg text-headline-lg text-primary">SpaceFit</h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
        React + TypeScript storefront — migration in progress (Phase 1 scaffold).
        The live site is still served from the legacy pages.
      </p>
      <a
        href="/policies.html"
        className="font-label-lg text-label-lg text-primary underline underline-offset-4"
      >
        View the legacy site
      </a>
    </main>
  );
}
