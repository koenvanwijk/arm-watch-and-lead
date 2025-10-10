import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, Power, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditTaskDialog } from "./EditTaskDialog";

type Status = "operational" | "attention" | "critical";

interface ArmInfoPanelProps {
  armId: string;
  armName: string;
  taskDescription: string;
  status: Status;
  onStatusReset: () => void;
  onEmergencyStop: () => void;
}

const statusConfig = {
  operational: {
    label: "Operational",
    icon: CheckCircle,
    className: "bg-[hsl(var(--status-operational))] text-white border-0",
  },
  attention: {
    label: "Needs Help",
    icon: AlertCircle,
    className: "bg-[hsl(var(--status-attention))] text-black border-0 animate-pulse",
  },
  critical: {
    label: "Critical",
    icon: XCircle,
    className: "bg-[hsl(var(--status-critical))] text-white border-0 animate-pulse",
  },
};

export const ArmInfoPanel = ({ 
  armId,
  armName, 
  taskDescription, 
  status, 
  onStatusReset, 
  onEmergencyStop 
}: ArmInfoPanelProps) => {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">{armName}</h2>
              <Badge className={config.className}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            
            <div className="bg-primary/10 backdrop-blur-sm px-4 py-3 rounded-lg border-2 border-primary/20">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Task Instruction</p>
                  <p className="text-lg font-semibold text-foreground">{taskDescription}</p>
                </div>
                <EditTaskDialog 
                  robotId={armId}
                  robotName={armName}
                  currentTask={taskDescription}
                  variant="icon"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {(status === "attention" || status === "critical") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="default"
                    variant="secondary"
                    className="bg-[hsl(var(--status-operational))] hover:bg-[hsl(var(--status-operational))]/80 text-white border-0"
                    onClick={onStatusReset}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark as Resolved</p>
                </TooltipContent>
              </Tooltip>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="default"
                  variant="destructive"
                  onClick={onEmergencyStop}
                >
                  <Power className="w-4 h-4 mr-2" />
                  Emergency Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Emergency Stop</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
