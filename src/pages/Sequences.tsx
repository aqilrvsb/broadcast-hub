import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, AlertCircle, Send, CheckCircle, DollarSign, TrendingUp, RotateCcw, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateSequenceDialog } from "@/components/sequences/CreateSequenceDialog";
import { EditSequenceDialog } from "@/components/sequences/EditSequenceDialog";
import { SequenceCard } from "@/components/sequences/SequenceCard";
import { StatCard } from "@/components/sequences/StatCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>("");

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
    setSelectedSequenceId(id);
    setEditDialogOpen(true);
  };

  const handleUpdate = (id: string) => {
    setSelectedSequenceId(id);
    setEditDialogOpen(true);
  };

  const handleFlowUpdate = (id: string) => {
    setSelectedSequenceId(id);
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chatbot AI Conversations</h1>
            <p className="text-sm text-muted-foreground">Monitor and manage your AI-powered chatbot interactions</p>
          </div>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const totalLeads = sequences.reduce((sum, seq) => sum + seq.contacts_count, 0);
  const activeSequences = sequences.filter(seq => seq.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chatbot AI Conversations</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage your AI-powered chatbot interactions</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Lead"
          value={totalLeads}
          icon={MessageSquare}
          variant="default"
        />
        <StatCard
          title="Stuck Intro"
          value="0"
          icon={AlertCircle}
          variant="danger"
        />
        <StatCard
          title="Response"
          value={activeSequences}
          icon={Send}
          variant="info"
        />
        <StatCard
          title="Close"
          value="0"
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Sales"
          value="RM 0"
          icon={DollarSign}
          variant="warning"
        />
        <StatCard
          title="Closing Rate"
          value="0%"
          icon={TrendingUp}
          variant="purple"
        />
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl p-4 shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Select defaultValue="all-devices">
            <SelectTrigger>
              <SelectValue placeholder="All Devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-devices">All Devices</SelectItem>
            </SelectContent>
          </Select>
          
          <Select defaultValue="all-stages">
            <SelectTrigger>
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-stages">All Stages</SelectItem>
            </SelectContent>
          </Select>

          <Input type="date" className="bg-background" />
          <Input type="date" className="bg-background" />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset Filters
          </Button>
          <Button size="sm" className="gap-2 bg-success hover:bg-success/90">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="gap-2 ml-auto">
            <Plus className="h-4 w-4" />
            Create Sequence
          </Button>
        </div>
      </div>

      {/* Sequences List */}
      {sequences.length === 0 ? (
        <div className="bg-card rounded-xl border-2 border-dashed p-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No sequences created yet</p>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Sequence
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border">
          <div className="grid gap-4 p-6">
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
        </div>
      )}

      <CreateSequenceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchSequences}
      />

      {selectedSequenceId && (
        <EditSequenceDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchSequences}
          sequenceId={selectedSequenceId}
        />
      )}
    </div>
  );
};

export default Sequences;
