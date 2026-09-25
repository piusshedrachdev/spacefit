/**
 * Desktop-only brand panel for the standalone auth experience.
 *
 * The reference auth page uses this as a quiet editorial counterweight to
 * the form. The copy and composition are retained, while the colors and
 * typography come from the storefront's existing design tokens.
 */
export function AuthBrandPanel() {
  return (
    <aside
      aria-label="About SpaceFit"
      className="relative hidden overflow-hidden border-r border-outline-variant/50 bg-surface-container-low p-12 lg:flex lg:flex-col lg:justify-between"
    >
      <div className="relative z-10">
        <p className="mb-3 font-label-md uppercase tracking-wider text-on-surface-variant">
          SpaceFit Marketplace
        </p>
        <h2 className="max-w-md font-headline-lg text-headline-lg font-bold leading-tight text-on-surface">
          Furniture that fits your space, from people who share it.
        </h2>
      </div>

      <div className="relative z-10">
        <blockquote className="max-w-sm border-l-2 border-primary pl-4 font-body-md text-body-md leading-relaxed text-on-surface">
          “I furnished my whole living room through SpaceFit — escrow protection made buying
          pre-loved pieces feel completely safe.”
        </blockquote>
        <p className="mt-3 font-label-md text-label-md font-medium text-on-surface-variant">
          Amaka O., Port Harcourt
        </p>
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-primary-container/10" />
        <div className="absolute -right-10 top-1/3 h-40 w-40 rounded-full border border-outline-variant/50 bg-surface-container-lowest/60" />
      </div>
    </aside>
  );
}
