import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

interface QRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrCode: string | null;
  deviceName?: string;
  isValidQR: boolean;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const QRDialog = ({ 
  open, 
  onOpenChange, 
  qrCode, 
  deviceName, 
  isValidQR,
  onRefresh,
  isRefreshing = false
}: QRDialogProps) => {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!open || !isValidQR || isRefreshing) {
      setCountdown(10);
      return;
    }

    // Auto-close countdown for valid QR codes
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Close modal when countdown hits 0
          onOpenChange(false);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, isValidQR, isRefreshing, onOpenChange]);

  // Reset countdown when isRefreshing becomes false (refresh completed)
  useEffect(() => {
    if (!isRefreshing && isValidQR && open) {
      setCountdown(10);
    }
  }, [isRefreshing, isValidQR, open]);

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
              
              {!isValidQR && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg mb-4 w-full">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      QR code may be invalid or expired. Click "Refresh" to generate a new one.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground mb-4">
                Scan this QR code with WhatsApp on your phone
                {deviceName && (
                  <span className="block mt-1 font-medium text-foreground">
                    Device: {deviceName}
                  </span>
                )}
              </p>

              {isValidQR ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Modal will close in {countdown} seconds...
                  </p>
                  <Button 
                    onClick={onRefresh} 
                    variant="outline" 
                    size="sm"
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Now
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={onRefresh} 
                  variant="default"
                  disabled={isRefreshing}
                  className="w-full"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh QR Code
                    </>
                  )}
                </Button>
              )}
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