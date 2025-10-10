import { useAuth } from "@/hooks/useAuth";
import { useRobotAssignment } from "@/hooks/useRobotAssignment";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Users, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { robots, assignments, loading } = useRobotAssignment(user?.id);
  const navigate = useNavigate();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const unassignedRobots = robots.filter(
    (robot) => !assignments.some((a) => a.robot_id === robot.id)
  );

  const assignedRobots = robots.filter((robot) =>
    assignments.some((a) => a.robot_id === robot.id)
  );

  const statusConfig = {
    operational: { label: "Operational", className: "bg-[hsl(var(--status-operational))]" },
    attention: { label: "Needs Help", className: "bg-[hsl(var(--status-attention))]" },
    critical: { label: "Critical", className: "bg-[hsl(var(--status-critical))]" },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Super Operator View</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate("/")}>
                <Users className="w-4 h-4 mr-2" />
                Operator View
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Unassigned Robots ({unassignedRobots.length})
            </CardTitle>
            <CardDescription>Robots waiting for operator assignment</CardDescription>
          </CardHeader>
          <CardContent>
            {unassignedRobots.length === 0 ? (
              <p className="text-sm text-muted-foreground">All robots are assigned to operators</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unassignedRobots.map((robot) => (
                  <Card key={robot.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{robot.name}</CardTitle>
                        <Badge className={statusConfig[robot.status].className}>
                          {statusConfig[robot.status].label}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">
                        {robot.task_description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Assigned Robots ({assignedRobots.length})
            </CardTitle>
            <CardDescription>Robots currently assigned to operators</CardDescription>
          </CardHeader>
          <CardContent>
            {assignedRobots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No robots are currently assigned</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedRobots.map((robot) => {
                  const assignment = assignments.find((a) => a.robot_id === robot.id);
                  return (
                    <Card key={robot.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{robot.name}</CardTitle>
                          <Badge className={statusConfig[robot.status].className}>
                            {statusConfig[robot.status].label}
                          </Badge>
                        </div>
                        <CardDescription className="text-sm">
                          {robot.task_description}
                        </CardDescription>
                        {assignment?.focused_operator_id && (
                          <Badge variant="outline" className="mt-2">
                            In Focus
                          </Badge>
                        )}
                        {robot.help_requested && (
                          <Badge variant="destructive" className="mt-2">
                            Help Requested
                          </Badge>
                        )}
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
