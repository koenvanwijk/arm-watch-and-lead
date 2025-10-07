import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

type Status = "operational" | "attention" | "critical";

interface VideoStreamProps {
  id: string;
  name: string;
  status: Status;
  isFocused: boolean;
  onClick: () => void;
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

export const VideoStream = ({ id, name, status, isFocused, onClick }: VideoStreamProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let frame = 0;

    const drawMockFeed = () => {
      // Mock robotic arm visualization
      ctx.fillStyle = "hsl(220, 20%, 10%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = "hsl(189, 95%, 52%, 0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      // Mock arm visualization
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const time = frame * 0.02;

      // Base
      ctx.fillStyle = "hsl(189, 95%, 52%, 0.8)";
      ctx.beginPath();
      ctx.arc(centerX, centerY + 80, 30, 0, Math.PI * 2);
      ctx.fill();

      // Arm segments
      const angle1 = Math.sin(time) * 0.5;
      const angle2 = Math.cos(time * 0.7) * 0.5;

      ctx.strokeStyle = "hsl(189, 95%, 52%)";
      ctx.lineWidth = 8;

      // Segment 1
      const x1 = centerX + Math.cos(angle1) * 60;
      const y1 = centerY + 80 + Math.sin(angle1) * 60;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + 80);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // Segment 2
      const x2 = x1 + Math.cos(angle1 + angle2) * 50;
      const y2 = y1 + Math.sin(angle1 + angle2) * 50;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // End effector
      ctx.fillStyle = status === "attention" ? "hsl(38, 92%, 50%)" : 
                      status === "critical" ? "hsl(0, 85%, 60%)" : "hsl(142, 76%, 36%)";
      ctx.beginPath();
      ctx.arc(x2, y2, 12, 0, Math.PI * 2);
      ctx.fill();

      frame++;
      animationId = requestAnimationFrame(drawMockFeed);
    };

    drawMockFeed();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [status]);

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-300 ${
        isFocused ? "ring-2 ring-primary shadow-[var(--shadow-glow)]" : ""
      }`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full aspect-video bg-card rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="w-full h-full object-cover"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
        
        {/* Info overlay */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
          <div className="flex items-start justify-between">
            <Badge className={config.className}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
            {isFocused && (
              <Badge variant="secondary" className="bg-primary text-primary-foreground border-0">
                FOCUSED
              </Badge>
            )}
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">Camera {id}</p>
          </div>
        </div>

        {/* Hover effect */}
        {isHovered && !isFocused && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-medium">Click to Focus</span>
          </div>
        )}
      </div>
    </div>
  );
};
