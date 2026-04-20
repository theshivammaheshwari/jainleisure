import { useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { getFullBackup, restoreFullBackup } from "@/lib/firestore";

const BackupPage = () => {
  const { role } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setIsLoading(true);
    try {
      const backup = await getFullBackup();

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded successfully" });
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.firms && !data.clients && !data.ledgerEntries) {
          toast({ title: "Invalid backup file", description: "File does not contain valid backup data", variant: "destructive" });
          return;
        }
        setPendingBackup(data);
        setConfirmOpen(true);
      } catch {
        toast({ title: "Invalid file", description: "Could not parse JSON file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    // Reset so same file can be selected again
    e.target.value = "";
  };

  const handleRestore = async () => {
    if (!pendingBackup) return;
    setConfirmOpen(false);
    setIsRestoring(true);
    try {
      const counts = await restoreFullBackup(pendingBackup as Parameters<typeof restoreFullBackup>[0]);
      toast({
        title: "Restore complete",
        description: `Restored ${counts.firms} firms, ${counts.clients} clients, ${counts.ledgerEntries} ledger entries, ${counts.editHistory} audit records`,
      });
    } catch (err: unknown) {
      toast({ title: "Restore failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setPendingBackup(null);
    setIsRestoring(false);
  };

  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backup</h1>
        <p className="text-muted-foreground text-sm">Export or restore your complete database</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Download Backup
            </CardTitle>
            <CardDescription>
              Download all firms, clients, ledger entries, and audit history as a JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleBackup} disabled={isLoading} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              {isLoading ? "Exporting..." : "Download Backup"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-orange-500" />
              Restore Backup
            </CardTitle>
            <CardDescription>
              Upload a previously downloaded JSON backup file to restore all data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              {isRestoring ? "Restoring..." : "Upload & Restore"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Restore
            </DialogTitle>
            <DialogDescription>
              This will <strong>delete all existing data</strong> and replace it with the backup file. This action cannot be undone.
              {pendingBackup && (
                <span className="block mt-3 text-sm text-foreground">
                  Backup contains: {(pendingBackup.firms as unknown[])?.length ?? 0} firms, {(pendingBackup.clients as unknown[])?.length ?? 0} clients, {(pendingBackup.ledgerEntries as unknown[])?.length ?? 0} ledger entries, {(pendingBackup.editHistory as unknown[])?.length ?? 0} audit records
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRestore}>Yes, Restore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BackupPage;
