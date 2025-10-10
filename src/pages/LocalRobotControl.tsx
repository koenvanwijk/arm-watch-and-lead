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
import { AlertTriangle, HelpCircle, CheckCircle, XCircle, Save, ArrowLeft, Wifi, WifiOff, X, UserCheck } from "lucide-react";
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
        setRobotStatus("attention");
      }
    } catch (error) {
      toast.error("Failed to request help - network error");
    }
  };

  const cancelHelpRequest = async () => {
    if (!id || !isOnline) {
      if (!isOnline) {
        toast.error("Cannot cancel help request - no internet connection");
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("robot_arms")
        .update({
          help_requested: false,
          status: "operational",
        })
        .eq("id", id);

      if (error) {
        toast.error("Failed to cancel help request");
      } else {
        toast.success("Help request canceled");
        if (robot) {
          setRobot({ ...robot, help_requested: false, status: "operational" });
        }
        setRobotStatus("operational");
      }
    } catch (error) {
      toast.error("Failed to cancel help request - network error");
    }
  };

  const markAsResolved = async () => {
    if (!id || !isOnline) {
      if (!isOnline) {
        toast.error("Cannot mark as resolved - no internet connection");
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("robot_arms")
        .update({
          help_requested: false,
          status: "operational",
        })
        .eq("id", id);

      if (error) {
        toast.error("Failed to mark as resolved");
      } else {
        toast.success("Issue marked as resolved - thank you!");
        if (robot) {
          setRobot({ ...robot, help_requested: false, status: "operational" });
        }
        setRobotStatus("operational");
      }
    } catch (error) {
      toast.error("Failed to mark as resolved - network error");
    }
  };

  const markAsOperational = async () => {
    if (!id || !isOnline) {
      if (!isOnline) {
        toast.error("Cannot update status - no internet connection");
      }
      return;
    }

    try {
      const { error } = await supabase
        .from("robot_arms")
        .update({
          status: "operational",
          help_requested: false, // Clear any help requests when marking as operational
        })
        .eq("id", id);

      if (error) {
        toast.error("Failed to update status");
      } else {
        toast.success("Robot status updated to operational");
        if (robot) {
          setRobot({ ...robot, status: "operational", help_requested: false });
        }
        setRobotStatus("operational");
      }
    } catch (error) {
      toast.error("Failed to update status - network error");
    }
  };

  const handleEmergencyStop = async () => {
    // Update local state immediately for emergency stop
    setRobotStatus("critical");
    toast.error("EMERGENCY STOP ACTIVATED");
    
    if (isOnline && id) {
      try {
        const { error } = await supabase
          .from("robot_arms")
          .update({ status: "critical" })
          .eq("id", id);
          
        if (error) {
          console.error("Failed to sync emergency stop:", error);
          toast.error("Failed to sync emergency stop to database");
        } else {
          // Update robot state to match database
          if (robot) {
            setRobot({ ...robot, status: "critical" });
          }
        }
      } catch (error) {
        console.error("Failed to sync emergency stop:", error);
        toast.error("Failed to sync emergency stop - network error");
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

        {/* Help Request Status */}
        {(robot?.help_requested || robotStatus === "attention") && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Help Request Active
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-200">
                      Remote operators have been notified and may be providing assistance
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={markAsResolved}
                    variant="default"
                    size="sm"
                    disabled={!isOnline}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                  <Button
                    onClick={cancelHelpRequest}
                    variant="outline"
                    size="sm"
                    disabled={!isOnline}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel Request
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              onStatusReset={markAsOperational}
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
              onStatusReset={markAsOperational}
              onEmergencyStop={handleEmergencyStop}
            />
          </div>
        )}

        {/* Local Control Panel */}
        <ControlPanel armName={robot?.name || `Robot ${id}`} />

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!robot?.help_requested ? (
            <Button
              onClick={requestHelp}
              variant="outline"
              size="lg"
              disabled={!isOnline}
              className="border-amber-500 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              <HelpCircle className="w-5 h-5 mr-2" />
              Request Remote Help
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={markAsResolved}
                variant="default"
                size="lg"
                disabled={!isOnline}
                className="bg-green-600 hover:bg-green-700"
              >
                <UserCheck className="w-5 h-5 mr-2" />
                Issue Resolved
              </Button>
              <Button
                onClick={cancelHelpRequest}
                variant="outline"
                size="lg"
                disabled={!isOnline}
              >
                <X className="w-5 h-5 mr-2" />
                Cancel Request
              </Button>
            </div>
          )}
          
          <Button
            onClick={markAsOperational}
            variant="default"
            size="lg"
            disabled={robotStatus === "operational" || !isOnline}
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