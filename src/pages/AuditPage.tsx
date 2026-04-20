import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navigate } from "react-router-dom";
import { getEditHistory, getUserProfiles, getFirms, getClients, type EditHistoryItem, type Firm, type Client } from "@/lib/firestore";

const AuditPage = () => {
  const { role } = useAuth();
  const [history, setHistory] = useState<EditHistoryItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [firmMap, setFirmMap] = useState<Record<string, string>>({});
  const [clientMap, setClientMap] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState("50");

  useEffect(() => {
    if (role !== "admin") return;
    const fetchHistory = async () => {
      const [data, firms, clients] = await Promise.all([
        getEditHistory(Number(limit)),
        getFirms(),
        getClients(),
      ]);
      setHistory(data);

      const userIds = [...new Set(data.map(h => h.modifiedBy))];
      const map = await getUserProfiles(userIds);
      setProfiles(map);

      const fMap: Record<string, string> = {};
      firms.forEach(f => { fMap[f.id] = f.name; });
      setFirmMap(fMap);

      const cMap: Record<string, string> = {};
      clients.forEach(c => { cMap[c.id] = c.name; });
      setClientMap(cMap);
    };
    fetchHistory();
  }, [limit, role]);

  if (role !== "admin") return <Navigate to="/" replace />;

  const fieldLabels: Record<string, string> = {
    date: "Date",
    billNo: "Bill No",
    description: "Description",
    amount: "Amount",
    entryType: "Type",
  };

  const getChangedFields = (oldData: Record<string, unknown>, newData: Record<string, unknown>) => {
    const changes: { field: string; old: string; new: string }[] = [];
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    for (const key of allKeys) {
      if (key === "updatedBy") continue;
      const oldVal = String(oldData[key] ?? "—");
      const newVal = String(newData[key] ?? "—");
      if (oldVal !== newVal) {
        changes.push({ field: fieldLabels[key] ?? key, old: oldVal, new: newVal });
      }
    }
    return changes;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Track all modifications to ledger entries</p>
        </div>
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="25">Last 25</SelectItem>
            <SelectItem value="50">Last 50</SelectItem>
            <SelectItem value="100">Last 100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Date/Time</TableHead>
                <TableHead className="w-32">Modified By</TableHead>
                <TableHead className="w-56">Entry</TableHead>
                <TableHead>Changed Values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => {
                const changes = getChangedFields(h.oldData, h.newData);
                const firm = h.firmId ? firmMap[h.firmId] : null;
                const client = h.clientId ? clientMap[h.clientId] : null;
                const billNo = h.oldData?.billNo ?? h.newData?.billNo;
                const date = h.oldData?.date ?? h.newData?.date;
                const amount = h.oldData?.amount ?? h.newData?.amount;
                const entryType = h.oldData?.entryType ?? h.newData?.entryType;
                return (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm whitespace-nowrap">{new Date(h.createdAt).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-sm">{profiles[h.modifiedBy] ?? "Unknown"}</TableCell>
                    <TableCell className="text-sm">
                      {firm || client ? (
                        <div className="space-y-0.5">
                          <div className="font-medium">{firm ?? "—"} → {client ?? "—"}</div>
                          <div className="text-muted-foreground text-xs">
                            {billNo ? `Bill ${billNo}` : "No Bill"} | {date ? new Date(String(date)).toLocaleDateString("en-IN") : "—"} | ₹{Number(amount ?? 0).toLocaleString("en-IN")} {String(entryType ?? "").charAt(0).toUpperCase() + String(entryType ?? "").slice(1)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {billNo ? `Bill ${billNo}` : "No Bill"} | {date ? new Date(String(date)).toLocaleDateString("en-IN") : "—"} | ₹{Number(amount ?? 0).toLocaleString("en-IN")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {changes.length > 0 ? (
                        <div className="space-y-1">
                          {changes.map((c, i) => (
                            <div key={i} className="flex gap-1 flex-wrap">
                              <span className="font-medium">{c.field}:</span>
                              <span className="text-destructive line-through">{c.old}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-success font-medium">{c.new}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No changes detected</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {history.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No audit history found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditPage;
