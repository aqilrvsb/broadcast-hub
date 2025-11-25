import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FlowMessageDialog, FlowData } from "./FlowMessageDialog";
import { Check, Plus } from "lucide-react";

interface EditSequenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  sequenceId: string;
}

export const EditSequenceDialog = ({ open, onOpenChange, onSuccess, sequenceId }: EditSequenceDialogProps) => {
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [trigger, setTrigger] = useState("");
  const [description, setDescription] = useState("");
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(15);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [flows, setFlows] = useState<{ [key: number]: FlowData }>({});
  const [flowDialogOpen, setFlowDialogOpen] = useState(false);
  const [currentFlow, setCurrentFlow] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSequenceData = async () => {
      if (!open || !sequenceId) return;

      try {
        // Fetch sequence data
        const { data: sequence, error: seqError } = await supabase
          .from('sequences')
          .select('*')
          .eq('id', sequenceId)
          .single();

        if (seqError) throw seqError;

        setName(sequence.name);
        setNiche(sequence.niche);
        setTrigger(sequence.trigger);
        setDescription(sequence.description);
        setMinDelay(sequence.min_delay);
        setMaxDelay(sequence.max_delay);
        setScheduleTime(sequence.schedule_time);

        // Fetch flows
        const { data: flowsData, error: flowsError } = await supabase
          .from('sequence_flows')
          .select('*')
          .eq('sequence_id', sequenceId)
          .order('flow_number');

        if (flowsError) throw flowsError;

        if (flowsData) {
          const flowsMap: { [key: number]: FlowData } = {};
          flowsData.forEach((flow) => {
            flowsMap[flow.flow_number] = {
              stepTrigger: flow.step_trigger,
              nextTrigger: flow.next_trigger,
              delayHours: flow.delay_hours,
              message: flow.message,
              imageUrl: flow.image_url,
              isEnd: flow.is_end,
              continueToSequence: flow.continue_to_sequence
            };
          });
          setFlows(flowsMap);
        }
      } catch (error: any) {
        toast.error("Failed to load sequence data");
        console.error(error);
      }
    };

    fetchSequenceData();
  }, [open, sequenceId]);

  const handleFlowClick = (flowNumber: number) => {
    setCurrentFlow(flowNumber);
    setFlowDialogOpen(true);
  };

  const handleFlowSave = (flowData: FlowData) => {
    setFlows(prev => ({ ...prev, [currentFlow]: flowData }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !niche.trim() || !trigger.trim() || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      // Update sequence
      const { error: sequenceError } = await supabase
        .from('sequences')
        .update({
          name: name.trim(),
          niche: niche.trim(),
          trigger: trigger.trim(),
          description: description.trim(),
          min_delay: minDelay,
          max_delay: maxDelay,
          schedule_time: scheduleTime,
        })
        .eq('id', sequenceId);

      if (sequenceError) throw sequenceError;

      // Delete existing flows
      const { error: deleteError } = await supabase
        .from('sequence_flows')
        .delete()
        .eq('sequence_id', sequenceId);

      if (deleteError) throw deleteError;

      // Insert updated flows
      if (Object.keys(flows).length > 0) {
        const flowsData = Object.entries(flows).map(([flowNumber, flowData]) => ({
          sequence_id: sequenceId,
          flow_number: parseInt(flowNumber),
          step_trigger: flowData.stepTrigger,
          next_trigger: flowData.nextTrigger,
          delay_hours: flowData.delayHours,
          message: flowData.message,
          image_url: flowData.imageUrl,
          is_end: flowData.isEnd,
          continue_to_sequence: flowData.continueToSequence
        }));

        const { error: flowsError } = await supabase
          .from('sequence_flows')
          .insert(flowsData);

        if (flowsError) throw flowsError;
      }

      toast.success("Sequence updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update sequence");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Edit Sequence</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Sequence Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niche">
                  Niche <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger">Sequence Trigger</Label>
              <Input
                id="trigger"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This trigger will be used to identify and enroll leads into this sequence
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Sequence Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minDelay">Min Delay (seconds)</Label>
                <Input
                  id="minDelay"
                  type="number"
                  value={minDelay}
                  onChange={(e) => setMinDelay(parseInt(e.target.value) || 5)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDelay">Max Delay (seconds)</Label>
                <Input
                  id="maxDelay"
                  type="number"
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(parseInt(e.target.value) || 15)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduleTime">Schedule Time</Label>
                <Input
                  id="scheduleTime"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Sequence Flow</Label>
              <div className="grid grid-cols-7 gap-3">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((flowNum) => (
                  <button
                    key={flowNum}
                    type="button"
                    onClick={() => handleFlowClick(flowNum)}
                    className={`border-2 rounded-lg p-4 text-center hover:border-primary transition-colors ${
                      flows[flowNum] ? 'border-green-500 bg-green-50' : 'border-border'
                    }`}
                  >
                    <div className="text-sm font-medium mb-2">Flow {flowNum}</div>
                    {flows[flowNum] ? (
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    ) : (
                      <Plus className="h-4 w-4 mx-auto text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Sequence"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <FlowMessageDialog
        open={flowDialogOpen}
        onOpenChange={setFlowDialogOpen}
        flowNumber={currentFlow}
        onSave={handleFlowSave}
        initialData={flows[currentFlow]}
        sequenceTrigger={trigger}
        currentSequenceId={sequenceId}
      />
    </>
  );
};
