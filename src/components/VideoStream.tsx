import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, Power, Check, Radio } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Status = "operational" | "attention" | "critical";
type CameraType = "overview" | "gripper";

interface VideoStreamProps {
  id: string;
  name: string;
  cameraType: CameraType;
  videoUrl?: string;
  status: Status;
  isFocused: boolean;
  onClick: () => void;
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

export const VideoStream = ({ 
  id, 
  name, 
  cameraType,
  videoUrl,
  status, 
  isFocused, 
  onClick, 
  onStatusReset,
  onEmergencyStop 
}: VideoStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Mock status data
  const statusInfo = {
    latency: Math.floor(Math.random() * 30) + 15,
    battery: Math.floor(Math.random() * 30) + 70,
    temperature: Math.floor(Math.random() * 15) + 38,
    connection: "Stable"
  };

  // Update timestamp every second to show live connection
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-play video when component mounts
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.play().catch(err => {
        console.log("Video autoplay prevented:", err);
      });
    }
  }, [videoUrl]);

  return (
    <TooltipProvider>
      <div
        className={`relative group transition-all duration-300 ${
          isFocused ? "ring-2 ring-primary shadow-[var(--shadow-glow)]" : ""
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative w-full aspect-video bg-card rounded-lg overflow-hidden border border-border cursor-pointer" onClick={onClick}>
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
              No video stream available
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
          
          {/* Info overlay */}
          <div className="absolute inset-0 p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-2">
                <Badge className={config.className}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {config.label}
                </Badge>
                <Badge variant="secondary" className="bg-background/80 text-foreground border-border backdrop-blur-sm">
                  <Radio className="w-3 h-3 mr-1 text-[hsl(var(--status-operational))] animate-pulse" />
                  LIVE
                </Badge>
              </div>
              {isFocused && (
                <Badge variant="secondary" className="bg-primary text-primary-foreground border-0">
                  FOCUSED
                </Badge>
              )}
            </div>
            
            <div className="flex items-end justify-between pointer-events-none pr-24">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{name}</h3>
                <p className="text-sm text-muted-foreground">
                  {cameraType === "overview" ? "Overview Camera" : "Gripper Detail"} {id} • {currentTime.toLocaleTimeString([], { hour12: false })}
                </p>
              </div>
            </div>
          </div>

          {/* Hover info tooltip */}
          {isHovered && !isFocused && (
            <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg pointer-events-none">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="text-foreground font-medium">{statusInfo.latency}ms</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Battery:</span>
                  <span className="text-foreground font-medium">{statusInfo.battery}%</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Temp:</span>
                  <span className="text-foreground font-medium">{statusInfo.temperature}°C</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-[hsl(var(--status-operational))] font-medium">{statusInfo.connection}</span>
                </div>
              </div>
            </div>
          )}

          {/* Hover effect */}
          {isHovered && !isFocused && (
            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center pointer-events-none">
              <span className="text-primary font-medium">Click to Focus</span>
            </div>
          )}
        </div>

        {/* Action buttons - always visible */}
        <div className="absolute bottom-4 right-4 flex gap-2 z-10">
          {(status === "attention" || status === "critical") && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="pointer-events-auto bg-[hsl(var(--status-operational))] hover:bg-[hsl(var(--status-operational))]/80 text-white border-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusReset();
                  }}
                >
                  <Check className="w-4 h-4" />
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
                size="sm"
                variant="destructive"
                className="pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onEmergencyStop();
                }}
              >
                <Power className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Emergency Stop</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};
