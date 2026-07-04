import type { SVGProps } from "react";

type YomiMarkProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

export function YomiMark({ title, ...props }: YomiMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="17"
        fill="var(--brand-primary)"
      />
      <path
        d="M16.5 17.5h8.2c4.1 0 7.3 3.2 7.3 7.3v24.7c-2.6-4.1-6.7-6.2-12.4-6.2h-3.1V17.5Z"
        stroke="var(--content-inverse)"
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M47.5 17.5h-8.2c-4.1 0-7.3 3.2-7.3 7.3v24.7c2.6-4.1 6.7-6.2 12.4-6.2h3.1V17.5Z"
        stroke="var(--content-inverse)"
        strokeWidth="3.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 24.2v25.3"
        stroke="var(--content-inverse)"
        strokeOpacity="0.72"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M39.6 17.5h7.5v17.8l-3.8-3.2-3.7 3.2V17.5Z"
        fill="var(--action-primary)"
      />
      <path
        d="M15.5 47.8c7.5-3.2 13.4-2.5 16.5 1.9 3.1-4.4 9-5.1 16.5-1.9"
        stroke="var(--discovery)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
