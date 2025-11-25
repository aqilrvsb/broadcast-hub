import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface QRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: string | null;
  deviceName?: string;
}

export const QRDialog = ({ open, onOpenChange, qrCode, deviceName }: QRDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6">
          {qrCode ? (
            <>
              <div className="bg-muted p-4 rounded-lg mb-4">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Scan this QR code with WhatsApp on your phone
                {deviceName && (
                  <span className="block mt-1 font-medium text-foreground">
                    Device: {deviceName}
                  </span>
                )}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading QR code...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};