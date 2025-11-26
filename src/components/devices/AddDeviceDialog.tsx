import { useState, useEffect } from "react";
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
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface AddDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddDeviceDialog = ({ open, onOpenChange, onSuccess }: AddDeviceDialogProps) => {
  const [deviceName, setDeviceName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);
  const [phoneError, setPhoneError] = useState<string>("");
  const { toast } = useToast();

  // Check device name availability
  useEffect(() => {
    if (!deviceName.trim()) {
      setNameAvailable(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingName(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('devices')
          .select('id')
          .eq('user_id', user.id)
          .eq('device_name', deviceName.trim())
          .maybeSingle();

        if (error) throw error;
        setNameAvailable(!data);
      } catch (error) {
        console.error('Error checking device name:', error);
      } finally {
        setIsCheckingName(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [deviceName]);

  // Check phone number availability and validate format
  useEffect(() => {
    if (!phoneNumber.trim()) {
      setPhoneAvailable(null);
      setPhoneError("");
      return;
    }

    // Validate phone number starts with 6
    if (!phoneNumber.trim().startsWith('6')) {
      setPhoneError("Phone number must start with 6");
      setPhoneAvailable(false);
      return;
    } else {
      setPhoneError("");
    }

    const timeoutId = setTimeout(async () => {
      setIsCheckingPhone(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('devices')
          .select('id')
          .eq('user_id', user.id)
          .eq('phone_number', phoneNumber.trim())
          .maybeSingle();

        if (error) throw error;
        setPhoneAvailable(!data);
      } catch (error) {
        console.error('Error checking phone number:', error);
      } finally {
        setIsCheckingPhone(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [phoneNumber]);

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

    if (!phoneNumber.trim().startsWith('6')) {
      toast({
        title: "Invalid Phone Number",
        description: "Phone number must start with 6",
        variant: "destructive",
      });
      return;
    }

    if (nameAvailable === false) {
      toast({
        title: "Device Name Taken",
        description: "This device name is already in use. Please choose another name.",
        variant: "destructive",
      });
      return;
    }

    if (phoneAvailable === false) {
      toast({
        title: "Phone Number Taken",
        description: "This phone number is already registered. Please use a different number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        });
        return;
      }

      // Check device limit (max 3 devices per user)
      const { data: existingDevices, error: countError } = await supabase
        .from('devices')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);

      if (countError) throw countError;

      if (existingDevices && existingDevices.length >= 3) {
        toast({
          title: "Device Limit Reached",
          description: "You can only add up to 3 devices. Please delete an existing device first.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Add device to WhatsApp Center
      console.log('Adding device to WhatsApp Center...');
      const addResponse = await fetch(
        `/api/whacenter?endpoint=addDevice&name=${encodeURIComponent(user.id)}&number=${encodeURIComponent(phoneNumber.trim())}`
      );
      
      const addData = await addResponse.json();
      console.log('WhatsApp Center response:', addData);

      if (!addData.success) {
        throw new Error("Failed to add device to WhatsApp Center");
      }

      const deviceId = addData.data.device.device_id;

      // Set webhook
      await fetch(`/api/whacenter?endpoint=setWebhook&device_id=${encodeURIComponent(deviceId)}&webhook=`);

      // Save to database
      const { error: dbError } = await supabase
        .from('devices')
        .insert({
          user_id: user.id,
          device_name: deviceName.trim(),
          phone_number: phoneNumber.trim(),
          device_id: deviceId,
          status: 'NOT CONNECTED',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(dbError.message);
      }

      toast({
        title: "Success",
        description: "Device added successfully. Please scan the QR code to connect.",
      });
      
      setDeviceName("");
      setPhoneNumber("");
      onOpenChange(false);
      onSuccess();
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
              <div className="relative">
                <Input
                  id="device_name"
                  placeholder="e.g., My Phone, Office WhatsApp"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  disabled={isLoading}
                  className={
                    deviceName.trim() 
                      ? nameAvailable === false 
                        ? "border-destructive pr-10" 
                        : nameAvailable === true 
                        ? "border-success pr-10" 
                        : ""
                      : ""
                  }
                />
                {deviceName.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingName ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : nameAvailable === true ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : nameAvailable === false ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                )}
              </div>
              {deviceName.trim() && (
                <p className={`text-xs ${
                  isCheckingName 
                    ? "text-muted-foreground" 
                    : nameAvailable === true 
                    ? "text-success" 
                    : nameAvailable === false 
                    ? "text-destructive" 
                    : ""
                }`}>
                  {isCheckingName 
                    ? "Checking availability..." 
                    : nameAvailable === true 
                    ? "✓ Device name is available" 
                    : nameAvailable === false 
                    ? "✗ Device name is already taken" 
                    : ""}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">WhatsApp Phone Number</Label>
              <div className="relative">
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="6012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isLoading}
                  className={
                    phoneNumber.trim() 
                      ? phoneAvailable === false || phoneError
                        ? "border-destructive pr-10" 
                        : phoneAvailable === true 
                        ? "border-success pr-10" 
                        : ""
                      : ""
                  }
                />
                {phoneNumber.trim() && !phoneError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingPhone ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : phoneAvailable === true ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : phoneAvailable === false ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : null}
                  </div>
                )}
              </div>
              {phoneNumber.trim() && (
                <p className={`text-xs ${
                  phoneError || phoneAvailable === false
                    ? "text-destructive" 
                    : isCheckingPhone 
                    ? "text-muted-foreground" 
                    : phoneAvailable === true 
                    ? "text-success" 
                    : "text-muted-foreground"
                }`}>
                  {phoneError 
                    ? `✗ ${phoneError}`
                    : isCheckingPhone 
                    ? "Checking availability..." 
                    : phoneAvailable === true 
                    ? "✓ Phone number is available" 
                    : phoneAvailable === false 
                    ? "✗ Phone number is already registered" 
                    : "Must start with 6"}
                </p>
              )}
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
            <Button 
              type="submit" 
              disabled={
                isLoading || 
                isCheckingName || 
                isCheckingPhone || 
                nameAvailable === false || 
                phoneAvailable === false ||
                !deviceName.trim() ||
                !phoneNumber.trim() ||
                !!phoneError
              } 
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};