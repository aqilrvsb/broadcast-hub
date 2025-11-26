import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, QrCode, Users, MoreVertical, Trash2, Smartphone, Loader2 } from "lucide-react";
import { Device } from "@/pages/Devices";

interface DeviceCardProps {
  device: Device;
  onShowQR: (device: Device) => void;
  onDelete: (device: Device) => void;
  isLoadingQR?: boolean;
}

export const DeviceCard = ({ device, onShowQR, onDelete, isLoadingQR = false }: DeviceCardProps) => {
  const isConnected = device.status === "CONNECTED";

  return (
    <Card className="overflow-hidden border-border hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        <div className="bg-card p-4">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isConnected ? 'bg-primary/10' : 'bg-muted'
            }`}>
              <Smartphone className={`w-6 h-6 ${isConnected ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDelete(device)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <h3 className="font-semibold text-foreground mb-1 truncate">{device.device_name}</h3>
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              isConnected 
                ? 'bg-primary/10 text-primary' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-primary' : 'bg-destructive'
              }`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">{device.phone_number}</p>
          
          <div className="space-y-2">
            {!isConnected && (
              <Button
                onClick={() => onShowQR(device)}
                className="w-full bg-primary hover:bg-primary/90"
                size="sm"
                disabled={isLoadingQR}
              >
                {isLoadingQR ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    QR
                  </>
                )}
              </Button>
            )}
            {isConnected && (
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                size="sm"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                WA
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full border-primary/20 hover:bg-primary/5"
              size="sm"
            >
              <Users className="w-4 h-4 mr-2" />
              Leads
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};