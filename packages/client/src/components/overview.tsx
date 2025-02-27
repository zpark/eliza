import { usePlugins } from "@/hooks/use-plugins";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import type { Character } from "@elizaos/core";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import CharacterForm from "@/components/character-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Define Twitter checkboxes for agent-specific settings
const TWITTER_CHECKBOXES = [
  {
    name: "settings.TWITTER_POST_IMMEDIATELY",
    label: "Post Immediately",
    description: "Automatically post tweets without review",
    getValue: (char: Character) => char.settings?.TWITTER_POST_IMMEDIATELY || false,
  },
  {
    name: "settings.TWITTER_ENABLE_POST_GENERATION",
    label: "Enable Post Generation",
    description: "Allow character to generate Twitter posts",
    getValue: (char: Character) => char.settings?.TWITTER_ENABLE_POST_GENERATION || false,
  },
];

export default function Overview({ character }: { character: Character }) {
  const { toast } = useToast();
  const { data: plugins, error } = usePlugins();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const agentId = character.id;
  const [characterValue, setCharacterValue] = useState<Character>(character);
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

  const handleSubmit = async (updatedChar: Character) => {
    try {
      // Call the API to update the agent's character
      if (!agentId) {
        throw new Error("Agent ID is missing");
      }

      // Make sure plugins are preserved
      const mergedChar = {
        ...updatedChar,
        plugins: characterValue.plugins // Preserve the plugins from our local state
      };

      // Send the character update request to the agent endpoint
      await apiClient.updateAgent(agentId, mergedChar);
      
      // Invalidate both the agent query and the agents list
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      
      toast({
        title: "Success",
        description: "Agent updated and restarted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update agent",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleStopAgent = async () => {
    try {
      if (!agentId) {
        throw new Error("Agent ID is missing");
      }
      
      await apiClient.stopAgent(agentId);
      
      // Invalidate queries before showing toast and navigating
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      
      toast({
        title: "Success",
        description: "Agent stopped successfully",
      });
      
      // Navigate to home page after successfully stopping the agent
      navigate('/');
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to stop agent",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Custom settings UI for plugins and Twitter integration
  const SettingsContent = () => (
    <>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          key={plugin}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 h-auto"
                          onClick={() => handlePluginToggle(plugin)}
                        >
                          {plugin} ×
                        </Button>
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
                      onChange={(e) => {
                        const { name, checked } = e.target;
                        setCharacterValue(prev => {
                          if (name.includes('.')) {
                            const parts = name.split('.');
                            const newValue = { ...prev };
                            let current: Record<string, unknown> = newValue;
                            
                            for (let i = 0; i < parts.length - 1; i++) {
                              if (!current[parts[i]]) {
                                current[parts[i]] = {};
                              }
                              current = current[parts[i]] as Record<string, unknown>;
                            }
                            
                            current[parts[parts.length - 1]] = checked;
                            return newValue;
                          }
                          
                          return {
                            ...prev,
                            [name]: checked
                          };
                        });
                      }}
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
    </>
  );

  return (
    <CharacterForm
      character={character}
      title="Character Settings" 
      description="Configure your AI character's behavior and capabilities"
      onSubmit={handleSubmit}
      onReset={() => setCharacterValue(character)}
      showSettings={true}
      submitButtonText="Save Changes"
      deleteButtonText="Stop Agent"
      onDelete={handleStopAgent}
      isAgent={true}
      settingsContent={<SettingsContent />}
    />
  );
}
