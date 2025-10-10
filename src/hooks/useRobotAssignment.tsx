import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface RobotAssignment {
  id: string;
  robot_id: string;
  assigned_operator_id: string | null;
  focused_operator_id: string | null;
  assigned_at: string;
  focused_at: string | null;
}

export const useRobotAssignment = (userId: string | undefined) => {
  const [robots, setRobots] = useState<RobotArm[]>([]);
  const [assignments, setAssignments] = useState<RobotAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    fetchRobots();
    fetchAssignments();

    const robotChannel = supabase
      .channel("robot-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "robot_arms",
        },
        () => {
          fetchRobots();
        }
      )
      .subscribe();

    const assignmentChannel = supabase
      .channel("assignment-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "robot_assignments",
        },
        () => {
          fetchAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(robotChannel);
      supabase.removeChannel(assignmentChannel);
    };
  }, [userId]);

  const fetchRobots = async () => {
    const { data, error } = await supabase
      .from("robot_arms")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching robots:", error);
      toast.error("Failed to load robots");
    } else {
      setRobots((data || []) as RobotArm[]);
    }
    setLoading(false);
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase
      .from("robot_assignments")
      .select("*");

    if (error) {
      console.error("Error fetching assignments:", error);
    } else {
      setAssignments(data || []);
    }
  };

  const claimFocus = async (robotId: string) => {
    if (!userId) return;

    const assignment = assignments.find((a) => a.robot_id === robotId);

    if (assignment) {
      const { error } = await supabase
        .from("robot_assignments")
        .update({
          focused_operator_id: userId,
          focused_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);

      if (error) {
        toast.error("Failed to claim focus");
      } else {
        toast.success("Focus claimed");
      }
    }
  };

  const releaseFocus = async (robotId: string) => {
    const assignment = assignments.find((a) => a.robot_id === robotId);

    if (assignment) {
      const { error } = await supabase
        .from("robot_assignments")
        .update({
          focused_operator_id: null,
          focused_at: null,
        })
        .eq("id", assignment.id);

      if (error) {
        toast.error("Failed to release focus");
      } else {
        toast.success("Focus released");
      }
    }
  };

  const requestHelp = async (robotId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from("robot_arms")
      .update({
        help_requested: true,
        help_requested_by: userId,
        status: "attention",
      })
      .eq("id", robotId);

    if (error) {
      toast.error("Failed to request help");
    } else {
      toast.success("Help requested");
    }
  };

  const updateRobotStatus = async (robotId: string, status: "operational" | "attention" | "critical") => {
    const { error } = await supabase
      .from("robot_arms")
      .update({ status, help_requested: status === "operational" ? false : undefined })
      .eq("id", robotId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
    }
  };

  return {
    robots,
    assignments,
    loading,
    claimFocus,
    releaseFocus,
    requestHelp,
    updateRobotStatus,
  };
};
