import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "danger" | "info" | "success" | "warning" | "purple";
}

export const StatCard = ({ title, value, icon: Icon, variant = "default" }: StatCardProps) => {
  const variants = {
    default: "bg-card border-border",
    danger: "bg-destructive/10 border-destructive/20",
    info: "bg-info/10 border-info/20",
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    purple: "bg-gradient-to-br from-primary to-accent border-primary/20",
  };

  const iconVariants = {
    default: "text-foreground",
    danger: "text-destructive",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    purple: "text-primary-foreground",
  };

  const valueVariants = {
    default: "text-foreground",
    danger: "text-destructive",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    purple: "text-primary-foreground",
  };

  const titleVariants = {
    default: "text-muted-foreground",
    danger: "text-destructive/80",
    info: "text-info/80",
    success: "text-success/80",
    warning: "text-warning/80",
    purple: "text-primary-foreground/90",
  };

  return (
    <Card className={`p-4 ${variants[variant]} shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${titleVariants[variant]}`}>
            {title}
          </p>
          <p className={`text-2xl font-bold mt-1 ${valueVariants[variant]}`}>
            {value}
          </p>
        </div>
        <div className={`${iconVariants[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
};
