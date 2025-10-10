import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VideoStream } from "@/components/VideoStream";
import { ControlPanel } from "@/components/ControlPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface RobotArm {
  id: string;
  name: string;
  status: "operational" | "attention" | "critical";
  task_description: string;
  overview_video_url: string;
  gripper_video_url: string;
  help_requested: boolean;
}

export default function RobotControl() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [robot, setRobot] = useState<RobotArm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!id) {
      navigate("/");
      return;
    }

    fetchRobot();

    const channel = supabase
      .channel(`robot-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "robot_arms",
          filter: `id=eq.${id}`,
        },
        () => {
          fetchRobot();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user, navigate]);

  const fetchRobot = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("robot_arms")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching robot:", error);
      toast.error("Failed to load robot");
      navigate("/");
    } else {
      setRobot(data as RobotArm);
    }
    setLoading(false);
  };

  const requestHelp = async () => {
    if (!id || !user) return;

    const { error } = await supabase
      .from("robot_arms")
      .update({
        help_requested: true,
        help_requested_by: user.id,
        status: "attention",
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to request help");
    } else {
      toast.success("Help requested - remote operators will be notified");
    }
  };

  const updateStatus = async (status: "operational" | "attention" | "critical") => {
    if (!id) return;

    const { error } = await supabase
      .from("robot_arms")
      .update({ 
        status,
        help_requested: status === "operational" ? false : robot?.help_requested 
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
    }
  };

  const handleEmergencyStop = () => {
    updateStatus("critical");
    toast.error("EMERGENCY STOP ACTIVATED");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!robot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Robot not found</div>
      </div>
    );
  }

  const statusConfig = {
    operational: { label: "Operational", icon: CheckCircle, class: "bg-[hsl(var(--status-operational))]" },
    attention: { label: "Needs Attention", icon: AlertTriangle, class: "bg-[hsl(var(--status-attention))]" },
    critical: { label: "Critical", icon: XCircle, class: "bg-[hsl(var(--status-critical))]" },
  };

  const StatusIcon = statusConfig[robot.status].icon;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">{robot.name}</h1>
            <div className="flex items-center gap-3">
              <Badge className={`${statusConfig[robot.status].class} text-white`}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {statusConfig[robot.status].label}
              </Badge>
              {robot.help_requested && (
                <Badge variant="destructive">
                  <HelpCircle className="w-4 h-4 mr-1" />
                  Help Requested
                </Badge>
              )}
            </div>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            Back to Dashboard
          </Button>
        </div>

        {/* Task Description */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Current Task</h2>
          <p className="text-muted-foreground">{robot.task_description}</p>
        </Card>

        {/* Video Streams */}
        <div className="grid md:grid-cols-2 gap-6">
          <VideoStream
            id={`${robot.id}-overview`}
            name={robot.name}
            cameraType="overview"
            videoUrl={robot.overview_video_url}
            status={robot.status}
            isFocused={false}
            taskDescription={robot.task_description}
            onClick={() => {}}
            onStatusReset={() => updateStatus("operational")}
            onEmergencyStop={handleEmergencyStop}
          />
          <VideoStream
            id={`${robot.id}-gripper`}
            name={robot.name}
            cameraType="gripper"
            videoUrl={robot.gripper_video_url}
            status={robot.status}
            isFocused={false}
            taskDescription={robot.task_description}
            onClick={() => {}}
            onStatusReset={() => updateStatus("operational")}
            onEmergencyStop={handleEmergencyStop}
          />
        </div>

        {/* Control Panel */}
        <ControlPanel armName={robot.name} />

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={requestHelp}
            disabled={robot.help_requested}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            {robot.help_requested ? "Help Already Requested" : "Request Help from Remote Operator"}
          </Button>
          <Button
            onClick={handleEmergencyStop}
            variant="destructive"
            size="lg"
            className="flex-1"
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            Emergency Stop
          </Button>
        </div>
      </div>
    </div>
  );
}
