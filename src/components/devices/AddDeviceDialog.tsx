import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddDeviceDialog = ({ open, onOpenChange, onSuccess }: AddDeviceDialogProps) => {
  const [deviceName, setDeviceName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deviceName.trim() || !phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('Invoking add-device function...');
      const { data, error } = await supabase.functions.invoke('add-device', {
        body: {
          device_name: deviceName.trim(),
          phone_number: phoneNumber.trim(),
        },
      });

      console.log('add-device response:', { data, error });
      if (error) {
        console.error('add-device error:', error);
        throw error;
      }

      if (data.success) {
        toast({
          title: "Success",
          description: "Device added successfully. Please scan the QR code to connect.",
        });
        setDeviceName("");
        setPhoneNumber("");
        onOpenChange(false);
        onSuccess();
      } else {
        throw new Error(data.error || "Failed to add device");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Add New WhatsApp Device</DialogTitle>
          <DialogDescription>
            Enter device details to connect a new WhatsApp account
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="device_name">Device Name</Label>
              <Input
                id="device_name"
                placeholder="e.g., My Phone, Office WhatsApp"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number">WhatsApp Phone Number</Label>
              <Input
                id="phone_number"
                type="tel"
                placeholder="6012345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Enter number with country code (without + sign). Must start with 60 for Malaysia.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
              {isLoading ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};