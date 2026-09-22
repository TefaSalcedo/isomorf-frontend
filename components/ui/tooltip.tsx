'use client';

import { cloneElement, useId, type ComponentPropsWithoutRef, type ReactElement } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

const POSITION_CLASSES: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
};

export function Tooltip({
  label,
  children,
  position = 'top',
}: {
  label: string;
  children: ReactElement<ComponentPropsWithoutRef<'button'>>;
  position?: TooltipPosition;
}) {
  const id = useId();

  return (
    <span className="group/tooltip relative inline-flex shrink-0">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute z-50 w-max max-w-48 whitespace-normal rounded-md bg-slate-900 px-2 py-1 text-center text-[11px] font-medium leading-4 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 ${POSITION_CLASSES[position]}`}
      >
        {label}
      </span>
    </span>
  );
}
