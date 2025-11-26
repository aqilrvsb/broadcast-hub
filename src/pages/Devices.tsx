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
  const [isValidQR, setIsValidQR] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingDeviceId, setLoadingDeviceId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
      
      // Auto-check status for all devices on page load
      if (data && data.length > 0) {
        checkAllDeviceStatuses(data);
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

  const checkAllDeviceStatuses = async (deviceList: Device[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    for (const device of deviceList) {
      if (!device.device_id) {
        // No instance - NOT_SETUP
        await supabase
          .from('devices')
          .update({ status: 'NOT_SETUP' })
          .eq('id', device.id);
        continue;
      }

      try {
        const statusResponse = await fetch(
          `/api/whacenter?endpoint=statusDevice&device_id=${encodeURIComponent(device.device_id)}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
        const statusData = await statusResponse.json();

        if (statusData.status && statusData.data?.status === 'CONNECTED') {
          await supabase
            .from('devices')
            .update({ status: 'CONNECTED' })
            .eq('device_id', device.device_id);
        } else if (statusData.status && statusData.data?.status === 'NOT CONNECTED') {
          await supabase
            .from('devices')
            .update({ status: 'NOT_CONNECTED' })
            .eq('device_id', device.device_id);
        } else {
          await supabase
            .from('devices')
            .update({ status: 'UNKNOWN' })
            .eq('device_id', device.device_id);
        }
      } catch (error) {
        await supabase
          .from('devices')
          .update({ status: 'FAILED' })
          .eq('device_id', device.device_id);
      }
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

  const validateQRCode = (base64Image: string): boolean => {
    // Valid QR codes: Start with PNG header AND length > 2000 chars
    // Invalid/placeholder QR: shorter length (~1500-1800 chars)
    return base64Image.startsWith('iVBORw0KG') && base64Image.length > 2000;
  };

  const handleShowQR = async (device: Device) => {
    if (!device.device_id) {
      toast({
        title: "Error",
        description: "Device ID not found",
        variant: "destructive",
      });
      return;
    }

    setLoadingDeviceId(device.id);
    try {
      // Check device status
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const statusResponse = await fetch(
        `/api/whacenter?endpoint=statusDevice&device_id=${encodeURIComponent(device.device_id)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const statusData = await statusResponse.json();

      console.log('Device status:', statusData);

      if (statusData.status && statusData.data?.status === 'CONNECTED') {
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
        `/api/whacenter?endpoint=qr&device_id=${encodeURIComponent(device.device_id)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!qrResponse.ok) {
        throw new Error(`Failed to fetch QR code: ${qrResponse.status} ${qrResponse.statusText}`);
      }

      let qrData;
      try {
        qrData = await qrResponse.json();
      } catch (parseError) {
        console.error('Failed to parse QR response:', parseError);
        throw new Error("Invalid response from QR endpoint");
      }

      if (qrData.success && qrData.data?.image) {
        const isValid = validateQRCode(qrData.data.image);
        const qrImage = `data:image/png;base64,${qrData.data.image}`;
        
        setQrCode(qrImage);
        setIsValidQR(isValid);
        setSelectedDevice(device);
        setIsQRDialogOpen(true);

        // Update status in database
        await supabase
          .from('devices')
          .update({ status: 'NOT_CONNECTED' })
          .eq('device_id', device.device_id);

        if (!isValid) {
          console.warn('Invalid QR code detected - may be placeholder or expired');
        }
      } else {
        await supabase
          .from('devices')
          .update({ status: 'FAILED' })
          .eq('device_id', device.device_id);

        toast({
          title: "Error",
          description: "Failed to retrieve QR code",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      await supabase
        .from('devices')
        .update({ status: 'UNKNOWN' })
        .eq('device_id', device.device_id);

      toast({
        title: "Error",
        description: error.message || "Failed to check device status",
        variant: "destructive",
      });
    } finally {
      setLoadingDeviceId(null);
    }
  };

  const handleRefreshQR = async () => {
    if (!selectedDevice) return;

    setIsRefreshing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      // 1. Delete old device from WhatsApp Center
      if (selectedDevice.device_id) {
        console.log('Deleting old device:', selectedDevice.device_id);
        await fetch(
          `/api/whacenter?endpoint=deleteDevice&device_id=${encodeURIComponent(selectedDevice.device_id)}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );
      }

      // 2. Create new device
      console.log('Creating new device...');
      const addResponse = await fetch(
        `/api/whacenter?endpoint=addDevice&name=${encodeURIComponent(user.id)}&number=${encodeURIComponent(selectedDevice.phone_number)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const addData = await addResponse.json();

      if (!addData.success || !addData.data?.device?.device_id) {
        throw new Error("Failed to create new device");
      }

      const newDeviceId = addData.data.device.device_id;

      // 3. Set webhook for new device
      await fetch(
        `/api/whacenter?endpoint=setWebhook&device_id=${encodeURIComponent(newDeviceId)}&webhook=`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      // 4. Update database with new device ID
      await supabase
        .from('devices')
        .update({ 
          device_id: newDeviceId,
          status: 'NOT_CONNECTED',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDevice.id);

      // 5. Get fresh QR code
      const qrResponse = await fetch(
        `/api/whacenter?endpoint=qr&device_id=${encodeURIComponent(newDeviceId)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (!qrResponse.ok) {
        throw new Error(`Failed to fetch QR code: ${qrResponse.status} ${qrResponse.statusText}`);
      }

      let qrData;
      try {
        qrData = await qrResponse.json();
      } catch (parseError) {
        console.error('Failed to parse QR response:', parseError);
        throw new Error("Invalid response from QR endpoint");
      }

      if (qrData.success && qrData.data?.image) {
        const isValid = validateQRCode(qrData.data.image);
        const qrImage = `data:image/png;base64,${qrData.data.image}`;
        
        setQrCode(qrImage);
        setIsValidQR(isValid);
        
        // Update selected device with new ID
        setSelectedDevice({
          ...selectedDevice,
          device_id: newDeviceId
        });

        toast({
          title: "QR Code Refreshed",
          description: isValid ? "New QR code generated successfully" : "QR code generated - may need another refresh",
        });

        fetchDevices();
      } else {
        throw new Error(qrData.message || "Failed to get new QR code");
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh QR code",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!device.device_id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      // Delete from WhatsApp Center
      await fetch(
        `/api/whacenter?endpoint=deleteDevice&device_id=${encodeURIComponent(device.device_id)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
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
            isLoadingQR={loadingDeviceId === device.id}
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
        isValidQR={isValidQR}
        onRefresh={handleRefreshQR}
        isRefreshing={isRefreshing}
      />
    </div>
  );
};

export default Devices;