import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const taskSchema = z.object({
  task_description: z
    .string()
    .trim()
    .min(1, { message: "Task description cannot be empty" })
    .max(500, { message: "Task description must be less than 500 characters" }),
});

interface EditTaskDialogProps {
  robotId: string;
  robotName: string;
  currentTask: string;
  variant?: "icon" | "default";
}

export const EditTaskDialog = ({ 
  robotId, 
  robotName, 
  currentTask,
  variant = "icon" 
}: EditTaskDialogProps) => {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState(currentTask);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate input
    const result = taskSchema.safeParse({ task_description: task });
    
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await supabase
      .from("robot_arms")
      .update({ task_description: task })
      .eq("id", robotId);

    setIsSubmitting(false);

    if (updateError) {
      toast.error("Failed to update task description");
      console.error("Error updating task:", updateError);
    } else {
      toast.success("Task description updated");
      setOpen(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTask(currentTask);
      setError(null);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Task Description</DialogTitle>
            <DialogDescription>
              Update the task description for {robotName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="task">Task Description</Label>
              <Textarea
                id="task"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Enter task description..."
                className="min-h-[100px]"
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{error && <span className="text-destructive">{error}</span>}</span>
                <span>{task.length}/500</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
