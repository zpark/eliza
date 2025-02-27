import ArrayInput from "@/components/array-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Character } from "@elizaos/core";
import React, { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

// Error Boundary Component
export class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          <h4 className="font-medium mb-2">Something went wrong</h4>
          <p className="text-sm">Please try refreshing the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

type NestedObject = {
  [key: string]: string | number | boolean | NestedObject;
};

type UpdateArrayPath = 
  | "bio" 
  | "topics" 
  | "adjectives" 
  | "plugins" 
  | "style.all" 
  | "style.chat" 
  | "style.post";

type InputField = {
  title: string;
  name: string;
  description?: string;
  getValue: (char: Character) => string;
};

type ArrayField = {
  title: string;
  description?: string;
  path: UpdateArrayPath;
  getData: (char: Character) => string[];
};

type CheckboxField = {
  name: string;
  label: string;
  description?: string;
  getValue: (char: Character) => boolean;
};

const TEXT_FIELDS: InputField[] = [
  {
    title: "Name",
    name: "name",
    description: "The display name of your character",
    getValue: (char) => char.name || '',
  },
  {
    title: "Username",
    name: "username",
    description: "Unique identifier for your character",
    getValue: (char) => char.username || '',
  },
  {
    title: "System",
    name: "system",
    description: "System prompt for character behavior",
    getValue: (char) => char.system || '',
  },
  {
    title: "Voice Model",
    name: "settings.voice.model",
    description: "Voice model used for speech synthesis",
    getValue: (char) => char.settings?.voice?.model || '',
  },
];

const ARRAY_FIELDS: ArrayField[] = [
  {
    title: "Bio",
    description: "Key information about your character",
    path: "bio",
    getData: (char) => Array.isArray(char.bio) ? char.bio : [],
  },
  {
    title: "Topics",
    description: "Topics your character is knowledgeable about",
    path: "topics",
    getData: (char) => char.topics || [],
  },
  {
    title: "Adjectives",
    description: "Words that describe your character's personality",
    path: "adjectives",
    getData: (char) => char.adjectives || [],
  },
];

const STYLE_FIELDS: ArrayField[] = [
  {
    title: "All",
    description: "Style rules applied to all interactions",
    path: "style.all",
    getData: (char) => char.style?.all || [],
  },
  {
    title: "Chat",
    description: "Style rules for chat interactions",
    path: "style.chat",
    getData: (char) => char.style?.chat || [],
  },
  {
    title: "Post",
    description: "Style rules for social media posts",
    path: "style.post",
    getData: (char) => char.style?.post || [],
  },
];

export type CharacterFormProps = {
  character: Character;
  title: string;
  description: string;
  onSubmit: (character: Character) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
  onReset?: () => void;
  showPlugins?: boolean;
  showSettings?: boolean;
  submitButtonText?: string;
  deleteButtonText?: string;
  isAgent?: boolean;
  settingsContent?: ReactNode;
};

export default function CharacterForm({
  character,
  title,
  description,
  onSubmit,
  onDelete,
  onCancel,
  onReset,
  showPlugins = false,
  showSettings = false,
  submitButtonText = "Save Changes",
  deleteButtonText = "Delete",
  isAgent = false,
  settingsContent,
}: CharacterFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [characterValue, setCharacterValue] = useState<Character>(character);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (name.includes('.')) {
      const parts = name.split('.');
      setCharacterValue(prev => {
        const newValue = { ...prev };
        let current = newValue as unknown as NestedObject;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]] as NestedObject;
        }
        
        current[parts[parts.length - 1]] = type === 'checkbox' ? checked : value;
        return newValue;
      });
    } else {
      setCharacterValue(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const updateArray = (path: UpdateArrayPath, newData: string[]) => {
    setCharacterValue(prev => {
      const newValue = { ...prev };
      
      if (path.includes('.')) {
        const [parent, child] = path.split('.') as ["style", "all" | "chat" | "post"];
        return {
          ...newValue,
          [parent]: {
            ...(newValue[parent] || {}),
            [child]: newData
          }
        };
      }
      
      return {
        ...newValue,
        [path]: newData
      } as Character;
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(characterValue);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    
    try {
      await onDelete();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="flex w-full mb-4">
            <TabsTrigger 
              value="basic" 
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Basic Info
            </TabsTrigger>
            <TabsTrigger 
              value="content" 
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Content
            </TabsTrigger>
            <TabsTrigger 
              value="style" 
              className="data-[state=active]:bg-white data-[state=active]:text-black"
            >
              Style
            </TabsTrigger>
            {showSettings && (
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:bg-white data-[state=active]:text-black"
              >
                Settings
              </TabsTrigger>
            )}
          </TabsList>
          
          <Card>
            <CardContent className="p-6">
              <TabsContent value="basic" className="space-y-6">
                {TEXT_FIELDS.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>{field.title}</Label>
                    {field.description && (
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    )}
                    {field.name === 'system' ? (
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.getValue(characterValue)}
                        onChange={handleChange}
                        className="min-h-[120px] resize-y"
                      />
                    ) : (
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.getValue(characterValue)}
                        onChange={handleChange}
                      />
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="content" className="space-y-6">
                {ARRAY_FIELDS.slice(0, 3).map((field) => (
                  <div key={field.path} className="space-y-2">
                    <Label htmlFor={field.path}>{field.title}</Label>
                    {field.description && (
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    )}
                    <ArrayInput
                      data={field.getData(characterValue)}
                      onChange={(newData) => updateArray(field.path, newData)}
                    />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="style" className="space-y-6">
                {STYLE_FIELDS.map((field) => (
                  <div key={field.path} className="space-y-2">
                    <Label htmlFor={field.path}>{field.title}</Label>
                    {field.description && (
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    )}
                    <ArrayInput
                      data={field.getData(characterValue)}
                      onChange={(newData) => updateArray(field.path, newData)}
                    />
                  </div>
                ))}
              </TabsContent>

              {showSettings && (
                <TabsContent value="settings" className="space-y-6">
                  <ErrorBoundary>
                    {settingsContent ? (
                      settingsContent
                    ) : (
                      <p>Settings can be implemented based on specific requirements</p>
                    )}
                  </ErrorBoundary>
                </TabsContent>
              )}
            </CardContent>
          </Card>
        </Tabs>

        <div className="flex justify-between gap-4 mt-6">
          <div className="flex gap-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            
            {onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : deleteButtonText}
              </Button>
            )}
          </div>
          
          <div className="flex gap-4">
            {onReset && (
              <Button
                type="button"
                variant="outline"
                onClick={onReset}
              >
                Reset Changes
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : submitButtonText}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
} 