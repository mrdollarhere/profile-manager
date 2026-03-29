import { useState, useEffect, type FormEvent } from "react";
import { Plus, Trash2, Rocket, Shield, Globe, User, X, Loader2, Fingerprint as FingerprintIcon, Monitor, Cpu, Edit, Cookie, Activity, Clock, Server } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { generateFingerprint, type Fingerprint } from "@/src/lib/fingerprint";

interface Group {
  id: number;
  name: string;
  color: string;
}

interface Profile {
  id: number;
  name: string;
  proxyHost: string | null;
  proxyPort: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  fingerprint: string | null;
  cookies: string | null;
  group_id: number | null;
  createdAt: string;
  wsEndpoint?: string;
}

interface Session {
  profileId: number;
  profileName: string;
  startTime: number;
  wsEndpoint: string;
  ip: string;
  proxyHost: string | null;
}

function Uptime({ startTime }: { startTime: number }) {
  const [uptime, setUptime] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - startTime;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
      parts.push(`${seconds % 60}s`);
      
      setUptime(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{uptime}</span>;
}

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null);
  const [cookieProfileId, setCookieProfileId] = useState<number | null>(null);
  const [cookieJson, setCookieJson] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [launchingId, setLaunchingId] = useState<number | null>(null);
  const [stoppingId, setStoppingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [proxyTestResults, setProxyTestResults] = useState<Record<number, { success: boolean; data?: any; error?: string }>>({});
  const [currentView, setCurrentView] = useState<"profiles" | "sessions" | "scripts">("profiles");
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [scripts, setScripts] = useState<string[]>([]);
  const [scriptLogs, setScriptLogs] = useState<Record<string, string[]>>({});
  const [runningScript, setRunningScript] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    proxyHost: "",
    proxyPort: "",
    proxyUsername: "",
    proxyPassword: "",
    group_id: null as number | null,
    fingerprint: null as Fingerprint | null,
  });

  const [groupFormData, setGroupFormData] = useState({
    name: "",
    color: "#f97316", // Default orange
  });

  useEffect(() => {
    Promise.all([fetchProfiles(), fetchGroups(), fetchScripts()]).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.runId && data.text) {
        setScriptLogs(prev => ({
          ...prev,
          [data.runId]: [...(prev[data.runId] || []), data.text]
        }));
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentView === "sessions") {
      fetchSessions();
      interval = setInterval(fetchSessions, 3000);
    } else {
      // Still fetch once in a while to update the badge count
      fetchSessions();
      interval = setInterval(fetchSessions, 10000);
    }
    return () => clearInterval(interval);
  }, [currentView]);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setActiveSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    }
  };

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/scripts");
      const data = await res.json();
      setScripts(data);
    } catch (error) {
      console.error("Failed to fetch scripts:", error);
    }
  };

  const runScript = async (scriptName: string, profileId: number) => {
    setRunningScript(scriptName);
    try {
      const res = await fetch("/api/scripts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptName, profileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      (window as any)[`last_run_${scriptName}`] = data.runId;
      setScriptLogs(prev => ({ ...prev, [data.runId]: [] }));
    } catch (error) {
      console.error("Failed to run script:", error);
      alert(error instanceof Error ? error.message : "Failed to run script");
    } finally {
      setRunningScript(null);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(data);
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      setGroups(data);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  };

  const handleGenerateFingerprint = () => {
    // Use a random seed for new profiles
    const seed = Math.floor(Math.random() * 1000000);
    const fp = generateFingerprint(seed);
    setFormData(prev => ({ ...prev, fingerprint: fp }));
  };

  const handleGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupFormData),
      });
      if (res.ok) {
        await fetchGroups();
        setIsGroupModalOpen(false);
        setGroupFormData({ name: "", color: "#f97316" });
      }
    } catch (error) {
      console.error("Failed to create group:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveToGroup = async (profileId: number, groupId: number | null) => {
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId }),
      });
      if (res.ok) {
        await fetchProfiles();
      }
    } catch (error) {
      console.error("Failed to move profile to group:", error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingProfileId ? `/api/profiles/${editingProfileId}` : "/api/profiles";
      const method = editingProfileId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchProfiles();
        setIsModalOpen(false);
        setEditingProfileId(null);
        setFormData({
          name: "",
          proxyHost: "",
          proxyPort: "",
          proxyUsername: "",
          proxyPassword: "",
          group_id: null,
          fingerprint: null,
        });
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfileId(profile.id);
    setFormData({
      name: profile.name,
      proxyHost: profile.proxyHost || "",
      proxyPort: profile.proxyPort || "",
      proxyUsername: profile.proxyUsername || "",
      proxyPassword: profile.proxyPassword || "",
      group_id: profile.group_id,
      fingerprint: profile.fingerprint ? JSON.parse(profile.fingerprint) : null,
    });
    setIsModalOpen(true);
  };

  const handleOpenCookieManager = (profile: Profile) => {
    setCookieProfileId(profile.id);
    setCookieJson(profile.cookies ? JSON.stringify(JSON.parse(profile.cookies), null, 2) : "[]");
    setIsCookieModalOpen(true);
  };

  const handleSaveCookies = async () => {
    if (!cookieProfileId) return;
    setIsSubmitting(true);
    try {
      let cookies;
      try {
        cookies = JSON.parse(cookieJson);
        if (!Array.isArray(cookies)) throw new Error("Must be an array");
      } catch (e) {
        alert("Invalid JSON: Cookies must be a JSON array.");
        return;
      }

      const res = await fetch(`/api/profiles/${cookieProfileId}/cookies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies }),
      });
      if (res.ok) {
        await fetchProfiles();
        setIsCookieModalOpen(false);
      }
    } catch (error) {
      console.error("Failed to save cookies:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProfiles(profiles.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  const handleLaunch = async (id: number) => {
    setLaunchingId(id);
    try {
      const res = await fetch(`/api/profiles/${id}/launch`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setProfiles(profiles.map(p => p.id === id ? { ...p, wsEndpoint: data.wsEndpoint } : p));
      } else {
        alert(data.error || "Failed to launch browser");
      }
    } catch (error) {
      console.error("Failed to launch profile:", error);
      alert("Failed to launch browser. Check server logs.");
    } finally {
      setLaunchingId(null);
    }
  };

  const handleStop = async (id: number) => {
    setStoppingId(id);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProfiles(profiles.map(p => p.id === id ? { ...p, wsEndpoint: undefined } : p));
        setActiveSessions(prev => prev.filter(s => s.profileId !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to stop browser");
      }
    } catch (error) {
      console.error("Failed to stop profile:", error);
      alert("Failed to stop browser.");
    } finally {
      setStoppingId(null);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProfileId(null);
    setFormData({
      name: "",
      proxyHost: "",
      proxyPort: "",
      proxyUsername: "",
      proxyPassword: "",
      group_id: null,
      fingerprint: null,
    });
  };

  const handleTestProxy = async (profile: Profile) => {
    if (!profile.proxyHost || !profile.proxyPort) {
      alert("This profile has no proxy configured.");
      return;
    }

    setTestingId(profile.id);
    setProxyTestResults(prev => ({ ...prev, [profile.id]: undefined }));

    try {
      const res = await fetch("/api/proxies/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxyHost: profile.proxyHost,
          proxyPort: profile.proxyPort,
          proxyUsername: profile.proxyUsername,
          proxyPassword: profile.proxyPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setProxyTestResults(prev => ({ ...prev, [profile.id]: { success: true, data } }));
      } else {
        setProxyTestResults(prev => ({ ...prev, [profile.id]: { success: false, error: data.error } }));
      }
    } catch (error) {
      setProxyTestResults(prev => ({ ...prev, [profile.id]: { success: false, error: "Network error" } }));
    } finally {
      setTestingId(null);
    }
  };

  const filteredProfiles = selectedGroupId 
    ? profiles.filter(p => p.group_id === selectedGroupId)
    : profiles;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-md sticky top-0 h-screen flex flex-col shrink-0">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold tracking-tight">Profiles</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="px-4 py-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Main</div>
          <button
            onClick={() => {
              setCurrentView("profiles");
              setSelectedGroupId(null);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium",
              currentView === "profiles" && selectedGroupId === null ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
            )}
          >
            <User className="w-4 h-4" />
            All Profiles
          </button>

          <button
            onClick={() => setCurrentView("sessions")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium",
              currentView === "sessions" ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
            )}
          >
            <Activity className="w-4 h-4" />
            Active Sessions
            {activeSessions.length > 0 && (
              <span className="ml-auto bg-orange-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeSessions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentView("scripts")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium",
              currentView === "scripts" ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
            )}
          >
            <Rocket className="w-4 h-4" />
            Automation
          </button>

          <div className="pt-4 px-4 py-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Groups</div>
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => {
                setCurrentView("profiles");
                setSelectedGroupId(group.id);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-medium",
                currentView === "profiles" && selectedGroupId === group.id ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
              <span className="truncate">{group.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Group
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                {currentView === "sessions" ? "Active Sessions" : (selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : "All Profiles")}
              </h1>
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest">
                {currentView === "sessions" ? `${activeSessions.length} Running` : `${filteredProfiles.length} Profiles`}
              </p>
            </div>
            {currentView === "profiles" && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-semibold hover:bg-orange-500 transition-all active:scale-95 shadow-xl shadow-white/5"
              >
                <Plus className="w-4 h-4" />
                New Profile
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12 w-full">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="text-white/40 font-mono text-sm">Initializing database...</p>
            </div>
          ) : currentView === "sessions" ? (
            <div className="space-y-6">
              {activeSessions.length === 0 ? (
                <div className="text-center py-32 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Activity className="w-10 h-10 text-white/20" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">No active sessions</h2>
                  <p className="text-white/40 mb-8 max-w-md mx-auto">
                    Launch a profile to see it here. Active sessions are tracked in real-time.
                  </p>
                  <button
                    onClick={() => setCurrentView("profiles")}
                    className="text-orange-500 font-semibold hover:underline"
                  >
                    Go to Profiles →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {activeSessions.map((session) => (
                    <motion.div
                      key={session.profileId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex items-center justify-between hover:bg-white/[0.05] transition-all"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                          <Rocket className="w-7 h-7 text-orange-500" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-bold text-lg">{session.profileName}</h3>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-xs text-white/40">
                              <Clock className="w-3.5 h-3.5" />
                              <Uptime startTime={session.startTime} />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-white/40">
                              <Server className="w-3.5 h-3.5" />
                              <span className="font-mono">{session.ip}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">WS Endpoint</p>
                          <p className="text-xs font-mono text-white/40 max-w-[200px] truncate">{session.wsEndpoint}</p>
                        </div>
                        <button
                          onClick={() => handleStop(session.profileId)}
                          disabled={stoppingId === session.profileId}
                          className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-6 py-3 rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {stoppingId === session.profileId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <X className="w-4 h-4" />
                              Stop
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : currentView === "scripts" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {scripts.map(script => (
                <motion.div 
                  key={script}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 hover:bg-white/[0.05] transition-all flex flex-col"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
                      <Rocket className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl">{script}</h3>
                      <p className="text-sm text-white/40 uppercase tracking-widest font-bold">Automation Script</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Target Profile</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                        onChange={(e) => {
                          const profileId = parseInt(e.target.value);
                          (window as any)[`selected_profile_${script}`] = profileId;
                        }}
                      >
                        <option value="">Choose a profile...</option>
                        {profiles.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        const profileId = (window as any)[`selected_profile_${script}`];
                        if (!profileId) return alert("Please select a profile");
                        runScript(script, profileId);
                      }}
                      disabled={runningScript === script}
                      className="w-full flex items-center justify-center gap-3 bg-orange-500 text-black px-6 py-4 rounded-2xl font-bold text-sm hover:bg-orange-400 transition-all disabled:opacity-50 shadow-xl shadow-orange-500/10"
                    >
                      {runningScript === script ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Rocket className="w-5 h-5" />
                          Run Automation
                        </>
                      )}
                    </button>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Console Output</span>
                        <button 
                          onClick={() => {
                            const lastRunId = (window as any)[`last_run_${script}`];
                            if (lastRunId) setScriptLogs(prev => ({ ...prev, [lastRunId]: [] }));
                          }}
                          className="text-[10px] text-white/20 hover:text-white transition-colors uppercase tracking-widest font-bold"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="bg-black/50 border border-white/5 rounded-2xl p-5 h-64 overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                        {(scriptLogs[(window as any)[`last_run_${script}`]] || []).map((log, i) => (
                          <div key={i} className="text-white/60 flex gap-3">
                            <span className="text-white/20 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                            <span className="break-all">{log}</span>
                          </div>
                        ))}
                        {(!scriptLogs[(window as any)[`last_run_${script}`]] || scriptLogs[(window as any)[`last_run_${script}`]].length === 0) && (
                          <div className="text-white/10 italic py-2">Waiting for script execution...</div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-32 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-white/20" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">No profiles found</h2>
              <p className="text-white/40 mb-8 max-w-md mx-auto">
                {selectedGroupId 
                  ? "There are no profiles in this group. Move existing profiles here or create a new one."
                  : "Create your first browser profile to start managing your digital identities with custom proxy settings."}
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-orange-500 font-semibold hover:underline"
              >
                Create your first profile →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredProfiles.map((profile) => (
                  <motion.div
                    key={profile.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group bg-white/[0.03] border border-white/10 rounded-3xl p-6 hover:bg-white/[0.05] hover:border-orange-500/50 transition-all"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/10 transition-colors relative">
                          <User className="w-6 h-6 text-white/40 group-hover:text-orange-500" />
                          {profile.group_id && (
                            <div 
                              className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0a0a0a]"
                              style={{ backgroundColor: groups.find(g => g.id === profile.group_id)?.color }}
                            />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{profile.name}</h3>
                          <p className="text-xs text-white/30 font-mono">ID: {profile.id.toString().padStart(4, '0')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          value={profile.group_id || ""}
                          onChange={(e) => handleMoveToGroup(profile.id, e.target.value ? parseInt(e.target.value) : null)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-white/40 focus:outline-none focus:border-orange-500 transition-all"
                        >
                          <option value="">No Group</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleEdit(profile)}
                          className="p-2 text-white/20 hover:text-orange-500 hover:bg-orange-500/10 rounded-xl transition-all"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleOpenCookieManager(profile)}
                          className="p-2 text-white/20 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                        >
                          <Cookie className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(profile.id)}
                          className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3 text-sm text-white/60 truncate">
                        <Globe className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="font-mono truncate">
                          {profile.proxyHost ? `${profile.proxyHost}:${profile.proxyPort}` : "Direct Connection"}
                        </span>
                      </div>
                      {profile.proxyHost && (
                        <button
                          onClick={() => handleTestProxy(profile)}
                          disabled={testingId === profile.id}
                          className="text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase tracking-widest disabled:opacity-50"
                        >
                          {testingId === profile.id ? "Checking..." : "Test"}
                        </button>
                      )}
                    </div>

                    {proxyTestResults[profile.id] && (
                      <div className={cn(
                        "text-[11px] px-3 py-2 rounded-xl border flex items-center gap-2",
                        proxyTestResults[profile.id].success 
                          ? "bg-green-500/5 border-green-500/20 text-green-500" 
                          : "bg-red-500/5 border-red-500/20 text-red-500"
                      )}>
                        {proxyTestResults[profile.id].success ? (
                          <>
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            <span className="font-mono truncate">
                              {proxyTestResults[profile.id].data.ip} ({proxyTestResults[profile.id].data.country}) • {proxyTestResults[profile.id].data.latency}ms
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                            <span className="truncate">{proxyTestResults[profile.id].error}</span>
                          </>
                        )}
                      </div>
                    )}
                    {profile.proxyUsername && (
                      <div className="flex items-center gap-3 text-xs text-white/40 px-3">
                        <Shield className="w-3 h-3" />
                        <span>Auth: {profile.proxyUsername}</span>
                      </div>
                    )}
                    {profile.fingerprint && (
                      <div className="flex items-center gap-3 text-xs text-orange-500/60 px-3">
                        <FingerprintIcon className="w-3 h-3" />
                        <span>Fingerprint Active</span>
                      </div>
                    )}
                    {profile.wsEndpoint && (
                      <div className="flex flex-col gap-1 px-3 py-2 bg-orange-500/5 rounded-xl border border-orange-500/10">
                        <div className="flex items-center gap-2 text-[10px] text-orange-500 font-bold uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                          Active Session
                        </div>
                        <p className="text-[10px] text-white/40 font-mono truncate">{profile.wsEndpoint}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {profile.wsEndpoint ? (
                      <button
                        onClick={() => handleStop(profile.id)}
                        disabled={stoppingId === profile.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
                      >
                        {stoppingId === profile.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <X className="w-5 h-5" />
                            Stop Session
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLaunch(profile.id)}
                        disabled={launchingId === profile.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-orange-500 text-white hover:text-black py-4 rounded-2xl font-bold transition-all disabled:opacity-50"
                      >
                        {launchingId === profile.id ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Launching...
                          </>
                        ) : (
                          <>
                            <Rocket className="w-5 h-5" />
                            Launch Browser
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">New Profile</h2>
                  <p className="text-sm text-white/40">Configure your browser instance</p>
                </div>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Profile Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Marketing Research"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Proxy Host</label>
                    <input
                      type="text"
                      placeholder="127.0.0.1"
                      value={formData.proxyHost}
                      onChange={(e) => setFormData({ ...formData, proxyHost: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Port</label>
                    <input
                      type="text"
                      placeholder="8080"
                      value={formData.proxyPort}
                      onChange={(e) => setFormData({ ...formData, proxyPort: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Username</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={formData.proxyUsername}
                      onChange={(e) => setFormData({ ...formData, proxyUsername: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Password</label>
                    <input
                      type="password"
                      placeholder="Optional"
                      value={formData.proxyPassword}
                      onChange={(e) => setFormData({ ...formData, proxyPassword: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Group</label>
                  <select
                    value={formData.group_id || ""}
                    onChange={(e) => setFormData({ ...formData, group_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-orange-500 transition-all appearance-none"
                  >
                    <option value="">No Group</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Browser Fingerprint</label>
                    <button
                      type="button"
                      onClick={handleGenerateFingerprint}
                      className="text-xs font-bold text-orange-500 hover:text-orange-400 flex items-center gap-1.5"
                    >
                      <FingerprintIcon className="w-3.5 h-3.5" />
                      Generate New
                    </button>
                  </div>
                  
                  {formData.fingerprint ? (
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <Monitor className="w-4 h-4 text-white/20 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">User Agent</p>
                          <p className="text-[11px] text-white/60 font-mono truncate">{formData.fingerprint.userAgent}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <Cpu className="w-4 h-4 text-white/20 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Platform</p>
                            <p className="text-[11px] text-white/60 font-mono">{formData.fingerprint.platform}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Globe className="w-4 h-4 text-white/20 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Resolution</p>
                            <p className="text-[11px] text-white/60 font-mono">{formData.fingerprint.screenWidth}x{formData.fingerprint.screenHeight}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-6 text-center">
                      <p className="text-xs text-white/20 italic">No fingerprint generated yet</p>
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-orange-500 text-black py-5 rounded-2xl font-bold text-lg hover:bg-orange-400 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        {editingProfileId ? "Saving..." : "Creating..."}
                      </>
                    ) : (
                      editingProfileId ? "Save Changes" : "Create Profile"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cookie Manager Modal */}
      <AnimatePresence>
        {isCookieModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCookieModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Cookie Manager</h2>
                  <p className="text-sm text-white/40">Import or export cookies as JSON array</p>
                </div>
                <button
                  onClick={() => setIsCookieModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Cookies (JSON Array)</label>
                  <textarea
                    className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 font-mono text-xs focus:outline-none focus:border-orange-500 transition-all resize-none"
                    placeholder='[{"name": "session", "value": "...", "domain": "..."}]'
                    value={cookieJson}
                    onChange={(e) => setCookieJson(e.target.value)}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsCookieModalOpen(false)}
                    className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-bold hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCookies}
                    disabled={isSubmitting}
                    className="flex-[2] bg-orange-500 text-black py-4 rounded-2xl font-bold hover:bg-orange-400 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Cookies"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* New Group Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGroupModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">New Group</h2>
                <button
                  onClick={() => setIsGroupModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-white/40" />
                </button>
              </div>

              <form onSubmit={handleGroupSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Group Name</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Social Media"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-orange-500 transition-all"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Color</label>
                  <div className="flex gap-3 flex-wrap">
                    {["#f97316", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#eab308", "#64748b"].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setGroupFormData({ ...groupFormData, color })}
                        className={cn(
                          "w-8 h-8 rounded-full transition-all border-2",
                          groupFormData.color === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="w-full bg-white text-black py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Group"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
