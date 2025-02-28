import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export type CardActionProps = {
  /**
   * Primary action button text
   */
  primaryText: string;
  /**
   * Primary action button icon
   */
  primaryIcon?: ReactNode;
  /**
   * Primary action variant
   */
  primaryVariant?: "default" | "outline";
  /**
   * Primary action click handler
   */
  primaryAction?: () => void;
  /**
   * Primary action link (optional, used instead of click handler)
   */
  primaryLink?: string;
  /**
   * Secondary action icon
   */
  secondaryIcon?: ReactNode;
  /**
   * Secondary action title for accessibility
   */
  secondaryTitle?: string;
  /**
   * Secondary action click handler
   */
  secondaryAction?: () => void;
  /**
   * Secondary action link (optional, used instead of click handler)
   */
  secondaryLink?: string;
};

/**
 * CardActions component for consistent button layout and styling
 * across character and agent cards
 */
export function CardActions({
  primaryText,
  primaryIcon,
  primaryVariant = "default",
  primaryAction,
  primaryLink,
  secondaryIcon,
  secondaryTitle,
  secondaryAction,
  secondaryLink,
}: CardActionProps) {
  const renderPrimaryButton = () => (
    <Button
      variant={primaryVariant}
      className="w-full"
      onClick={primaryAction}
    >
      {primaryIcon && <span className="mr-1.5">{primaryIcon}</span>}
      {primaryText}
    </Button>
  );

  const renderSecondaryButton = () => (
    <Button
      variant="outline"
      size="icon"
      onClick={secondaryAction}
      title={secondaryTitle}
    >
      {secondaryIcon}
    </Button>
  );

  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-grow">
        {primaryLink ? (
          <NavLink to={primaryLink} className="w-full block">
            {renderPrimaryButton()}
          </NavLink>
        ) : (
          renderPrimaryButton()
        )}
      </div>
      
      {secondaryIcon && (
        secondaryLink ? (
          <NavLink to={secondaryLink}>
            {renderSecondaryButton()}
          </NavLink>
        ) : (
          renderSecondaryButton()
        )
      )}
    </div>
  );
} 