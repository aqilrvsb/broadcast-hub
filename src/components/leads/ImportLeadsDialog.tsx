import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, AlertCircle } from "lucide-react";

interface ImportLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ImportLeadsDialog = ({ open, onOpenChange, onSuccess }: ImportLeadsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
  };

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const fileInput = (e.currentTarget.elements.namedItem('file') as HTMLInputElement);
    const file = fileInput?.files?.[0];
    
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please login to import leads");
        return;
      }

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV file must contain headers and at least one data row");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Validate required columns
      const requiredColumns = ['name', 'phone', 'niche', 'target_status'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        toast.error(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
      }

      const leads = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const lead: any = {};
        
        headers.forEach((header, index) => {
          if (header === 'name') lead.name = values[index];
          else if (header === 'phone') lead.phone = values[index];
          else if (header === 'niche') lead.niche = values[index];
          else if (header === 'target_status') lead.status = values[index];
          else if (header === 'trigger') lead.trigger = values[index] || '';
        });
        
        if (lead.name && lead.phone && lead.niche && lead.status) {
          leads.push({
            ...lead,
            user_id: user.id,
            additional_note: ''
          });
        }
      }

      if (leads.length === 0) {
        toast.error("No valid leads found in CSV file");
        return;
      }

      const { error } = await supabase
        .from('leads')
        .insert(leads);

      if (error) throw error;

      toast.success(`Successfully imported ${leads.length} leads`);
      onSuccess();
      onOpenChange(false);
      setFileName("");
    } catch (error: any) {
      toast.error(error.message || "Failed to import leads");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#17a2b8] text-white border-none">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
        >
          <X className="h-5 w-5 text-white" />
        </button>
        
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Import Leads
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleImport} className="space-y-4 mt-4">
          <div className="space-y-3">
            <p className="text-sm text-white">Upload a CSV file with the following columns:</p>
            
            <ul className="space-y-2 text-sm text-white">
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[80px]">name</span>
                <span>(required) - Lead's name</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[80px]">phone</span>
                <span>(required) - Phone number in format like 60123456789</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[80px]">niche</span>
                <span>(required) - Can be single (EXSTART) or multiple (EXSTART,ITADRESS)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[80px]">target_status</span>
                <span>(required) - Either "prospect" or "customer"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold min-w-[80px]">trigger</span>
                <span>(optional) - Can be single (EXSTART) or multiple (EXSTART,ITADRESS)</span>
              </li>
            </ul>

            <div className="bg-[#d1ecf1] text-[#0c5460] p-3 rounded-md flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs">
                <strong>Note:</strong> Only these 5 columns are accepted. Any other columns will be ignored.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="file"
              name="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="flex items-center justify-center w-full h-10 px-4 bg-white text-foreground rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
            >
              {fileName || "Choose File"}
            </label>
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
              {loading ? "Importing..." : "Import"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
