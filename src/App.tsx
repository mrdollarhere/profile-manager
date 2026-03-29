import { useState, useEffect, type FormEvent } from "react";
import { Plus, Trash2, Rocket, Shield, Globe, User, X, Loader2, Fingerprint as FingerprintIcon, Monitor, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { generateFingerprint, type Fingerprint } from "@/src/lib/fingerprint";

interface Profile {
  id: number;
  name: string;
  proxyHost: string | null;
  proxyPort: string | null;
  proxyUsername: string | null;
  proxyPassword: string | null;
  fingerprint: string | null;
  createdAt: string;
  wsEndpoint?: string;
}

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [launchingId, setLaunchingId] = useState<number | null>(null);
  const [stoppingId, setStoppingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    proxyHost: "",
    proxyPort: "",
    proxyUsername: "",
    proxyPassword: "",
    fingerprint: null as Fingerprint | null,
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(data);
    } catch (error) {
      console.error("Failed to fetch profiles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateFingerprint = () => {
    // Use a random seed for new profiles
    const seed = Math.floor(Math.random() * 1000000);
    const fp = generateFingerprint(seed);
    setFormData(prev => ({ ...prev, fingerprint: fp }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchProfiles();
        setIsModalOpen(false);
        setFormData({
          name: "",
          proxyHost: "",
          proxyPort: "",
          proxyUsername: "",
          proxyPassword: "",
          fingerprint: null,
        });
      }
    } catch (error) {
      console.error("Failed to create profile:", error);
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
      const res = await fetch(`/api/profiles/${id}/stop`, { method: "POST" });
      if (res.ok) {
        setProfiles(profiles.map(p => p.id === id ? { ...p, wsEndpoint: undefined } : p));
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Shield className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Profile Manager</h1>
              <p className="text-xs text-white/40 font-mono uppercase tracking-widest">Secure Browser Environment</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full font-semibold hover:bg-orange-500 transition-all active:scale-95 shadow-xl shadow-white/5"
          >
            <Plus className="w-4 h-4" />
            New Profile
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="text-white/40 font-mono text-sm">Initializing database...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-32 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02]">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No profiles found</h2>
            <p className="text-white/40 mb-8 max-w-md mx-auto">
              Create your first browser profile to start managing your digital identities with custom proxy settings.
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
              {profiles.map((profile) => (
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
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                        <User className="w-6 h-6 text-white/40 group-hover:text-orange-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{profile.name}</h3>
                        <p className="text-xs text-white/30 font-mono">ID: {profile.id.toString().padStart(4, '0')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 text-sm text-white/60 bg-black/20 p-3 rounded-2xl border border-white/5">
                      <Globe className="w-4 h-4 text-orange-500" />
                      <span className="font-mono truncate">
                        {profile.proxyHost ? `${profile.proxyHost}:${profile.proxyPort}` : "Direct Connection"}
                      </span>
                    </div>
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
                  onClick={() => setIsModalOpen(false)}
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
                        Creating...
                      </>
                    ) : (
                      "Create Profile"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
