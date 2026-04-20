import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { getClients, getFirms, addClient, updateClient, deleteClient, type Client, type Firm } from "@/lib/firestore";

const ClientsPage = () => {
  const { role } = useAuth();
  const [clients, setClients] = useState<(Client & { firmName?: string })[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [firmId, setFirmId] = useState("");
  const [search, setSearch] = useState("");
  const [filterFirm, setFilterFirm] = useState("all");

  const fetchClients = async () => {
    const data = await getClients();
    setClients(data);
  };

  const fetchFirms = async () => {
    const data = await getFirms();
    setFirms(data);
  };

  useEffect(() => { fetchClients(); fetchFirms(); }, []);

  const handleSave = async () => {
    if (!name.trim() || !firmId) return;
    try {
      if (editingClient && role === "admin") {
        await updateClient(editingClient.id, { name: name.trim(), firmId, phone: phone.trim() || undefined, address: address.trim() || undefined });
        toast({ title: "Client updated" });
      } else if (!editingClient) {
        await addClient({ name: name.trim(), firmId, phone: phone.trim() || undefined, address: address.trim() || undefined });
        toast({ title: "Client added" });
      }
      resetForm();
      fetchClients();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (role !== "admin") return;
    if (!confirm("Delete this client? All related ledger data will be removed.")) return;
    try {
      await deleteClient(id);
      toast({ title: "Client deleted" });
      fetchClients();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const resetForm = () => { setOpen(false); setEditingClient(null); setName(""); setPhone(""); setAddress(""); setFirmId(""); };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone ?? "");
    setAddress(client.address ?? "");
    setFirmId(client.firmId);
    setOpen(true);
  };

  const filtered = clients.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesFirm = filterFirm === "all" || c.firmId === filterFirm;
    return matchesSearch && matchesFirm;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm">Manage clients across firms</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setOpen(true); }} className="gradient-primary border-0 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"><Plus className="h-4 w-4 mr-2" />Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Edit Client" : "Add Client"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Firm</Label>
                <Select value={firmId} onValueChange={setFirmId}>
                  <SelectTrigger><SelectValue placeholder="Select firm" /></SelectTrigger>
                  <SelectContent>
                    {firms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter client name" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
              </div>
              <Button onClick={handleSave} className="w-full">{editingClient ? "Update" : "Add"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9" />
        </div>
        <Select value={filterFirm} onValueChange={setFilterFirm}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Firms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Firms</SelectItem>
            {firms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Firm</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden md:table-cell">Address</TableHead>
{role === "admin" && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.firmName}</TableCell>
                  <TableCell className="text-muted-foreground">{client.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">{client.address ?? "—"}</TableCell>
                  {role === "admin" && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(client)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(client.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={role === "admin" ? 5 : 4} className="text-center text-muted-foreground py-8">No clients found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsPage;
