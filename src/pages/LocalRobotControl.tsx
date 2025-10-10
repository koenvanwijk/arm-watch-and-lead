import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VideoStream } from "@/components/VideoStream";
import { ControlPanel } from "@/components/ControlPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, HelpCircle, CheckCircle, XCircle, Save, ArrowLeft, Wifi, WifiOff } from "lucide-react";
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

export default function LocalRobotControl() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [robot, setRobot] = useState<RobotArm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");
  const [robotStatus, setRobotStatus] = useState<"operational" | "attention" | "critical">("operational");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }

    fetchRobot();

    // Set up real-time updates
    const channel = supabase
      .channel(`local-robot-${id}`)
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

    // Monitor online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id, navigate]);

  const fetchRobot = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("robot_arms")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching robot:", error);
        toast.error("Failed to load robot data");
        // Try to continue with cached data if offline
        if (!isOnline) {
          toast.info("Working in offline mode");
        }
      } else {
        setRobot(data as RobotArm);
        setTaskDescription(data.task_description);
        setRobotStatus(data.status as "operational" | "attention" | "critical");
      }
    } catch (error) {
      console.error("Network error:", error);
      if (!isOnline) {
        toast.info("No internet connection - working in offline mode");
      }
    }
    setLoading(false);
  };

  const saveTaskDescription = async () => {
    if (!id || !isOnline) {
      if (!isOnline) {
        toast.error("Cannot save - no internet connection");
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("robot_arms")
        .update({ 
          task_description: taskDescription,
          status: robotStatus 
        })
        .eq("id", id);

      if (error) {
        toast.error("Failed to save task description");
      } else {
        toast.success("Task description saved successfully");
        if (robot) {
          setRobot({ ...robot, task_description: taskDescription, status: robotStatus });
        }
      }
    } catch (error) {
      toast.error("Failed to save - network error");
    } finally {
      setSaving(false);
    }
  };

  const requestHelp = async () => {
    if (!id || !isOnline) {
      if (!isOnline) {
        toast.error("Cannot request help - no internet connection");
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("robot_arms")
        .update({
          help_requested: true,
          status: "attention",
        })
        .eq("id", id);

      if (error) {
        toast.error("Failed to request help");
      } else {
        toast.success("Help requested - remote operators will be notified");
        if (robot) {
          setRobot({ ...robot, help_requested: true, status: "attention" });
        }
      }
    } catch (error) {
      toast.error("Failed to request help - network error");
    }
  };

  const handleEmergencyStop = async () => {
    // Emergency stop should work even offline
    setRobotStatus("critical");
    toast.error("EMERGENCY STOP ACTIVATED");
    
    if (isOnline && id) {
      try {
        await supabase
          .from("robot_arms")
          .update({ status: "critical" })
          .eq("id", id);
      } catch (error) {
        console.error("Failed to sync emergency stop:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading robot...</div>
      </div>
    );
  }

  if (!robot && isOnline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <div className="text-lg mb-2">Robot not found</div>
          <p className="text-muted-foreground mb-4">Robot ID: {id}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = {
    operational: { label: "Operational", icon: CheckCircle, class: "bg-[hsl(var(--status-operational))]" },
    attention: { label: "Needs Attention", icon: AlertTriangle, class: "bg-[hsl(var(--status-attention))]" },
    critical: { label: "Critical", icon: XCircle, class: "bg-[hsl(var(--status-critical))]" },
  };

  const StatusIcon = statusConfig[robotStatus].icon;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">Local Robot Control</h1>
            <div className="flex items-center gap-3">
              <h2 className="text-xl text-muted-foreground">
                {robot?.name || `Robot ${id}`}
              </h2>
              <Badge className={`${statusConfig[robotStatus].class} text-white`}>
                <StatusIcon className="w-4 h-4 mr-1" />
                {statusConfig[robotStatus].label}
              </Badge>
              {robot?.help_requested && (
                <Badge variant="destructive">
                  <HelpCircle className="w-4 h-4 mr-1" />
                  Help Requested
                </Badge>
              )}
              <Badge variant={isOnline ? "default" : "destructive"} className="ml-auto">
                {isOnline ? <Wifi className="w-4 h-4 mr-1" /> : <WifiOff className="w-4 h-4 mr-1" />}
                {isOnline ? "Online" : "Offline"}
              </Badge>
            </div>
          </div>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Task Description Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Current Task</CardTitle>
            <CardDescription>
              Update the robot's task description and status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-description">Task Description</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe what the robot should be doing..."
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="robot-status">Robot Status</Label>
              <Select value={robotStatus} onValueChange={(value: "operational" | "attention" | "critical") => setRobotStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="attention">Needs Attention</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={saveTaskDescription} 
              disabled={saving || !isOnline}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Task & Status"}
            </Button>
          </CardContent>
        </Card>

        {/* Video Streams */}
        {robot && (
          <div className="grid md:grid-cols-2 gap-6">
            <VideoStream
              id={`${robot.id}-overview`}
              name={robot.name}
              cameraType="overview"
              videoUrl={robot.overview_video_url}
              status={robotStatus}
              isFocused={false}
              taskDescription={taskDescription}
              onClick={() => {}}
              onStatusReset={() => setRobotStatus("operational")}
              onEmergencyStop={handleEmergencyStop}
            />
            <VideoStream
              id={`${robot.id}-gripper`}
              name={robot.name}
              cameraType="gripper"
              videoUrl={robot.gripper_video_url}
              status={robotStatus}
              isFocused={false}
              taskDescription={taskDescription}
              onClick={() => {}}
              onStatusReset={() => setRobotStatus("operational")}
              onEmergencyStop={handleEmergencyStop}
            />
          </div>
        )}

        {/* Local Control Panel */}
        <ControlPanel armName={robot?.name || `Robot ${id}`} />

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={requestHelp}
            disabled={robot?.help_requested || !isOnline}
            variant="outline"
            size="lg"
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            {robot?.help_requested ? "Help Already Requested" : "Request Remote Help"}
          </Button>
          
          <Button
            onClick={() => setRobotStatus("operational")}
            variant="default"
            size="lg"
            disabled={robotStatus === "operational"}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Mark as Operational
          </Button>
          
          <Button
            onClick={handleEmergencyStop}
            variant="destructive"
            size="lg"
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            Emergency Stop
          </Button>
        </div>

        {/* Offline Notice */}
        {!isOnline && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-destructive">
                <WifiOff className="w-5 h-5" />
                <div>
                  <p className="font-medium">Working in offline mode</p>
                  <p className="text-sm text-muted-foreground">
                    Some features may be limited. Changes will sync when connection is restored.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}