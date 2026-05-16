import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  let variantClasses = "bg-gray-900 text-gray-50 hover:bg-gray-900/80"
  if (variant === "secondary") variantClasses = "bg-gray-100 text-gray-900 hover:bg-gray-100/80"
  if (variant === "destructive") variantClasses = "bg-red-500 text-gray-50 hover:bg-red-500/80"
  if (variant === "outline") variantClasses = "text-gray-950 border border-gray-200"
  if (variant === "success") variantClasses = "bg-green-500 text-gray-50 hover:bg-green-500/80"

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 border-transparent ${variantClasses} ${className || ""}`}
      {...props}
    />
  )
}

export { Badge }
