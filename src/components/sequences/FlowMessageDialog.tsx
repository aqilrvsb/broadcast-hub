import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface FlowMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowNumber: number;
  onSave: (flowData: FlowData) => void;
  initialData?: FlowData | null;
  sequenceTrigger?: string;
  currentSequenceId?: string;
}

export interface FlowData {
  stepTrigger: string;
  nextTrigger: string;
  delayHours: number;
  message: string;
  imageUrl: string;
  isEnd: boolean;
  continueToSequence?: string;
}

interface Sequence {
  id: string;
  name: string;
  trigger: string;
}

export const FlowMessageDialog = ({ 
  open, 
  onOpenChange, 
  flowNumber, 
  onSave,
  initialData,
  sequenceTrigger = "",
  currentSequenceId
}: FlowMessageDialogProps) => {
  const [stepTrigger, setStepTrigger] = useState("");
  const [nextTrigger, setNextTrigger] = useState("");
  const [delayHours, setDelayHours] = useState(24);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isEnd, setIsEnd] = useState(false);
  const [continueToSequence, setContinueToSequence] = useState<string>("");
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    const fetchSequences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const query = supabase
          .from('sequences')
          .select('id, name, trigger')
          .eq('user_id', user.id)
          .order('name');
        
        if (currentSequenceId) {
          query.neq('id', currentSequenceId);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching sequences:', error);
          return;
        }
        
        if (data) setSequences(data);
      } catch (error) {
        console.error('Error:', error);
      }
    };
    
    if (open) {
      fetchSequences();
    }
  }, [open, currentSequenceId]);

  useEffect(() => {
    if (initialData) {
      setStepTrigger(initialData.stepTrigger);
      setNextTrigger(initialData.nextTrigger);
      setDelayHours(initialData.delayHours);
      setMessage(initialData.message);
      setImageUrl(initialData.imageUrl);
      setIsEnd(initialData.isEnd);
      setContinueToSequence(initialData.continueToSequence || "");
      setImagePreview(initialData.imageUrl);
    } else {
      // Auto-populate based on sequence trigger
      if (sequenceTrigger) {
        const autoStepTrigger = flowNumber === 1 ? sequenceTrigger : `${sequenceTrigger}_day${flowNumber}`;
        const autoNextTrigger = `${sequenceTrigger}_day${flowNumber + 1}`;
        
        setStepTrigger(autoStepTrigger);
        setNextTrigger(autoNextTrigger);
      } else {
        setStepTrigger("");
        setNextTrigger("");
      }
      setDelayHours(24);
      setMessage("");
      setImageUrl("");
      setIsEnd(false);
      setContinueToSequence("");
      setImagePreview("");
    }
  }, [initialData, open, sequenceTrigger, flowNumber]);

  useEffect(() => {
    if (imageUrl) {
      setImagePreview(imageUrl);
    } else {
      setImagePreview("");
    }
  }, [imageUrl]);

  const handleFinish = () => {
    onSave({
      stepTrigger,
      nextTrigger,
      delayHours,
      message,
      imageUrl,
      isEnd,
      continueToSequence: continueToSequence || undefined
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Flow {flowNumber} Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="stepTrigger">
              Step Trigger <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stepTrigger"
              value={stepTrigger}
              onChange={(e) => setStepTrigger(e.target.value)}
              placeholder="it1"
            />
            <p className="text-xs text-muted-foreground">Unique identifier for this step</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nextTrigger">Next Trigger</Label>
              <Input
                id="nextTrigger"
                value={nextTrigger}
                onChange={(e) => setNextTrigger(e.target.value)}
                placeholder="it1_day2"
              />
              <p className="text-xs text-muted-foreground">Leave empty for last step</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delayHours">Delay Hours</Label>
              <Input
                id="delayHours"
                type="number"
                value={delayHours}
                onChange={(e) => setDelayHours(parseInt(e.target.value) || 24)}
                placeholder="24"
              />
              <p className="text-xs text-muted-foreground">Hours to wait before next step</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isEnd"
                checked={isEnd}
                onCheckedChange={(checked) => setIsEnd(checked as boolean)}
              />
              <Label htmlFor="isEnd" className="cursor-pointer">
                This is the end of sequence
              </Label>
            </div>

            {isEnd && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="continueToSequence">Continue to Sequence</Label>
                <Select value={continueToSequence} onValueChange={setContinueToSequence}>
                  <SelectTrigger id="continueToSequence">
                    <SelectValue placeholder="-- Select Next Sequence --" />
                  </SelectTrigger>
                  <SelectContent>
                    {sequences.map((seq) => (
                      <SelectItem key={seq.id} value={seq.id}>
                        {seq.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hello test data bro 😊 Emojis supported"
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              WhatsApp Formatting: *bold* | _italic_ | ~strikethrough~ | ```monospace``` | 😊 Emojis supported
            </p>
          </div>

          <div className="space-y-2">
            <Label>Live Preview</Label>
            <div className="border rounded-lg p-4 bg-muted/30 min-h-[80px]">
              <p className="whitespace-pre-wrap">{message || "Preview will appear here..."}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (Optional)</Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://automation.erprovision.com/public/images/chatgpt/2314174166135"
            />
            <p className="text-xs text-muted-foreground">Enter the full URL of your image</p>
            
            {imagePreview && (
              <div className="mt-3">
                <Label>Image Preview</Label>
                <div className="mt-2 border rounded-lg p-2 bg-muted/30">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="max-w-[200px] max-h-[200px] object-contain"
                    onError={() => setImagePreview("")}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleFinish}
              disabled={!stepTrigger.trim() || !message.trim()}
            >
              Finish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
