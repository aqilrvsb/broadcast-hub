import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateSequenceDialog } from "@/components/sequences/CreateSequenceDialog";
import { SequenceCard } from "@/components/sequences/SequenceCard";

interface Sequence {
  id: string;
  name: string;
  niche: string;
  trigger: string;
  description: string;
  schedule_time: string;
  is_active: boolean;
  contacts_count: number;
}

const Sequences = () => {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchSequences = async () => {
    try {
      const { data, error } = await supabase
        .from('sequences')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSequences(data || []);
    } catch (error: any) {
      toast.error("Failed to fetch sequences");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, []);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('sequences')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setSequences(prev =>
        prev.map(seq => (seq.id === id ? { ...seq, is_active: isActive } : seq))
      );
      toast.success(`Sequence ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error: any) {
      toast.error("Failed to update sequence status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sequence?")) return;

    try {
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSequences(prev => prev.filter(seq => seq.id !== id));
      toast.success("Sequence deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete sequence");
    }
  };

  const handleView = (id: string) => {
    toast.info("View functionality coming soon");
  };

  const handleUpdate = (id: string) => {
    toast.info("Update functionality coming soon");
  };

  const handleFlowUpdate = (id: string) => {
    toast.info("Flow update functionality coming soon");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Message Sequences</h2>
            <p className="text-muted-foreground mt-1">Create automated drip campaigns for your contacts</p>
          </div>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Message Sequences</h2>
          <p className="text-muted-foreground mt-1">Create automated drip campaigns for your contacts</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Sequence
        </Button>
      </div>

      {sequences.length === 0 ? (
        <div className="bg-muted/30 rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground mb-4">No sequences created yet</p>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Sequence
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sequences.map((sequence) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              onView={handleView}
              onUpdate={handleUpdate}
              onFlowUpdate={handleFlowUpdate}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      <CreateSequenceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchSequences}
      />
    </div>
  );
};

export default Sequences;
