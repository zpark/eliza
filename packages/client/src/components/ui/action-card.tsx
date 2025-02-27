import React from "react";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatAgentName } from "@/lib/utils";
import { CardActions } from "./card-actions";
import type { CardActionProps } from "./card-actions";

export interface ActionCardProps extends CardActionProps {
  /**
   * The name to be displayed in the card title
   */
  name: string;
  
  /**
   * Additional className for the card
   */
  className?: string;
  
  /**
   * Additional content to be rendered after the avatar
   */
  extraContent?: ReactNode;
  
  /**
   * Whether this is a special card (like the 'new character' card)
   */
  isSpecial?: boolean;
  
  /**
   * Content to be rendered if this is a special card
   */
  specialContent?: ReactNode;
}

/**
 * ActionCard component that provides consistent styling for all action cards
 * (character cards, agent cards, etc.) in the application
 */
export function ActionCard({
  name,
  className,
  extraContent,
  isSpecial = false,
  specialContent,
  ...actionProps
}: ActionCardProps) {
  if (isSpecial) {
    return (
      <Card className={`border-dashed h-full ${className || ''}`}>
        <CardContent className="flex items-center justify-center h-full p-4">
          {specialContent}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`h-full ${className || ''}`}>
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="rounded-md bg-muted w-full mb-3" style={{ aspectRatio: '1 / 1' }}>
          <div className="flex items-center justify-center h-full">
            <div className="text-4xl font-bold uppercase">
              {formatAgentName(name)}
            </div>
          </div>
        </div>
        {extraContent}
      </CardContent>
      <CardFooter className="p-3 pb-4">
        <CardActions {...actionProps} />
      </CardFooter>
    </Card>
  );
} 