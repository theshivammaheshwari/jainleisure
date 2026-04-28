import { useEffect, useState, useMemo } from "react";
import { useDashboardStats } from "@/contexts/DashboardStatsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, BookOpen, TrendingUp, TrendingDown, Search } from "lucide-react";
import { getFirms, getClients, getAllLedgerEntries, type Firm, type Client, type LedgerEntry } from "@/lib/firestore";

interface ClientBalance {
  clientId: string;
  clientName: string;
  firmId: string;
  firmName: string;
  debit: number;
  credit: number;
  discount: number;
  balance: number;
}

const DashboardPage = () => {
  const { role } = useAuth();
  const { stats, setStats, refreshStats } = useDashboardStats();
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchStats = async () => {
      const [firms, clients, entries] = await Promise.all([
        getFirms(),
        getClients(),
        getAllLedgerEntries(),
      ]);
      let filteredEntries = entries.filter(e => ["debit", "credit", "discount"].includes(e.entryType));
      if (firms.length === 0 || clients.length === 0) {
        filteredEntries = [];
      }
      const totalDebit = filteredEntries.filter(e => e.entryType === "debit").reduce((s, e) => s + Number(e.amount), 0);
      const totalCredit = filteredEntries.filter(e => e.entryType === "credit").reduce((s, e) => s + Number(e.amount), 0);
      const totalDiscount = filteredEntries.filter(e => e.entryType === "discount").reduce((s, e) => s + Number(e.amount), 0);
      setStats({
        firms: firms.length,
        clients: clients.length,
        entries: filteredEntries.length,
        totalDebit,
        totalCredit,
        totalDiscount,
      });
      const firmMap: Record<string, string> = {};
      firms.forEach(f => { firmMap[f.id] = f.name; });
      const clientMap: Record<string, Client> = {};
      clients.forEach(c => { clientMap[c.id] = c; });
      const balMap: Record<string, { debit: number; credit: number; discount: number }> = {};
      for (const e of filteredEntries) {
        const key = e.clientId;
        if (!balMap[key]) balMap[key] = { debit: 0, credit: 0, discount: 0 };
        if (e.entryType === "debit") balMap[key].debit += Number(e.amount);
        else if (e.entryType === "credit") balMap[key].credit += Number(e.amount);
        else balMap[key].discount += Number(e.amount);
      }
      const balances: ClientBalance[] = [];
      for (const [clientId, totals] of Object.entries(balMap)) {
        const client = clientMap[clientId];
        if (!client) continue;
        balances.push({
          clientId,
          clientName: client.name,
          firmId: client.firmId,
          firmName: firmMap[client.firmId] ?? "Unknown",
          debit: totals.debit,
          credit: totals.credit,
          discount: totals.discount,
          balance: totals.debit - totals.credit - totals.discount,
        });
      }
      balances.sort((a, b) => a.firmName.localeCompare(b.firmName) || a.clientName.localeCompare(b.clientName));
      setClientBalances(balances);
    };
    fetchStats();
    // eslint-disable-next-line
  }, [refreshStats]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clientBalances;
    const q = search.trim().toLowerCase();
    return clientBalances.filter(
      (c) => c.clientName.toLowerCase().includes(q) || c.firmName.toLowerCase().includes(q)
    );
  }, [clientBalances, search]);

  // Group by firm
  const groupedByFirm = useMemo(() => {
    const map = new Map<string, { firmName: string; clients: ClientBalance[]; totalDebit: number; totalCredit: number; totalDiscount: number; totalBalance: number }>();
    for (const c of filtered) {
      if (!map.has(c.firmId)) {
        map.set(c.firmId, { firmName: c.firmName, clients: [], totalDebit: 0, totalCredit: 0, totalDiscount: 0, totalBalance: 0 });
      }
      const group = map.get(c.firmId)!;
      group.clients.push(c);
      group.totalDebit += c.debit;
      group.totalCredit += c.credit;
      group.totalDiscount += c.discount;
      group.totalBalance += c.balance;
    }
    return [...map.values()];
  }, [filtered]);

  const cards = [
    { title: "Firms", value: stats?.firms ?? 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Clients", value: stats?.clients ?? 0, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Entries", value: stats?.entries ?? 0, icon: BookOpen, color: "text-violet-600", bg: "bg-violet-50" },
    { title: "Total Debit", value: `₹${(stats?.totalDebit ?? 0).toLocaleString("en-IN")}` , icon: TrendingUp, color: "text-red-600", bg: "bg-red-50" },
    { title: "Total Credit", value: `₹${(stats?.totalCredit ?? 0).toLocaleString("en-IN")}` , icon: TrendingDown, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Total Discount", value: `₹${(stats?.totalDiscount ?? 0).toLocaleString("en-IN")}` , icon: TrendingDown, color: "text-orange-500", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Overview of your ledger system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="card-subtle border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Firm-wise Client Balances */}
      <Card className="border-0 card-subtle">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-lg font-bold">Client Balances</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Firm-wise outstanding balances</p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client or firm..."
                className="pl-8 w-[220px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groupedByFirm.map((group) => (
            <div key={group.firmName}>
              <div className="bg-muted/50 px-4 py-2 border-y">
                <span className="font-semibold text-sm">{group.firmName}</span>
                <span className="text-xs text-muted-foreground ml-2">({group.clients.length} clients)</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right w-28">Debit</TableHead>
                    <TableHead className="text-right w-28">Credit</TableHead>
                    <TableHead className="text-right w-28">Discount</TableHead>
                    <TableHead className="text-right w-32">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.clients.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="font-medium text-sm">{c.clientName}</TableCell>
                      <TableCell className="text-right text-sm text-destructive">₹{c.debit.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right text-sm text-success">₹{c.credit.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right text-sm text-orange-500">₹{c.discount.toLocaleString("en-IN")}</TableCell>
                      <TableCell className={`text-right text-sm font-semibold ${c.balance >= 0 ? "text-destructive" : "text-success"}`}>
                        ₹{Math.abs(c.balance).toLocaleString("en-IN")} {c.balance >= 0 ? "Dr" : "Cr"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell className="text-sm">Total — {group.firmName}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">₹{group.totalDebit.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right text-sm text-success">₹{group.totalCredit.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right text-sm text-orange-500">₹{group.totalDiscount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className={`text-right text-sm font-bold ${group.totalBalance >= 0 ? "text-destructive" : "text-success"}`}>
                      ₹{Math.abs(group.totalBalance).toLocaleString("en-IN")} {group.totalBalance >= 0 ? "Dr" : "Cr"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              {search ? "No clients match your search" : "No ledger entries found"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
