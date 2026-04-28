import React, { createContext, useContext, useState, useCallback } from "react";

export interface DashboardStats {
  firms: number;
  clients: number;
  entries: number;
  totalDebit: number;
  totalCredit: number;
  totalDiscount: number;
}

interface DashboardStatsContextType {
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;
  refreshStats: () => void;
  refreshKey: number;
}

const DashboardStatsContext = createContext<DashboardStatsContextType | undefined>(undefined);

export const useDashboardStats = () => {
  const ctx = useContext(DashboardStatsContext);
  if (!ctx) throw new Error("useDashboardStats must be used within DashboardStatsProvider");
  return ctx;
};

export const DashboardStatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshStats = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <DashboardStatsContext.Provider value={{ stats, setStats, refreshStats, refreshKey }}>
      {children}
    </DashboardStatsContext.Provider>
  );
};
