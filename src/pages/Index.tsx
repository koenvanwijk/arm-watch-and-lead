import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { VideoStream } from "@/components/VideoStream";
import { ArmInfoPanel } from "@/components/ArmInfoPanel";
import { ControlPanel } from "@/components/ControlPanel";
import { Button } from "@/components/ui/button";
import { Grid3x3, LogOut, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRobotAssignment } from "@/hooks/useRobotAssignment";

type Status = "operational" | "attention" | "critical";
type CameraType = "overview" | "gripper";

interface CameraView {
  armId: string;
  cameraType: CameraType;
  armName: string;
  status: Status;
  videoUrl: string;
  taskDescription: string;
  helpRequested: boolean;
  hasFocus: boolean;
  isAssignedToMe: boolean;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const { robots, assignments, loading, claimFocus, releaseFocus, requestHelp, updateRobotStatus } = useRobotAssignment(user?.id);
  const [focusedArm, setFocusedArm] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  const myAssignments = assignments.filter((a) => a.assigned_operator_id === user.id);
  const myRobots = robots.filter((robot) =>
    myAssignments.some((a) => a.robot_id === robot.id)
  );

  const handleArmClick = async (armId: string) => {
    const assignment = assignments.find((a) => a.robot_id === armId);
    
    if (!assignment?.focused_operator_id) {
      await claimFocus(armId);
    }
    
    setFocusedArm(focusedArm === armId ? null : armId);
  };

  const handleStatusReset = async (armId: string) => {
    await updateRobotStatus(armId, "operational");
  };

  const handleEmergencyStop = (armId: string) => {
    const robot = robots.find((r) => r.id === armId);
    toast.error(`Emergency stop activated for ${robot?.name}`, {
      description: "All operations halted. Manual restart required.",
    });
  };

  const handleHelpRequest = async (armId: string) => {
    await requestHelp(armId);
  };

  const needsAttention = myRobots.filter(
    (robot) => robot.status === "attention" || robot.status === "critical" || robot.help_requested
  );

  const focusedRobotData = robots.find((robot) => robot.id === focusedArm);

  const cameraViews: CameraView[] = myRobots.flatMap((robot) => {
    const assignment = assignments.find((a) => a.robot_id === robot.id);
    const hasFocus = assignment?.focused_operator_id === user.id;
    const isAssignedToMe = assignment?.assigned_operator_id === user.id;
    
    return [
      {
        armId: robot.id,
        cameraType: "overview" as CameraType,
        armName: robot.name,
        status: robot.status as Status,
        videoUrl: robot.overview_video_url,
        taskDescription: robot.task_description,
        helpRequested: robot.help_requested,
        hasFocus,
        isAssignedToMe,
      },
      {
        armId: robot.id,
        cameraType: "gripper" as CameraType,
        armName: robot.name,
        status: robot.status as Status,
        videoUrl: robot.gripper_video_url,
        taskDescription: robot.task_description,
        helpRequested: robot.help_requested,
        hasFocus,
        isAssignedToMe,
      },
    ];
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Robotics Control Center
              </h1>
              <p className="text-sm text-muted-foreground">
                Operator: {user.email} {isAdmin && "(Admin)"}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {needsAttention.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--status-attention))]/10 border border-[hsl(var(--status-attention))]/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-attention))] animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    {needsAttention.length} {needsAttention.length === 1 ? "robot needs" : "robots need"} attention
                  </span>
                </div>
              )}
              
              {focusedArm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    releaseFocus(focusedArm);
                    setFocusedArm(null);
                  }}
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Show All
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin")}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {focusedArm ? (
          /* Focused View */
          <div className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left side - Arm info and both cameras */}
              <div className="lg:col-span-2 space-y-4">
                <ArmInfoPanel
                  armId={focusedArm}
                  armName={focusedRobotData!.name}
                  taskDescription={focusedRobotData!.task_description}
                  status={focusedRobotData!.status as Status}
                  onStatusReset={() => handleStatusReset(focusedArm)}
                  onEmergencyStop={() => handleEmergencyStop(focusedArm)}
                />
                
                {/* Both camera feeds in compact mode */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cameraViews
                    .filter((cam) => cam.armId === focusedArm)
                    .map((cam) => (
                      <VideoStream
                        key={`${cam.armId}-${cam.cameraType}`}
                        id={cam.armId}
                        name={cam.armName}
                        cameraType={cam.cameraType}
                        videoUrl={cam.videoUrl}
                        status={cam.status}
                        isFocused={true}
                        taskDescription={cam.taskDescription}
                        onClick={() => {}}
                        onStatusReset={() => handleStatusReset(cam.armId)}
                        onEmergencyStop={() => handleEmergencyStop(cam.armId)}
                        compact={true}
                      />
                    ))}
                </div>
              </div>

              {/* Right side - Thumbnail grid */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                {cameraViews
                  .filter((cam) => cam.armId !== focusedArm && cam.cameraType === "overview")
                  .slice(0, 4)
                  .map((cam) => (
                    <VideoStream
                      key={`${cam.armId}-${cam.cameraType}`}
                      id={cam.armId}
                      name={cam.armName}
                      cameraType={cam.cameraType}
                      videoUrl={cam.videoUrl}
                      status={cam.status}
                      isFocused={false}
                      taskDescription={cam.taskDescription}
                      onClick={() => handleArmClick(cam.armId)}
                      onStatusReset={() => handleStatusReset(cam.armId)}
                      onEmergencyStop={() => handleEmergencyStop(cam.armId)}
                    />
                  ))}
              </div>
            </div>

            <ControlPanel armName={focusedRobotData!.name} />
          </div>
        ) : (
          <div className="space-y-8">
            {myRobots.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No robots assigned yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Robots will be automatically assigned as they become available
                </p>
              </div>
            ) : (
              myRobots.map((robot) => (
                <div key={robot.id} className="space-y-3">
                  <h2 className="text-lg font-semibold text-foreground">{robot.name}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cameraViews
                      .filter((cam) => cam.armId === robot.id)
                      .map((cam) => (
                        <VideoStream
                          key={`${cam.armId}-${cam.cameraType}`}
                          id={cam.armId}
                          name={cam.armName}
                          cameraType={cam.cameraType}
                          videoUrl={cam.videoUrl}
                          status={cam.status}
                          isFocused={false}
                          taskDescription={cam.taskDescription}
                          onClick={() => handleArmClick(cam.armId)}
                          onStatusReset={() => handleStatusReset(cam.armId)}
                          onEmergencyStop={() => handleEmergencyStop(cam.armId)}
                        />
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
