import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Printer, Download, Search, AlertTriangle } from "lucide-react";
import { getFirms, getClientsByFirm, getLedgerEntries, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, checkDuplicateBillNo, type Firm, type Client, type LedgerEntry } from "@/lib/firestore";
import { useDashboardStats } from "@/contexts/DashboardStatsContext";

const getFinancialYear = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= 3 ? `${year}-${(year + 1).toString().slice(2)}` : `${year - 1}-${year.toString().slice(2)}`;
};

const currentFY = getFinancialYear(new Date());

const LedgerPage = () => {
  const { user, role } = useAuth();
  const { refreshStats } = useDashboardStats();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [selectedFirm, setSelectedFirm] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [financialYear, setFinancialYear] = useState(currentFY);
  const [open, setOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formBillNo, setFormBillNo] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<string>("debit");
  const [billWarning, setBillWarning] = useState<string | null>(null);

  const [billSearch, setBillSearch] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getFirms().then(setFirms);
  }, []);

  useEffect(() => {
    if (!selectedFirm) { setClients([]); return; }
    getClientsByFirm(selectedFirm).then((data) => { setClients(data); setSelectedClient(""); });
  }, [selectedFirm]);

  const fetchEntries = useCallback(async () => {
    if (!selectedClient || !selectedFirm) { setEntries([]); return; }
    const [startYear] = financialYear.split("-").map(Number);
    const fyStart = `${startYear}-04-01`;
    const fyEnd = `${startYear + 1}-03-31`;
    const data = await getLedgerEntries(selectedFirm, selectedClient, fyStart, fyEnd);

    // Auto carry-forward: Sync the opening balance with the actual previous year balance
    const prevStartYear = startYear - 1;
    const prevFyStart = `${prevStartYear}-04-01`;
    const prevFyEnd = `${prevStartYear + 1}-03-31`;
    const prevData = await getLedgerEntries(selectedFirm, selectedClient, prevFyStart, prevFyEnd);
    
    let prevBalance = 0;
    for (const e of prevData) {
      if (e.entryType === "debit") prevBalance += Number(e.amount);
      else prevBalance -= Number(e.amount); // credit or discount
    }

    const expectedAmount = Math.abs(prevBalance);
    const expectedType = prevBalance >= 0 ? "debit" : "credit"; // 0 can default to debit, but we handle 0 below
    const expectedDesc = `Opening Balance from FY ${prevStartYear}-${(prevStartYear + 1).toString().slice(2)}`;

    const existingOpeningBalances = data.filter((e) => (e.description ?? "").toLowerCase().startsWith("opening balance"));

    if (prevBalance === 0) {
      if (existingOpeningBalances.length > 0) {
        for (const ob of existingOpeningBalances) {
          await deleteLedgerEntry(ob.id);
        }
        setEntries(data.filter(e => !(e.description ?? "").toLowerCase().startsWith("opening balance")));
        return;
      }
    } else {
      if (existingOpeningBalances.length === 0) {
        // Create new
        await addLedgerEntry({
          firmId: selectedFirm,
          clientId: selectedClient,
          date: fyStart,
          billNo: undefined,
          description: expectedDesc,
          amount: expectedAmount,
          entryType: expectedType,
          createdBy: user!.uid,
        });
        const updated = await getLedgerEntries(selectedFirm, selectedClient, fyStart, fyEnd);
        setEntries(updated);
        toast({ title: "Opening Balance", description: `₹${expectedAmount.toLocaleString("en-IN")} ${expectedType === "debit" ? "Dr" : "Cr"} carried forward` });
        return;
      } else {
        // Check if needs update
        const ob = existingOpeningBalances[0];
        if (ob.amount !== expectedAmount || ob.entryType !== expectedType) {
          await updateLedgerEntry(ob.id, {
            ...ob,
            amount: expectedAmount,
            entryType: expectedType,
            updatedBy: user!.uid,
          });
          const updated = await getLedgerEntries(selectedFirm, selectedClient, fyStart, fyEnd);
          setEntries(updated);
          toast({ title: "Opening Balance Updated", description: `Synced from previous FY: ₹${expectedAmount.toLocaleString("en-IN")} ${expectedType === "debit" ? "Dr" : "Cr"}` });
          return;
        }
        // Cleanup duplicates if any
        if (existingOpeningBalances.length > 1) {
          for (let i = 1; i < existingOpeningBalances.length; i++) {
            await deleteLedgerEntry(existingOpeningBalances[i].id);
          }
          const updated = await getLedgerEntries(selectedFirm, selectedClient, fyStart, fyEnd);
          setEntries(updated);
          return;
        }
      }
    }

    setEntries(data);
  }, [selectedClient, selectedFirm, financialYear, user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const entriesWithBalance = useMemo(() => {
    let balance = 0;
    return entries.map((e) => {
      if (e.entryType === "debit") balance += Number(e.amount);
      else balance -= Number(e.amount);
      return { ...e, balance };
    });
  }, [entries]);

  // Filter by bill search
  const filteredEntries = useMemo(() => {
    if (!billSearch.trim()) return entriesWithBalance;
    const q = billSearch.trim().toLowerCase();
    return entriesWithBalance.filter((e) => (e.billNo ?? "").toLowerCase().includes(q));
  }, [entriesWithBalance, billSearch]);

  // Group entries by bill no
  const groupedByBill = useMemo(() => {
    const groups: { billNo: string; entries: typeof filteredEntries; debit: number; credit: number; discount: number; balance: number }[] = [];
    const map = new Map<string, typeof filteredEntries>();
    for (const e of filteredEntries) {
      const key = e.billNo ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const [billNo, billEntries] of map) {
      const debit = billEntries.filter(e => e.entryType === "debit").reduce((s, e) => s + Number(e.amount), 0);
      const credit = billEntries.filter(e => e.entryType === "credit").reduce((s, e) => s + Number(e.amount), 0);
      const discount = billEntries.filter(e => e.entryType === "discount").reduce((s, e) => s + Number(e.amount), 0);
      groups.push({ billNo, entries: billEntries, debit, credit, discount, balance: debit - credit - discount });
    }
    return groups;
  }, [filteredEntries]);

  const resetForm = () => {
    setEditingEntry(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormBillNo("");
    setFormDesc("");
    setFormAmount("");
    setFormType("debit");
    setBillWarning(null);
    setOpen(false);
  };

  const handleSave = async () => {
    if (!formAmount || !selectedFirm || !selectedClient) return;

    // Check duplicate bill no (strict: block if different client has same bill in this firm)
    const billNo = formBillNo.trim();
    if (billNo) {
      const check = await checkDuplicateBillNo(selectedFirm, billNo, selectedClient);
      if (check.duplicate) {
        setBillWarning(`Bill No "${billNo}" is already assigned to client: ${check.clientName}`);
        toast({ title: "Duplicate Bill No", description: `Bill No "${billNo}" belongs to ${check.clientName}. Use a different number.`, variant: "destructive" });
        return;
      }
    }

    try {
      if (editingEntry) {
        const oldData = {
          date: editingEntry.date,
          billNo: editingEntry.billNo,
          description: editingEntry.description,
          amount: editingEntry.amount,
          entryType: editingEntry.entryType,
        };
        await updateLedgerEntry(
          editingEntry.id,
          { date: formDate, billNo: formBillNo.trim() || undefined, description: formDesc.trim() || undefined, amount: parseFloat(formAmount), entryType: formType, updatedBy: user!.uid, firmId: selectedFirm, clientId: selectedClient },
          oldData
        );
        toast({ title: "Entry updated" });
      } else {
        await addLedgerEntry({
          firmId: selectedFirm,
          clientId: selectedClient,
          date: formDate,
          billNo: formBillNo.trim() || undefined,
          description: formDesc.trim() || undefined,
          amount: parseFloat(formAmount),
          entryType: formType,
          createdBy: user!.uid,
        });
        toast({ title: "Entry added" });
      }
      resetForm();
      fetchEntries();
      refreshStats();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    try {
      await deleteLedgerEntry(id);
      toast({ title: "Entry deleted" });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      refreshStats();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const openEdit = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setFormDate(entry.date);
    setFormBillNo(entry.billNo ?? "");
    setFormDesc(entry.description ?? "");
    setFormAmount(String(entry.amount));
    setFormType(entry.entryType);
    setOpen(true);
  };

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = "Date,Bill No,Description,Debit,Credit,Discount,Balance\n";
    const rows = entriesWithBalance.map((e) => {
      const debit = e.entryType === "debit" ? e.amount : "";
      const credit = e.entryType === "credit" ? e.amount : "";
      const discount = e.entryType === "discount" ? e.amount : "";
      return `${e.date},${e.billNo ?? ""},${e.description ?? ""},${debit},${credit},${discount},${e.balance}`;
    }).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${financialYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const firmName = firms.find(f => f.id === selectedFirm)?.name ?? "";
  const clientName = clients.find(c => c.id === selectedClient)?.name ?? "";

  // Generate FY options (show next FY only after 1 April, with date check)
  const fyOptions = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed, April = 3
  const currentDate = now.getDate();

  // Current true financial year logic:
  // If we are before April 1st, we are still in currentYear - 1
  const isPastAprilFirst = currentMonth > 3 || (currentMonth === 3 && currentDate >= 1);
  const currentFYStartYear = isPastAprilFirst ? currentYear : currentYear - 1;

  // Always show current FY and previous 2 FYs
  for (let i = currentFYStartYear - 2; i <= currentFYStartYear; i++) {
    fyOptions.push(`${i}-${(i + 1).toString().slice(2)}`);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted-foreground text-sm">View and manage ledger entries</p>
        </div>
        <div className="flex gap-2 no-print">
          {selectedClient && (
            <>
              <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print</Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
              <Button size="sm" onClick={() => { resetForm(); setOpen(true); }} className="gradient-primary border-0 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"><Plus className="h-4 w-4 mr-2" />Add Entry</Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap no-print">
        <Select value={selectedFirm} onValueChange={setSelectedFirm}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Firm" /></SelectTrigger>
          <SelectContent>
            {firms.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedClient} onValueChange={setSelectedClient} disabled={!selectedFirm}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Client" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={financialYear} onValueChange={setFinancialYear}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {fyOptions.map((fy) => <SelectItem key={fy} value={fy}>FY {fy}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedClient && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
              placeholder="Search Bill No..."
              className="pl-8 w-[180px]"
            />
          </div>
        )}
      </div>

      {/* Entry Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "New Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bill No</Label>
                <Input value={formBillNo} onChange={(e) => { setFormBillNo(e.target.value); setBillWarning(null); }} placeholder="e.g. V.B 3752" />
                {billWarning && (
                  <div className="flex items-start gap-1.5 text-destructive text-xs mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{billWarning}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editingEntry ? "Update" : "Add Entry"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ledger Table */}
      {selectedClient ? (
        <div ref={printRef}>
          {/* Print header */}
          <div className="hidden print:block mb-4 text-center">
            <h2 className="text-lg font-bold">{firmName}</h2>
            <p className="text-sm">Client: {clientName} | FY: {financialYear}</p>
          </div>

          <Card className="print:shadow-none print:border">
            <CardContent className="p-0">
              <Table className="print-ledger-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Date</TableHead>
                    <TableHead className="w-28">Bill No</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right w-28">Debit</TableHead>
                    <TableHead className="text-right w-28">Credit</TableHead>
                    <TableHead className="text-right w-28">Discount</TableHead>
                    <TableHead className="text-right w-32">Balance</TableHead>
                    <TableHead className="w-20 no-print">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedByBill.map((group) => (
                    <>
                      {/* Bill group header */}
                      {groupedByBill.length > 1 && (
                        <TableRow key={`header-${group.billNo}`} className="bg-muted/40">
                          <TableCell colSpan={8} className="text-sm font-semibold py-1.5">
                            Bill No: {group.billNo}
                          </TableCell>
                        </TableRow>
                      )}
                      {/* Bill entries */}
                      {group.entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">{new Date(entry.date).toLocaleDateString("en-IN")}</TableCell>
                          <TableCell className="text-sm">{entry.billNo ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.description ?? "—"}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-destructive">
                            {entry.entryType === "debit" ? `₹${Number(entry.amount).toLocaleString("en-IN")}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-success">
                            {entry.entryType === "credit" ? `₹${Number(entry.amount).toLocaleString("en-IN")}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium text-orange-500">
                            {entry.entryType === "discount" ? `₹${Number(entry.amount).toLocaleString("en-IN")}` : ""}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${entry.balance >= 0 ? "text-destructive" : "text-success"}`}>
                            ₹{Math.abs(entry.balance).toLocaleString("en-IN")} {entry.balance >= 0 ? "Dr" : "Cr"}
                          </TableCell>
                          <TableCell className="no-print">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}><Pencil className="h-3 w-3" /></Button>
                              {role === "admin" && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Bill subtotal */}
                      {groupedByBill.length > 1 && (
                        <TableRow key={`sub-${group.billNo}`} className="bg-muted/20 border-b-2">
                          <TableCell colSpan={3} className="text-sm font-semibold text-right">Bill {group.billNo} Subtotal</TableCell>
                          <TableCell className="text-right text-sm font-semibold text-destructive">
                            {group.debit > 0 ? `₹${group.debit.toLocaleString("en-IN")}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-success">
                            {group.credit > 0 ? `₹${group.credit.toLocaleString("en-IN")}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold text-orange-500">
                            {group.discount > 0 ? `₹${group.discount.toLocaleString("en-IN")}` : ""}
                          </TableCell>
                          <TableCell className={`text-right text-sm font-bold ${group.balance >= 0 ? "text-destructive" : "text-success"}`}>
                            ₹{Math.abs(group.balance).toLocaleString("en-IN")} {group.balance >= 0 ? "Dr" : "Cr"}
                          </TableCell>
                          <TableCell className="no-print" />
                        </TableRow>
                      )}
                    </>
                  ))}
                  {filteredEntries.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{billSearch ? "No entries match this bill number" : "No entries found"}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {filteredEntries.length > 0 && (
            <div className="mt-4 flex justify-end">
              <Card className="w-72">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Debit:</span>
                    <span className="font-medium text-destructive">₹{filteredEntries.filter(e => e.entryType === "debit").reduce((s, e) => s + Number(e.amount), 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Credit:</span>
                    <span className="font-medium text-success">₹{filteredEntries.filter(e => e.entryType === "credit").reduce((s, e) => s + Number(e.amount), 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Discount:</span>
                    <span className="font-medium text-orange-500">₹{filteredEntries.filter(e => e.entryType === "discount").reduce((s, e) => s + Number(e.amount), 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                    <span>Balance:</span>
                    {(() => {
                      const bal = entriesWithBalance[entriesWithBalance.length - 1]?.balance ?? 0;
                      return <span className={bal >= 0 ? "text-destructive" : "text-success"}>₹{Math.abs(bal).toLocaleString("en-IN")} {bal >= 0 ? "Dr" : "Cr"}</span>;
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select a firm and client to view their ledger
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LedgerPage;
