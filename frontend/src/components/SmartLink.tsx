import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isSpaHref } from '@/lib/routes';

/**
 * SPA-aware anchor shared by headers, footers and pages: react-router
 * <Link> for routes served by the React app, a plain <a> for legacy
 * `.html` pages (src/lib/routes.ts decides which is which per phase).
 */
interface SmartLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

export function SmartLink({ href, children, ...rest }: SmartLinkProps) {
  if (isSpaHref(href)) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
