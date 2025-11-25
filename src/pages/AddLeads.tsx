import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download, Upload, PlusCircle, Users, Edit, Trash2 } from "lucide-react";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Lead {
  id: string;
  name: string;
  phone: string;
  niche: string;
  status: string;
  trigger: string;
  additional_note: string;
}

const AddLeads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [deviceId, setDeviceId] = useState<string>("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);

  useEffect(() => {
    fetchLeads();
    fetchDeviceId();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchQuery, statusFilter, nicheFilter, triggerFilter]);

  const fetchDeviceId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('device_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setDeviceId(data?.device_id || "No device connected");
    } catch (error) {
      console.error("Error fetching device ID:", error);
    }
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please login to view leads");
        return;
      }

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(query) ||
        lead.phone.toLowerCase().includes(query) ||
        lead.niche.toLowerCase().includes(query) ||
        lead.trigger.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Niche filter
    if (nicheFilter !== "all") {
      filtered = filtered.filter(lead => lead.niche === nicheFilter);
    }

    // Trigger filter
    if (triggerFilter === "has") {
      filtered = filtered.filter(lead => lead.trigger && lead.trigger.trim() !== "");
    } else if (triggerFilter === "no") {
      filtered = filtered.filter(lead => !lead.trigger || lead.trigger.trim() === "");
    }

    setFilteredLeads(filtered);
  };

  const handleExport = () => {
    if (filteredLeads.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["name", "phone", "niche", "target_status", "trigger"];
    const csvContent = [
      headers.join(","),
      ...filteredLeads.map(lead =>
        [
          lead.name,
          lead.phone,
          lead.niche,
          lead.status,
          lead.trigger || ""
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Leads exported successfully");
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleEdit = (lead: Lead) => {
    setEditLead(lead);
    setAddDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteLeadId) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', deleteLeadId);

      if (error) throw error;

      toast.success("Lead deleted successfully");
      fetchLeads();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete lead");
    } finally {
      setDeleteLeadId(null);
    }
  };

  const uniqueNiches = Array.from(new Set(leads.map(lead => lead.niche).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border-l-4 border-l-[#17a2b8] p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#17a2b8]" />
              <h2 className="text-xl font-bold text-foreground">
                Lead Management {loading && "- Loading..."}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Device ID: {deviceId} | Total Leads: {leads.length}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={filteredLeads.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button
              onClick={() => {
                setEditLead(null);
                setAddDialogOpen(true);
              }}
              className="gap-2 bg-[#17a2b8] hover:bg-[#138496]"
            >
              <PlusCircle className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, niche, or trigger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
                className={statusFilter === "all" ? "bg-[#17a2b8] hover:bg-[#138496]" : ""}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "prospect" ? "default" : "outline"}
                onClick={() => setStatusFilter("prospect")}
              >
                Prospect
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "customer" ? "default" : "outline"}
                onClick={() => setStatusFilter("customer")}
              >
                Customer
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Niche:</span>
            <Button
              size="sm"
              variant={nicheFilter === "all" ? "default" : "outline"}
              onClick={() => setNicheFilter("all")}
              className={nicheFilter === "all" ? "bg-[#17a2b8] hover:bg-[#138496]" : ""}
            >
              All
            </Button>
            {uniqueNiches.map(niche => (
              <Button
                key={niche}
                size="sm"
                variant={nicheFilter === niche ? "default" : "outline"}
                onClick={() => setNicheFilter(niche)}
              >
                {niche}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Trigger:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={triggerFilter === "all" ? "default" : "outline"}
                onClick={() => setTriggerFilter("all")}
                className={triggerFilter === "all" ? "bg-[#17a2b8] hover:bg-[#138496]" : ""}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={triggerFilter === "has" ? "default" : "outline"}
                onClick={() => setTriggerFilter("has")}
              >
                Has Trigger
              </Button>
              <Button
                size="sm"
                variant={triggerFilter === "no" ? "default" : "outline"}
                onClick={() => setTriggerFilter("no")}
              >
                No Trigger
              </Button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Checkbox
              checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
              onCheckedChange={handleSelectAll}
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Select All
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading leads...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No leads found. Click "Add Lead" to create one.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedLeads.has(lead.id)}
                      onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{lead.niche}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lead.status === 'customer' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {lead.status}
                    </span>
                  </TableCell>
                  <TableCell>{lead.trigger || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(lead)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteLeadId(lead.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddLeadDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) setEditLead(null);
        }}
        onSuccess={fetchLeads}
        editLead={editLead}
      />

      <ImportLeadsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={fetchLeads}
      />

      <AlertDialog open={!!deleteLeadId} onOpenChange={() => setDeleteLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this lead? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddLeads;