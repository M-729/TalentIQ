import * as React from "react";

import { cn } from "@/lib/utils";

// A plain native <input type="checkbox">, styled to match Input/Select —
// no new dependency, and a native checkbox is keyboard/screen-reader
// accessible by default. `indeterminate` isn't a settable JSX/DOM
// attribute (only a live property), so it's applied imperatively via a
// ref — this is what lets a column's Select All render the tri-state
// "some (not all) candidates selected" visual without any extra markup.
export interface CheckboxProps extends Omit<React.ComponentProps<"input">, "type" | "checked"> {
  checked: boolean;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, checked, indeterminate = false, ...props },
  forwardedRef
) {
  const innerRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

  React.useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={innerRef}
      type="checkbox"
      data-slot="checkbox"
      checked={checked}
      className={cn(
        "size-4 shrink-0 rounded border border-input text-primary shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

export { Checkbox };
