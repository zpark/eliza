import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgents } from '../hooks/use-query-hooks';
import { apiClient } from '../lib/api';
import PageTitle from './page-title';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './ui/button';
import SocketIOManager from '../lib/socketio-manager';
import { cn } from '../lib/utils';

interface LogEntry {
  level: number;
  time: number;
  msg: string;
  agentId?: string;
  agentName?: string;
  roomId?: string;

  [key: string]: string | number | boolean | null | undefined;
}

interface LogResponse {
  logs: LogEntry[];
  count: number;
  total: number;
  level: string;
  levels: string[];
}

interface LogError {
  error: string;
  message?: string;
}

const LOG_LEVEL_NUMBERS = {
  10: 'TRACE',
  20: 'DEBUG',
  27: 'SUCCESS',
  28: 'PROGRESS',
  29: 'LOG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
} as const;

const LOG_LEVEL_COLORS: Record<number, string> = {
  10: 'text-gray-400',
  20: 'text-blue-400',
  27: 'text-green-600',
  28: 'text-purple-400',
  29: 'text-gray-300',
  30: 'text-emerald-400',
  40: 'text-yellow-400',
  50: 'text-red-400',
  60: 'text-red-600',
};

interface LogViewerProps {
  agentName?: string;
  level?: string;
  hideTitle?: boolean;
}

