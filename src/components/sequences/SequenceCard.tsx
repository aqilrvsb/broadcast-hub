import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Eye, Pencil, Workflow, Trash2, Users } from "lucide-react";

interface SequenceCardProps {
  sequence: {
    id: string;
    name: string;
    niche: string;
    trigger: string;
    description: string;
    schedule_time: string;
    is_active: boolean;
    contacts_count: number;
  };
  onView: (id: string) => void;
  onUpdate: (id: string) => void;
  onFlowUpdate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export const SequenceCard = ({
  sequence,
  onView,
  onUpdate,
  onFlowUpdate,
  onDelete,
  onToggleActive,
}: SequenceCardProps) => {
  return (
    <div className="border rounded-lg p-6 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-foreground">{sequence.name}</h3>
            <Badge variant={sequence.is_active ? "default" : "secondary"} className={sequence.is_active ? "bg-green-600" : "bg-gray-500"}>
              {sequence.is_active ? "active" : "inactive"}
            </Badge>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium">Niche:</span> {sequence.niche} | <span className="font-medium">Time:</span> {sequence.schedule_time}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium">Trigger:</span> {sequence.trigger}
            </p>
          </div>
        </div>
      </div>

      <p className="text-foreground mb-4">{sequence.description}</p>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{sequence.contacts_count} contacts</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(sequence.id)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdate(sequence.id)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Update
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFlowUpdate(sequence.id)}
            className="gap-2 text-yellow-600 border-yellow-600 hover:bg-yellow-50"
          >
            <Workflow className="h-4 w-4" />
            Flow Update
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(sequence.id)}
            className="gap-2 text-red-600 border-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <div className="flex items-center gap-2 ml-2">
            <Switch
              checked={sequence.is_active}
              onCheckedChange={(checked) => onToggleActive(sequence.id, checked)}
            />
            <span className="text-sm text-muted-foreground">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
