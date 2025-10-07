import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Power, RotateCcw, Maximize2 } from "lucide-react";
import { useState } from "react";

interface ControlPanelProps {
  armName: string;
}

export const ControlPanel = ({ armName }: ControlPanelProps) => {
  const [joint1, setJoint1] = useState([50]);
  const [joint2, setJoint2] = useState([50]);
  const [joint3, setJoint3] = useState([50]);
  const [joint4, setJoint4] = useState([50]);
  const [joint5, setJoint5] = useState([50]);
  const [gripper, setGripper] = useState([50]);

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{armName} Control</h2>
          <p className="text-sm text-muted-foreground">Leader Arm Input Active</p>
        </div>
        <Badge className="bg-primary text-primary-foreground border-0">
          CONTROLLING
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Joint Controls */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Joint 1 (Base)</label>
              <span className="text-xs text-muted-foreground">{joint1[0]}°</span>
            </div>
            <Slider
              value={joint1}
              onValueChange={setJoint1}
              max={180}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Joint 2 (Shoulder)</label>
              <span className="text-xs text-muted-foreground">{joint2[0]}°</span>
            </div>
            <Slider
              value={joint2}
              onValueChange={setJoint2}
              max={180}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Joint 3 (Elbow)</label>
              <span className="text-xs text-muted-foreground">{joint3[0]}°</span>
            </div>
            <Slider
              value={joint3}
              onValueChange={setJoint3}
              max={180}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Joint 4 (Wrist Pitch)</label>
              <span className="text-xs text-muted-foreground">{joint4[0]}°</span>
            </div>
            <Slider
              value={joint4}
              onValueChange={setJoint4}
              max={180}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Joint 5 (Wrist Roll)</label>
              <span className="text-xs text-muted-foreground">{joint5[0]}°</span>
            </div>
            <Slider
              value={joint5}
              onValueChange={setJoint5}
              max={180}
              step={1}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Gripper</label>
              <span className="text-xs text-muted-foreground">{gripper[0]}%</span>
            </div>
            <Slider
              value={gripper}
              onValueChange={setGripper}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <div className="bg-secondary rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
            
            <Button className="w-full justify-start" variant="secondary">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Position
            </Button>
            
            <Button className="w-full justify-start" variant="secondary">
              <Maximize2 className="w-4 h-4 mr-2" />
              Auto Calibrate
            </Button>
            
            <Button className="w-full justify-start" variant="destructive">
              <Power className="w-4 h-4 mr-2" />
              Emergency Stop
            </Button>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Status Info</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="text-foreground">23ms</span>
              </div>
              <div className="flex justify-between">
                <span>Battery:</span>
                <span className="text-foreground">87%</span>
              </div>
              <div className="flex justify-between">
                <span>Temperature:</span>
                <span className="text-foreground">42°C</span>
              </div>
              <div className="flex justify-between">
                <span>Connection:</span>
                <span className="text-[hsl(var(--status-operational))]">Stable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
