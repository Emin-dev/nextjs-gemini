import * as React from "react"

import { cn } from "@/lib/utils"

// Define a more specific type for elements that can be used with 'as' prop
type AsElementType = keyof React.JSX.IntrinsicElements | React.ComponentType<any>;

// Helper type to get props of a React component
type ElementProps<E extends AsElementType> = React.ComponentPropsWithoutRef<E>

// PolymorphicComponentProps allows us to define an 'as' prop
// and spread the rest of the props for the given element type.
type PolymorphicComponentProps<E extends AsElementType, P> = P & {
  as?: E
}

// This is the type for the actual props our Card component will receive.
// It includes our custom props (like 'as') and the HTML attributes
// of the element specified by 'as' (or 'div' by default).
// It O MITS 'ref' because forwardRef handles it separately.
type CardProps<E extends AsElementType = "div"> =
  PolymorphicComponentProps<E, {}> & Omit<ElementProps<E>, keyof PolymorphicComponentProps<E, {}> | 'ref'>;

// The render function passed to forwardRef
const CardRenderFn = <E extends AsElementType = "div">(
  { as, className, ...props }: CardProps<E>,
  ref: React.ForwardedRef<React.ElementRef<E>> // React.ElementRef should now be happier with AsElementType
) => {
  const Component = as || "div";
  return (
    <Component
      ref={ref}
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  );
};

// Type for the final polymorphic component. 
// Props passed by the user will include 'ref'.
type PolymorphicCardComponent = <E extends AsElementType = "div">(
  props: CardProps<E> & { ref?: React.ForwardedRef<React.ElementRef<E>> }
) => React.ReactElement | null;

// Create the component using forwardRef and then cast it to the polymorphic type
const Card = React.forwardRef(CardRenderFn) as PolymorphicCardComponent;
Card.displayName = "Card"


// --- Other Card components remain the same ---

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
