import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editLead?: {
    id: string;
    name: string;
    phone: string;
    niche: string;
    status: string;
    trigger: string;
    additional_note: string;
  } | null;
}

export const AddLeadDialog = ({ open, onOpenChange, onSuccess, editLead }: AddLeadDialogProps) => {
  const [name, setName] = useState(editLead?.name || "");
  const [phone, setPhone] = useState(editLead?.phone || "");
  const [niche, setNiche] = useState(editLead?.niche || "");
  const [status, setStatus] = useState(editLead?.status || "prospect");
  const [trigger, setTrigger] = useState(editLead?.trigger || "");
  const [additionalNote, setAdditionalNote] = useState(editLead?.additional_note || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone number are required");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please login to add leads");
        return;
      }

      if (editLead) {
        const { error } = await supabase
          .from('leads')
          .update({
            name: name.trim(),
            phone: phone.trim(),
            niche: niche.trim(),
            status,
            trigger: trigger.trim(),
            additional_note: additionalNote.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', editLead.id);

        if (error) throw error;
        toast.success("Lead updated successfully");
      } else {
        const { error } = await supabase
          .from('leads')
          .insert({
            user_id: user.id,
            name: name.trim(),
            phone: phone.trim(),
            niche: niche.trim(),
            status,
            trigger: trigger.trim(),
            additional_note: additionalNote.trim()
          });

        if (error) throw error;
        toast.success("Lead added successfully");
      }

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setName("");
      setPhone("");
      setNiche("");
      setStatus("prospect");
      setTrigger("");
      setAdditionalNote("");
    } catch (error: any) {
      toast.error(error.message || "Failed to save lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#17a2b8] text-white border-none">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-5 w-5 text-white" />
        </button>
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            {editLead ? "Edit Lead" : "Add New Lead"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Name <span className="text-red-300">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Fakhri"
                className="bg-white text-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">
                Phone Number <span className="text-red-300">*</span>
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="60179645043"
                className="bg-white text-foreground"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche" className="text-white">Niche</Label>
              <Input
                id="niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="EXAMA"
                className="bg-white text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-white">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-white text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trigger" className="text-white">Sequence Triggers</Label>
            <Input
              id="trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="fitness_start"
              className="bg-white text-foreground"
            />
            <p className="text-xs text-white/70">Enter sequence triggers to auto-enroll this lead</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-white">Additional Note</Label>
            <Textarea
              id="note"
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder="test"
              className="bg-white text-foreground min-h-[100px]"
            />
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
              className="bg-[#007bff] hover:bg-[#0056b3] text-white"
            >
              {loading ? "Saving..." : editLead ? "Update Lead" : "Save Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
