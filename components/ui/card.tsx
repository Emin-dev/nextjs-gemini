import * as React from "react"

import { cn } from "@/lib/utils"

// Helper type to get props of a React component
type ElementProps<E extends React.ElementType> = React.ComponentPropsWithoutRef<E>

// PolymorphicComponentProps allows us to define an 'as' prop
// and spread the rest of the props for the given element type.
type PolymorphicComponentProps<E extends React.ElementType, P> = P & {
  as?: E
}

// This is the type for the actual props our Card component will receive.
// It includes our custom props (like 'as') and the HTML attributes
// of the element specified by 'as' (or 'div' by default).
type CardProps<E extends React.ElementType = "div"> =
  PolymorphicComponentProps<E, {}> & Omit<ElementProps<E>, keyof PolymorphicComponentProps<E, {}>>;

// Define a type for the ref, which depends on the element type E
type CardRef<E extends React.ElementType = "div"> = React.ComponentPropsWithRef<E>["ref"];

// Define the Card component using a generic type E for the element
const Card = React.forwardRef(
  <E extends React.ElementType = "div">(
    { as, className, ...props }: CardProps<E>,
    ref: CardRef<E>
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
  }
);
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

// Reverted CardTitle to use div as per original ShadCN structure
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
