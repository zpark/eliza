import ArrayInput from "@/components/array-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePlugins } from "@/hooks/use-plugins";
import { useToast } from "@/hooks/use-toast";
import type { Character } from "@elizaos/core";
import { Component, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
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

const TWITTER_CHECKBOXES: CheckboxField[] = [
  {
    name: "settings.TWITTER_POST_IMMEDIATELY",
    label: "Post Immediately",
    description: "Automatically post tweets without review",
    getValue: (char) => char.settings?.TWITTER_POST_IMMEDIATELY || false,
  },
  {
    name: "settings.TWITTER_ENABLE_POST_GENERATION",
    label: "Enable Post Generation",
    description: "Allow character to generate Twitter posts",
    getValue: (char) => char.settings?.TWITTER_ENABLE_POST_GENERATION || false,
  },
];

export default function Overview({ character }: { character: Character }) {
  const { toast } = useToast();
  const { data: plugins, error } = usePlugins();

  const [characterValue, setCharacterValue] = useState<Character>(character);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Transform plugins object to array of package names without the github URLs
  const pluginNames = useMemo(() => {
    if (!plugins) return [];
    return Object.keys(plugins).map(name => name.replace(/^@elizaos-plugins\//, '@elizaos/'));
  }, [plugins]);

  // Ensure we always have arrays and normalize plugin names
  const safeCharacterPlugins = useMemo(() => {
    if (!Array.isArray(characterValue?.plugins)) return [];
    return characterValue.plugins;
  }, [characterValue?.plugins]);

  const filteredPlugins = useMemo(() => {
    return pluginNames
      .filter(plugin => !safeCharacterPlugins.includes(plugin))
      .filter(plugin => 
        plugin.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [pluginNames, safeCharacterPlugins, searchQuery]);

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
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Success",
        description: "Character updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update character",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePluginToggle = (plugin: string) => {
    setCharacterValue(prev => {
      const currentPlugins = Array.isArray(prev.plugins) ? prev.plugins : [];
      const newPlugins = currentPlugins.includes(plugin)
        ? currentPlugins.filter(p => p !== plugin)
        : [...currentPlugins, plugin];
      
      return {
        ...prev,
        plugins: newPlugins
      };
    });
  };

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Character Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your AI character's behavior and capabilities</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

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

              <TabsContent value="settings" className="space-y-6">
                <ErrorBoundary>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Plugins</h3>
                        {error ? (
                          <p className="text-destructive">Failed to load plugins: {error.message}</p>
                        ) : (
                          <div className="space-y-4">
                            {safeCharacterPlugins.length > 0 && (
                              <div className="rounded-md bg-muted p-4">
                                <h4 className="text-sm font-medium mb-2">Currently Enabled</h4>
                                <div className="flex flex-wrap gap-2">
                                  {safeCharacterPlugins.map((plugin) => (
                                    <button
                                      type="button"
                                      key={plugin}
                                      className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                                      onClick={() => handlePluginToggle(plugin)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          handlePluginToggle(plugin);
                                        }
                                      }}
                                    >
                                      {plugin} ×
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start">
                                    Search and add plugins...
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-[400px]">
                                  <DialogHeader>
                                    <DialogTitle>Add Plugins</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Input
                                        type="search"
                                        placeholder="Search plugins..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                      />
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto space-y-2">
                                      {filteredPlugins.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                          No plugins found.
                                        </p>
                                      ) : (
                                        filteredPlugins.map((plugin) => (
                                          <Button
                                            key={plugin}
                                            variant="ghost"
                                            className="w-full justify-start font-normal"
                                            onClick={() => {
                                              handlePluginToggle(plugin);
                                              setSearchQuery("");
                                              setIsDialogOpen(false);
                                            }}
                                          >
                                            {plugin}
                                          </Button>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        )}
                      </div>
                      <Separator className="my-6" />
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Twitter Integration</h3>
                        <div className="space-y-4">
                          {TWITTER_CHECKBOXES.map((field) => (
                            <div key={field.name} className="flex items-start space-x-3">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  name={field.name}
                                  checked={field.getValue(characterValue)}
                                  onChange={handleChange}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                              </div>
                              <div className="flex flex-col">
                                <Label>{field.label}</Label>
                                {field.description && (
                                  <p className="text-sm text-muted-foreground">{field.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCharacterValue(character)}
          >
            Reset Changes
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
