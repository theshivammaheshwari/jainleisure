import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { getFirms, addFirm, updateFirm, deleteFirm, type Firm } from "@/lib/firestore";

const FirmsPage = () => {
  const { role } = useAuth();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [open, setOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<Firm | null>(null);
  const [name, setName] = useState("");

  const fetchFirms = async () => {
    const data = await getFirms();
    setFirms(data);
  };

  useEffect(() => { fetchFirms(); }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      if (editingFirm) {
        await updateFirm(editingFirm.id, name.trim());
        toast({ title: "Firm updated" });
      } else {
        await addFirm(name.trim());
        toast({ title: "Firm added" });
      }
      setOpen(false);
      setEditingFirm(null);
      setName("");
      fetchFirms();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this firm? All related data will be removed.")) return;
    try {
      await deleteFirm(id);
      toast({ title: "Firm deleted" });
      fetchFirms();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const openEdit = (firm: Firm) => {
    setEditingFirm(firm);
    setName(firm.name);
    setOpen(true);
  };

  const openAdd = () => {
    setEditingFirm(null);
    setName("");
    setOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Firms</h1>
          <p className="text-muted-foreground text-sm">Manage your business firms</p>
        </div>
        {role === "admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} className="gradient-primary border-0 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"><Plus className="h-4 w-4 mr-2" />Add Firm</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFirm ? "Edit Firm" : "Add Firm"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Firm Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter firm name" />
                </div>
                <Button onClick={handleSave} className="w-full">{editingFirm ? "Update" : "Add"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                {role === "admin" && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.map((firm) => (
                <TableRow key={firm.id}>
                  <TableCell className="font-medium">{firm.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(firm.createdAt).toLocaleDateString("en-IN")}</TableCell>
                  {role === "admin" && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(firm)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(firm.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {firms.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No firms found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirmsPage;
