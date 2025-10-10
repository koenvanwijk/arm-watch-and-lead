import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const RegisterRobot = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    task_description: "",
    overview_video_url: "",
    gripper_video_url: "",
    status: "operational",
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error("Access denied. Admin privileges required to register robots.");
      navigate(user ? "/" : "/auth");
    }
  }, [authLoading, user, isAdmin, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("robot_arms").insert([
        {
          id: formData.id,
          name: formData.name,
          task_description: formData.task_description,
          overview_video_url: formData.overview_video_url,
          gripper_video_url: formData.gripper_video_url,
          status: formData.status,
        },
      ]);

      if (error) throw error;

      toast.success("Robot registered successfully");
      navigate("/admin");
    } catch (error: any) {
      toast.error(error.message || "Failed to register robot");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Register New Robot</CardTitle>
            <CardDescription>
              Add a new robot arm to the teleoperation system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="id">Robot ID *</Label>
                <Input
                  id="id"
                  required
                  value={formData.id}
                  onChange={(e) =>
                    setFormData({ ...formData, id: e.target.value })
                  }
                  placeholder="e.g., robot-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Robot Name *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Assembly Line Robot A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task_description">Task Description *</Label>
                <Textarea
                  id="task_description"
                  required
                  value={formData.task_description}
                  onChange={(e) =>
                    setFormData({ ...formData, task_description: e.target.value })
                  }
                  placeholder="Describe the robot's current task..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overview_video_url">Overview Video URL *</Label>
                <Input
                  id="overview_video_url"
                  required
                  type="url"
                  value={formData.overview_video_url}
                  onChange={(e) =>
                    setFormData({ ...formData, overview_video_url: e.target.value })
                  }
                  placeholder="https://example.com/overview.mp4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gripper_video_url">Gripper Video URL *</Label>
                <Input
                  id="gripper_video_url"
                  required
                  type="url"
                  value={formData.gripper_video_url}
                  onChange={(e) =>
                    setFormData({ ...formData, gripper_video_url: e.target.value })
                  }
                  placeholder="https://example.com/gripper.mp4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Initial Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Registering..." : "Register Robot"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterRobot;
