import { useState } from "react";
import { VideoStream } from "@/components/VideoStream";
import { ControlPanel } from "@/components/ControlPanel";
import { Button } from "@/components/ui/button";
import { Grid3x3 } from "lucide-react";
import { toast } from "sonner";

type Status = "operational" | "attention" | "critical";

interface RobotArm {
  id: string;
  name: string;
  status: Status;
}

const mockArms: RobotArm[] = [
  { id: "A1", name: "Assembly Arm Alpha", status: "operational" },
  { id: "A2", name: "Welding Arm Beta", status: "attention" },
  { id: "A3", name: "Pick & Place Gamma", status: "operational" },
  { id: "A4", name: "Sorting Arm Delta", status: "operational" },
  { id: "A5", name: "Inspection Arm Epsilon", status: "critical" },
  { id: "A6", name: "Packaging Arm Zeta", status: "operational" },
];

const Index = () => {
  const [focusedArm, setFocusedArm] = useState<string | null>(null);
  const [arms, setArms] = useState<RobotArm[]>(mockArms);

  const handleArmClick = (armId: string) => {
    setFocusedArm(focusedArm === armId ? null : armId);
  };

  const handleStatusReset = (armId: string) => {
    setArms(arms.map(arm => 
      arm.id === armId ? { ...arm, status: "operational" } : arm
    ));
    toast.success(`${arms.find(a => a.id === armId)?.name} marked as operational`);
  };

  const handleEmergencyStop = (armId: string) => {
    const arm = arms.find(a => a.id === armId);
    toast.error(`Emergency stop activated for ${arm?.name}`, {
      description: "All operations halted. Manual restart required.",
    });
  };

  const needsAttention = arms.filter(
    (arm) => arm.status === "attention" || arm.status === "critical"
  );

  const focusedArmData = arms.find((arm) => arm.id === focusedArm);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Robotics Control Center
              </h1>
              <p className="text-sm text-muted-foreground">
                Real-time Teleoperation Interface
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {needsAttention.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--status-attention))]/10 border border-[hsl(var(--status-attention))]/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--status-attention))] animate-pulse" />
                  <span className="text-sm font-medium text-foreground">
                    {needsAttention.length} {needsAttention.length === 1 ? "arm" : "arms"} need attention
                  </span>
                </div>
              )}
              
              {focusedArm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFocusedArm(null)}
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Show All
                </Button>
              )}
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
              {/* Large focused stream */}
              <div className="lg:col-span-2">
                <VideoStream
                  id={focusedArmData!.id}
                  name={focusedArmData!.name}
                  status={focusedArmData!.status}
                  isFocused={true}
                  onClick={() => {}}
                  onStatusReset={() => handleStatusReset(focusedArmData!.id)}
                  onEmergencyStop={() => handleEmergencyStop(focusedArmData!.id)}
                />
              </div>

              {/* Thumbnail grid */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                {arms
                  .filter((arm) => arm.id !== focusedArm)
                  .slice(0, 4)
                  .map((arm) => (
                    <VideoStream
                      key={arm.id}
                      id={arm.id}
                      name={arm.name}
                      status={arm.status}
                      isFocused={false}
                      onClick={() => handleArmClick(arm.id)}
                      onStatusReset={() => handleStatusReset(arm.id)}
                      onEmergencyStop={() => handleEmergencyStop(arm.id)}
                    />
                  ))}
              </div>
            </div>

            {/* Control Panel */}
            <ControlPanel armName={focusedArmData!.name} />
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {arms.map((arm) => (
              <VideoStream
                key={arm.id}
                id={arm.id}
                name={arm.name}
                status={arm.status}
                isFocused={false}
                onClick={() => handleArmClick(arm.id)}
                onStatusReset={() => handleStatusReset(arm.id)}
                onEmergencyStop={() => handleEmergencyStop(arm.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