export function LogViewer({ agentName, level, hideTitle }: LogViewerProps = {}) {
  const [selectedLevel, setSelectedLevel] = useState(level || 'all');
  const [selectedAgentName, setSelectedAgentName] = useState(agentName || 'all');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const lastLogId = useRef<string>('');
  const queryClient = useQueryClient();
  const [isRealtime, setIsRealtime] = useState(false);

  const socketManager = useRef(SocketIOManager.getInstance());

  const { data, error, isLoading } = useQuery<LogResponse>({
    queryKey: ['logs', selectedLevel, selectedAgentName],
    queryFn: () =>
      apiClient.getLogs({
        level: selectedLevel === 'all' ? '' : selectedLevel,
        agentName: selectedAgentName === 'all' ? undefined : selectedAgentName,
      }),
    refetchInterval: isRealtime ? false : 1000,
    staleTime: 1000,
    enabled: !isRealtime,
  });

  const { data: agents } = useAgents();
  const agentNames = agents?.data?.agents?.map((agent) => agent.name) ?? [];

  const [realtimeLogs, setRealtimeLogs] = useState<LogEntry[]>([]);

  const handleClearLogs = async () => {
    try {
      setIsClearing(true);
      await apiClient.deleteLogs();

      if (isRealtime) {
        setRealtimeLogs([]);
      } else {
        queryClient.invalidateQueries({ queryKey: ['logs'] });
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    } finally {
      setIsClearing(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    if (!scrollAreaRef.current) return;

    const scrollArea = scrollAreaRef.current;
    const scrollHeight = scrollArea.scrollHeight;
    const clientHeight = scrollArea.clientHeight;

    scrollArea.scrollTo({
      top: scrollHeight - clientHeight,
      behavior: 'instant',
    });
  }, []);

  useEffect(() => {
    const logs = isRealtime ? realtimeLogs : data?.logs;
    if (!logs?.length) return;

    const currentLastLog = logs[logs.length - 1];
    const currentLastLogId = `${currentLastLog.time}-${currentLastLog.msg}`;

    if (shouldAutoScroll && currentLastLogId !== lastLogId.current) {
      setTimeout(scrollToBottom, 0);
      lastLogId.current = currentLastLogId;
    }
  }, [isRealtime ? realtimeLogs : data?.logs, shouldAutoScroll, scrollToBottom]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (isUserScrolling.current) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isNearBottom = distanceFromBottom < 100;

    setShouldAutoScroll(isNearBottom);
    isUserScrolling.current = true;

    setTimeout(() => {
      isUserScrolling.current = false;
    }, 150);
  };

  const handleResumeAutoScroll = () => {
    setShouldAutoScroll(true);
    scrollToBottom();
  };

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const getLevelName = (level: number) => {
    return LOG_LEVEL_NUMBERS[level as keyof typeof LOG_LEVEL_NUMBERS] || 'UNKNOWN';
  };

  const getLevelColor = (level: number) => {
    return LOG_LEVEL_COLORS[level] || 'text-gray-400';
  };

  const formatLogEntry = (log: LogEntry) => {
    const timestamp = format(log.time, 'yyyy-MM-dd HH:mm:ss');
    const level = getLevelName(log.level);

    const numberedFields = Object.entries(log)
      .filter(([key]) => !Number.isNaN(Number(key)))
      .sort((a, b) => Number(a[0]) - Number(b[0]));

    const extraFields =
      numberedFields.length > 0
        ? `\n    ${numberedFields.map(([_, value]) => value).join('\n    ')}`
        : '';

    return (
      <div key={`${log.time}-${log.msg}`} className="whitespace-pre-wrap font-mono">
        <span className="text-gray-500">[{timestamp}]</span>{' '}
        {log.agentName && <span className="text-gray-500">[{log.agentName}]</span>}{' '}
        <span className={getLevelColor(log.level)}>{level}:</span>{' '}
        <span className="text-white">{log.msg}</span>
        <span className="text-gray-300">{extraFields}</span>
      </div>
    );
  };

  const handleNewLogs = (result: LogResponse) => {
    const filteredLogs = result.logs.filter((log) => {
      const agentMatch = selectedAgentName === 'all' || log.agentName === selectedAgentName;
      const levelMatch =
        selectedLevel === 'all' ||
        getLevelName(log.level).toLowerCase() === selectedLevel.toLowerCase();
      return agentMatch && levelMatch;
    });

    setRealtimeLogs((prev) => [...prev, ...filteredLogs]);
  };

  const toggleRealtime = useCallback(() => {
    const newIsRealtime = !isRealtime;
    setIsRealtime(newIsRealtime);

    if (newIsRealtime) {
      const filters = {
        level: selectedLevel === 'all' ? undefined : selectedLevel,
        agentName: selectedAgentName === 'all' ? undefined : selectedAgentName,
      };

      apiClient
        .getLogs(filters)
        .then((result) => {
          setRealtimeLogs(result.logs);
        })
        .catch((error) => {
          console.error('Failed to fetch initial logs:', error);
        });

      socketManager.current.subscribeToLogs(filters);
    } else {
      socketManager.current.unsubscribeFromLogs();
      setRealtimeLogs([]);
    }
  }, [isRealtime, selectedLevel, selectedAgentName]);

  useEffect(() => {
    if (!isRealtime) return;

    const handleLogError = (error: any) => {
      console.error('Realtime log error:', error);
    };

    socketManager.current.on('newLogs', handleNewLogs);
    socketManager.current.on('logError', handleLogError);

    return () => {
      socketManager.current.off('newLogs', handleNewLogs);
      socketManager.current.off('logError', handleLogError);
    };
  }, [isRealtime]);

  useEffect(() => {
    if (!isRealtime) return;

    const filters = {
      level: selectedLevel === 'all' ? undefined : selectedLevel,
      agentName: selectedAgentName === 'all' ? undefined : selectedAgentName,
    };

    apiClient
      .getLogs(filters)
      .then((result) => {
        setRealtimeLogs(result.logs);
      })
      .catch((error) => {
        console.error('Failed to fetch filtered logs:', error);
      });

    socketManager.current.subscribeToLogs(filters);
  }, [isRealtime, selectedLevel, selectedAgentName]);

  useEffect(() => {
    return () => {
      socketManager.current.unsubscribeFromLogs();
    };
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        {!hideTitle && <PageTitle title={'System Logs'} />}
        <div className="flex items-center gap-4">
          <Button
            variant={isRealtime ? 'default' : 'secondary'}
            size="sm"
            onClick={toggleRealtime}
            className={cn(
              'transition-all',
              isRealtime && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            )}
          >
            {isRealtime ? 'Realtime On' : 'Realtime Off'}
          </Button>

          <Button variant="destructive" size="sm" onClick={handleClearLogs} disabled={isClearing}>
            {isClearing ? 'Clearing...' : 'Clear Logs'}
          </Button>

          {!shouldAutoScroll && (
            <button
              type="button"
              onClick={handleResumeAutoScroll}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Resume auto-scroll
            </button>
          )}
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ALL</SelectItem>
              {data?.levels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {agentNames && agentNames.length > 0 && !agentName && (
            <Select value={selectedAgentName} onValueChange={setSelectedAgentName}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ALL AGENTS</SelectItem>
                {agentNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading && !isRealtime ? (
        <div className="font-mono p-4">Loading logs...</div>
      ) : error && !isRealtime ? (
        <div className="text-red-500 font-mono p-4">
          {error instanceof Error ? error.message : 'Failed to fetch logs'}
        </div>
      ) : (
        <ScrollArea className="h-[600px] rounded-md border bg-black">
          <div
            ref={scrollAreaRef}
            onScroll={handleScroll}
            className="p-4 text-sm space-y-1 h-full overflow-auto"
          >
            {(isRealtime ? realtimeLogs : (data?.logs ?? [])).length === 0 ? (
              <div className="text-gray-500 font-mono">
                No {selectedLevel === 'all' ? '' : selectedLevel.toUpperCase()} logs found
                {isRealtime && ' (Waiting for new logs...)'}
              </div>
            ) : (
              (isRealtime ? realtimeLogs : (data?.logs ?? [])).map((log) => formatLogEntry(log))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
