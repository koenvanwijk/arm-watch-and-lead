import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, Power, Check, Radio, Wifi, WifiOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WebRTCReceiver } from "@/services/webrtc-receiver";
import { QualityLevel } from "@/services/webrtc";

type Status = "operational" | "attention" | "critical";
type CameraType = "overview" | "gripper";

interface VideoStreamProps {
  id: string;
  name: string;
  cameraType: CameraType;
  videoUrl?: string;
  status: Status;
  isFocused: boolean;
  taskDescription: string;
  onClick: () => void;
  onStatusReset: () => void;
  onEmergencyStop: () => void;
  compact?: boolean; // New prop for compact mode without task info and controls
  // WebRTC props
  useWebRTC?: boolean; // Enable WebRTC streaming
  operatorId?: string; // Required for WebRTC
  onFocus?: () => void; // Called when focusing on this robot
  onUnfocus?: () => void; // Called when unfocusing this robot
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
  taskDescription,
  onClick, 
  onStatusReset,
  onEmergencyStop,
  compact = false,
  useWebRTC = false,
  operatorId,
  onFocus,
  onUnfocus
}: VideoStreamProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentVideoUrl, setCurrentVideoUrl] = useState(videoUrl);
  
  // WebRTC state
  const [webrtcReceiver, setWebrtcReceiver] = useState<WebRTCReceiver | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [currentQuality, setCurrentQuality] = useState<QualityLevel>('low');
  const [isConnected, setIsConnected] = useState(false);
  
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Fallback video URLs from public directory
  const fallbackVideos = {
    overview: "/videos/overview-camera.mp4",
    gripper: "/videos/gripper-camera.mp4"
  };

  // Mock status data
  const statusInfo = {
    latency: Math.floor(Math.random() * 30) + 15,
    battery: Math.floor(Math.random() * 30) + 70,
    temperature: Math.floor(Math.random() * 15) + 38,
    connection: "Stable"
  };

  // WebRTC functions
  const initializeWebRTC = useCallback(async () => {
    if (!operatorId) return;

    try {
      const receiver = new WebRTCReceiver(
        id,
        operatorId,
        (stream) => {
          // Display WebRTC stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setIsConnected(true);
        },
        (state) => {
          setConnectionState(state);
          setIsConnected(state === 'connected');
        },
        (quality) => {
          setCurrentQuality(quality);
        }
      );

      await receiver.initialize();
      setWebrtcReceiver(receiver);
      
      console.log('WebRTC receiver initialized for robot:', id);
    } catch (error) {
      console.error('Failed to initialize WebRTC receiver:', error);
    }
  }, [operatorId, id]);

  const cleanupWebRTC = useCallback(async () => {
    if (webrtcReceiver) {
      await webrtcReceiver.cleanup();
      setWebrtcReceiver(null);
      setConnectionState(null);
      setIsConnected(false);
      
      // Reset to video URL if available
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [webrtcReceiver]);

  // Update video URL when prop changes
  useEffect(() => {
    setCurrentVideoUrl(videoUrl);
  }, [videoUrl]);

  // Initialize WebRTC if enabled
  useEffect(() => {
    let mounted = true;
    
    const initWebRTC = async () => {
      if (useWebRTC && operatorId && !webrtcReceiver && mounted) {
        await initializeWebRTC();
      } else if (!useWebRTC && webrtcReceiver && mounted) {
        await cleanupWebRTC();
      }
    };

    initWebRTC();

    return () => {
      mounted = false;
      if (webrtcReceiver) {
        cleanupWebRTC();
      }
    };
  }, [useWebRTC, operatorId, id, webrtcReceiver, initializeWebRTC, cleanupWebRTC]);

  // Handle focus changes for quality adaptation
  useEffect(() => {
    if (webrtcReceiver && connectionState === 'connected') {
      if (isFocused) {
        webrtcReceiver.requestFocus();
        onFocus?.();
      } else {
        webrtcReceiver.releaseFocus();
        onUnfocus?.();
      }
    }
  }, [isFocused, webrtcReceiver, connectionState, onFocus, onUnfocus]);

  // Update timestamp every second to show live connection
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-play video when component mounts
  useEffect(() => {
    if (videoRef.current && currentVideoUrl) {
      videoRef.current.play().catch(err => {
        console.log("Video autoplay prevented:", err);
      });
    }
  }, [currentVideoUrl]);

  // Handle video load error and fall back to local video
  const handleVideoError = () => {
    console.log(`Video load failed for ${currentVideoUrl}, falling back to local video`);
    setCurrentVideoUrl(fallbackVideos[cameraType]);
  };

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
          {(currentVideoUrl || useWebRTC) ? (
            <video
              ref={videoRef}
              src={useWebRTC ? undefined : currentVideoUrl} // Don't set src when using WebRTC
              loop={!useWebRTC} // Don't loop WebRTC streams
              muted
              playsInline
              autoPlay={useWebRTC} // Auto-play WebRTC streams
              onError={useWebRTC ? undefined : handleVideoError} // Don't handle errors for WebRTC
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
                {useWebRTC ? (
                  <Badge variant="secondary" className={`border-border backdrop-blur-sm ${
                    isConnected 
                      ? 'bg-[hsl(var(--status-operational))]/80 text-white' 
                      : connectionState === 'connecting' 
                        ? 'bg-[hsl(var(--status-attention))]/80 text-black animate-pulse'
                        : 'bg-background/80 text-foreground'
                  }`}>
                    {isConnected ? (
                      <>
                        <Wifi className="w-3 h-3 mr-1" />
                        LIVE • {currentQuality.toUpperCase()}
                      </>
                    ) : connectionState === 'connecting' ? (
                      <>
                        <Radio className="w-3 h-3 mr-1 animate-pulse" />
                        CONNECTING
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3 mr-1" />
                        OFFLINE
                      </>
                    )}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-background/80 text-foreground border-border backdrop-blur-sm">
                    <Radio className="w-3 h-3 mr-1 text-[hsl(var(--status-operational))] animate-pulse" />
                    RECORDED
                  </Badge>
                )}
              </div>
              {isFocused && (
                <Badge variant="secondary" className="bg-primary text-primary-foreground border-0">
                  FOCUSED
                </Badge>
              )}
            </div>
            
            <div className={`pointer-events-none ${compact ? 'pr-4' : 'space-y-3 pr-24'}`}>
              {!compact && (
                <div className="bg-primary/90 backdrop-blur-sm px-4 py-3 rounded-lg border-2 border-primary-foreground/20 mb-3">
                  <p className="text-sm font-medium text-primary-foreground uppercase tracking-wide mb-1">Task Instruction</p>
                  <p className="text-base font-semibold text-primary-foreground">{taskDescription}</p>
                </div>
              )}
              <div>
                <h3 className={`font-semibold text-foreground ${compact ? 'text-base' : 'text-lg'}`}>
                  {compact ? `${cameraType === "overview" ? "Overview Camera" : "Gripper Detail"}` : name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {compact ? `${id} • ${currentTime.toLocaleTimeString([], { hour12: false })}` : `${cameraType === "overview" ? "Overview Camera" : "Gripper Detail"} ${id} • ${currentTime.toLocaleTimeString([], { hour12: false })}`}
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

        {/* Action buttons - only show in non-compact mode */}
        {!compact && (
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
        )}
      </div>
    </TooltipProvider>
  );
};
