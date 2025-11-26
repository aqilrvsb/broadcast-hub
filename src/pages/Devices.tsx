import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddDeviceDialog } from "@/components/devices/AddDeviceDialog";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { QRDialog } from "@/components/devices/QRDialog";

export interface Device {
  id: string;
  device_name: string;
  phone_number: string;
  device_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const Devices = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
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

  useEffect(() => {
    fetchDevices();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('devices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        fetchDevices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleShowQR = async (device: Device) => {
    if (!device.device_id) return;

    try {
      // Check device status
      const statusResponse = await fetch(
        `/api/whacenter?endpoint=statusDevice&device_id=${encodeURIComponent(device.device_id)}`
      );
      const statusData = await statusResponse.json();

      console.log('Device status:', statusData);

      if (statusData.status && statusData.data.status === 'CONNECTED') {
        // Update status in database
        await supabase
          .from('devices')
          .update({ status: 'CONNECTED' })
          .eq('device_id', device.device_id);

        toast({
          title: "Device Connected",
          description: "This device is already connected to WhatsApp",
        });
        fetchDevices();
        return;
      }

      // Get QR code if not connected
      const qrResponse = await fetch(
        `/api/whacenter?endpoint=qr&device_id=${encodeURIComponent(device.device_id)}`
      );
      const qrData = await qrResponse.json();

      if (qrData.success && qrData.data.image) {
        const qrImage = `data:image/png;base64,${qrData.data.image}`;
        setQrCode(qrImage);
        setSelectedDevice(device);
        setIsQRDialogOpen(true);

        // Update status
        await supabase
          .from('devices')
          .update({ status: 'NOT CONNECTED' })
          .eq('device_id', device.device_id);
      } else {
        toast({
          title: "Error",
          description: "Failed to retrieve QR code",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!device.device_id) return;

    try {
      // Delete from WhatsApp Center
      await fetch(
        `/api/whacenter?endpoint=deleteDevice&device_id=${encodeURIComponent(device.device_id)}`
      );

      // Delete from database
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', device.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Device deleted successfully",
      });

      fetchDevices();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-primary" />
            WhatsApp Devices
          </h2>
          <p className="text-muted-foreground mt-1">Manage your connected WhatsApp accounts</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Device
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onShowQR={handleShowQR}
            onDelete={handleDeleteDevice}
          />
        ))}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed border-border">
          <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No devices added yet</p>
          <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Device
          </Button>
        </div>
      )}

      <AddDeviceDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={fetchDevices}
      />

      <QRDialog
        open={isQRDialogOpen}
        onOpenChange={setIsQRDialogOpen}
        qrCode={qrCode}
        deviceName={selectedDevice?.device_name}
      />
    </div>
  );
};

export default Devices;