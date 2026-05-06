import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  LayoutDashboard, 
  History, 
  Settings, 
  CreditCard, 
  Users, 
  Share2, 
  Play, 
  Square,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Github,
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ghpmcjozeubrmiuzyfey.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocG1jam96ZXVicm1pdXp5ZmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjYzMjYsImV4cCI6MjA5MzUwMjMyNn0.3UHkakDeyj6bDdDo5DcoiLWLMxCmdPc1KaZ7sZNSV6w';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('tty_token');
  // Map API paths to Netlify function names
  const pathMap: Record<string, string> = {
    '/api/stats': '/.netlify/functions/stats',
    '/api/sessions': '/.netlify/functions/sessions',
    '/api/subscription': '/.netlify/functions/subscription',
    '/api/billing/create-checkout': '/.netlify/functions/billing-checkout',
    '/api/billing/portal': '/.netlify/functions/billing-portal',
    '/api/stream/push': '/.netlify/functions/stream-push',
    '/api/stream/rewind': '/.netlify/functions/stream-rewind',
  };
  const url = pathMap[path] || path;
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '', ...opts.headers },
  });
}
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// --- Types ---
type Tab = 'home' | 'sessions' | 'settings' | 'billing' | 'viewers';

interface Session {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  viewers: number;
  status: 'active' | 'completed';
}

interface Stats {
  totalSessions: number;
  totalMinutes: number;
  totalViewers: number;
}

// --- Components ---

const SessionRow = ({ session }: { session: Session }) => {
  const [expanded, setExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeWithAI = async () => {
    setIsAnalyzing(true);
    try {
      const prompt = `Analyze this terminal session: ${session.name}. It lasted ${
          session.endTime 
            ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
            : 'ongoing'
        } minutes and had ${session.viewers} peak viewers. Provide a 2-sentence technical summary.`;
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.choices?.[0]?.message?.content ?? 'Could not analyze session.');
    } catch (err) {
      console.error(err);
      setAiAnalysis("Failed to analyze session.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="group">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_100px] p-4 text-sm items-center hover:bg-white/3 cursor-pointer transition-colors"
      >
        <span className="text-ash-gray text-xs">{format(new Date(session.startTime), 'MMM d, yyyy')}</span>
        <span className="font-medium text-canvas-white">{session.name}</span>
        <span className="text-ash-gray text-xs">
          {session.endTime 
            ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000) + ' min'
            : 'Ongoing'}
        </span>
        <span className="text-ash-gray text-xs">{session.viewers}</span>
        <span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            session.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-ash-gray'
          }`}>
            {session.status.toUpperCase()}
          </span>
        </span>
        <div className="flex items-center justify-end gap-2 text-right">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const url = `${window.location.origin}/view/${session.id}`;
              navigator.clipboard.writeText(url);
            }} 
            title="Copy Link" 
            className="p-1.5 hover:text-canvas-white text-ash-gray transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button title="Delete" className="p-1.5 hover:text-red-400 text-ash-gray transition-colors">
            <AlertCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white/[0.02] border-t border-white/5"
          >
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-ash-gray">Viewer Timeline</h4>
                  <div className="h-32 border border-white/5 rounded-xl p-4 bg-void-black/50">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { time: '0m', viewers: 0 },
                          { time: '5m', viewers: Math.floor(session.viewers * 0.5) },
                          { time: '10m', viewers: session.viewers },
                          { time: '15m', viewers: Math.floor(session.viewers * 0.8) },
                        ]}>
                          <Line type="monotone" dataKey="viewers" stroke="#ffffff" strokeWidth={2} dot={false} />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-ash-gray">AI Insights</h4>
                    {!aiAnalysis && !isAnalyzing && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); analyzeWithAI(); }}
                        className="text-[10px] font-bold text-canvas-white hover:underline"
                      >
                        ANALYZE
                      </button>
                    )}
                  </div>
                  <div className="p-4 border border-white/5 rounded-xl bg-void-black/50 min-h-[100px] flex flex-col justify-center">
                    {isAnalyzing ? (
                      <div className="flex items-center gap-2 text-xs text-ash-gray">
                        <div className="w-2 h-2 bg-canvas-white rounded-full animate-bounce" />
                        Analyzing with Gemini...
                      </div>
                    ) : aiAnalysis ? (
                      <p className="text-xs text-ash-gray leading-relaxed italic">"{aiAnalysis}"</p>
                    ) : (
                      <p className="text-[10px] text-ash-gray/30 text-center uppercase tracking-widest">No evaluation performed</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ViewerPage = ({ sessionId, onBack }: { sessionId: string, onBack: () => void }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#ffffff',
        selectionBackground: 'rgba(255, 255, 255, 0.3)',
      },
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln('\x1b[36mConnecting to session: ' + sessionId + '...\x1b[0m');

    const handleData = (data: string) => {
      term.write(data);
    };

    const handleViewerCount = (count: number) => {
      setViewerCount(count);
    };

    // Subscribe to Supabase Realtime channel for this session
    const channel = supabaseClient.channel(`session:${sessionId}`)
      .on('broadcast', { event: 'terminal_data' }, ({ payload }) => handleData(payload.data))
      .on('broadcast', { event: 'viewer_count' }, ({ payload }) => handleViewerCount(payload.count))
      .subscribe();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      supabaseClient.channel(`session:${sessionId}`).unsubscribe();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [sessionId, socket]);

  return (
    <div className="fixed inset-0 bg-void-black z-50 flex flex-col">
      <header className="p-4 border-b border-white/5 flex items-center justify-between bg-void-black/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-ash-gray hover:text-canvas-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-bold tracking-tight">tty.live/{sessionId}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-ash-gray font-medium bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
             <Users className="w-3.5 h-3.5" />
             {viewerCount} Viewers
          </div>
          <button className="btn-primary py-1.5 px-4 text-xs">Share Terminal</button>
        </div>
      </header>
      <div className="flex-1 p-6 flex flex-col min-h-0 bg-radial-[at_50%_-20%] from-coal to-void-black">
        <div className="flex-1 bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden shadow-2xl relative p-4 group">
          <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
             <button className="p-2 bg-white/10 rounded-lg backdrop-blur-sm hover:bg-white/20 transition-colors text-canvas-white">
                <Copy className="w-4 h-4" />
             </button>
          </div>
          <div ref={terminalRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ activeTab, onTabChange }: { activeTab: Tab, onTabChange: (tab: Tab) => void }) => {
  const menuItems = [
    { id: 'home', icon: LayoutDashboard, label: 'Home' },
    { id: 'sessions', icon: History, label: 'Sessions' },
    { id: 'viewers', icon: Users, label: 'Viewers', pro: true },
    { id: 'billing', icon: CreditCard, label: 'Billing' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-64 border-r border-white/5 flex flex-col h-screen fixed left-0 top-0 bg-void-black z-20">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-canvas-white rounded-lg flex items-center justify-center">
          <Terminal className="text-void-black w-5 h-5" />
        </div>
        <span className="font-bold text-xl tracking-tight text-canvas-white">tty.live</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as Tab)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
              activeTab === item.id 
                ? 'bg-white/10 text-canvas-white' 
                : 'text-ash-gray hover:text-canvas-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            {item.pro && (
              <span className="text-[10px] bg-iron text-ash-gray px-1.5 py-0.5 rounded border border-white/5">PRO</span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="bg-iron/30 p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-void-black border border-white/10 flex items-center justify-center overflow-hidden text-ash-gray">
              <Github className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-canvas-white">Chidera Ezeudu</p>
              <p className="text-[10px] text-ash-gray truncate">Basic Plan</p>
            </div>
          </div>
          <button className="w-full py-1.5 text-[10px] font-semibold bg-canvas-white text-void-black rounded-lg hover:opacity-90 transition-opacity">
            UPGRADE
          </button>
        </div>
      </div>
    </aside>
  );
};

const StatCard = ({ label, value, trend, icon: Icon }: any) => (
  <div className="stat-card">
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-white/5 rounded-lg">
        <Icon className="w-4 h-4 text-ash-gray" />
      </div>
      {trend && (
        <span className={`text-[10px] font-medium ${trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
          {trend}
        </span>
      )}
    </div>
    <p className="text-ash-gray text-xs mb-1 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-semibold tracking-tight text-canvas-white">{value}</p>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const realtimeRef = useRef<any>(null);
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, totalMinutes: 0, totalViewers: 0 });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [sub, setSub] = useState<any>({ plan: 'trial', status: 'active' });

  // Check URL for viewer mode
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const match = path.match(/\/view\/([a-z0-9]+)/);
      if (match) {
        setViewingSessionId(match[1]);
      } else {
        setViewingSessionId(null);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    // Auth from URL params (after GitHub OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlUsername = urlParams.get('username');
    const urlAvatar = urlParams.get('avatar');
    if (urlToken) {
      localStorage.setItem('tty_token', urlToken);
      if (urlUsername) localStorage.setItem('tty_username', urlUsername);
      if (urlAvatar) localStorage.setItem('tty_avatar', decodeURIComponent(urlAvatar));
      window.history.replaceState({}, '', '/');
    }

    // Load data via REST API
    apiFetch('/api/stats').then(r => r.json()).then(setStats).catch(console.error);
    apiFetch('/api/sessions').then(r => r.json()).then(setSessions).catch(console.error);
    apiFetch('/api/subscription').then(r => r.json()).then(setSub).catch(console.error);

    return () => {
      if (realtimeRef.current) realtimeRef.current.unsubscribe();
    };
  }, []);


  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startSession = () => {
    apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify({ name: `Session ${new Date().toLocaleTimeString()}` }) })
      .then(r => r.json())
      .then(session => {
        setActiveSession(session);
        setSessionLink(session.viewerUrl);
        // Poll viewer count via Supabase Realtime
        const ch = supabaseClient.channel(`session:${session.id}`)
          .on('broadcast', { event: 'viewer_count' }, ({ payload }) => setViewerCount(payload.count))
          .subscribe();
        realtimeRef.current = ch;
      });
  };

  const stopSession = () => {
    if (activeSession) {
      apiFetch(`/.netlify/functions/session-update?id=${activeSession.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
      if (realtimeRef.current) { realtimeRef.current.unsubscribe(); realtimeRef.current = null; }
    }
  };

  const copyLink = () => {
    if (activeSession) {
      const url = `${window.location.origin}/view/${activeSession.id}`;
      navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  if (viewingSessionId) {
    return <ViewerPage sessionId={viewingSessionId} onBack={() => {
      window.history.pushState({}, '', '/');
      setViewingSessionId(null);
    }} />;
  }

  return (
    <div className="flex bg-void-black min-h-screen text-canvas-white selection:bg-canvas-white selection:text-void-black">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 ml-64 p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {/* Trial Banner */}
              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <p className="text-sm text-amber-200">
                    Your trial ends in <span className="font-bold">4 days</span>. Upgrade to Pro to keep your session history.
                  </p>
                </div>
                <button className="text-xs font-semibold bg-amber-500 text-void-black px-3 py-1.5 rounded-lg hover:bg-amber-400 transition-colors">
                  Upgrade Now
                </button>
              </div>

              {/* Hero / Start Area */}
              <section className="card-terminal p-8 flex flex-col items-center text-center space-y-6">
                <div className="space-y-2">
                  <h1 className="text-4xl font-bold tracking-tight">Stream your terminal live</h1>
                  <p className="text-ash-gray max-w-lg">
                    Instant collaboration for developers. No screen sharing, no latency, just code.
                  </p>
                </div>

                {!activeSession ? (
                  <button 
                    onClick={startSession}
                    className="btn-primary group flex items-center gap-3"
                  >
                    <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                    Start New Session
                  </button>
                ) : (
                  <div className="w-full space-y-6">
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Active Session</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
                        <Users className="w-3.5 h-3.5 text-ash-gray" />
                        <span className="text-[10px] font-bold tracking-widest">{activeSession.viewers} VIEWERS</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 max-w-md mx-auto">
                      <div className="flex-1 bg-void-black border border-white/10 px-4 py-2 rounded-lg text-sm font-mono truncate text-ash-gray">
                        {`${window.location.host}/view/${activeSession.id}`}
                      </div>
                      <button 
                        onClick={copyLink}
                        className="p-2.5 bg-canvas-white text-void-black rounded-lg hover:opacity-90 transition-opacity"
                      >
                        {copySuccess ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={stopSession}
                        className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <Square className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6">
                <StatCard label="Total Sessions" value={stats.totalSessions} icon={Terminal} />
                <StatCard label="Minutes Streamed" value={stats.totalMinutes} trend="+12% this week" icon={History} />
                <StatCard label="Total Viewers" value={stats.totalViewers} trend="+40% this month" icon={Users} />
              </div>

              {/* Recent Sessions */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Recent Sessions</h2>
                  <button onClick={() => setActiveTab('sessions')} className="text-xs text-ash-gray hover:text-canvas-white transition-colors flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="bg-void-black border border-white/5 p-4 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${session.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-ash-gray'}`}>
                          <Terminal className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{session.name}</p>
                          <p className="text-[10px] text-ash-gray">
                            {format(new Date(session.startTime), 'MMM d, h:mm a')} • {session.viewers} viewers
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.status === 'active' ? (
                          <div className="px-2 py-1 bg-green-500/10 text-green-500 text-[10px] font-bold rounded border border-green-500/20">LIVE</div>
                        ) : (
                          <button className="p-2 text-ash-gray hover:text-canvas-white transition-colors">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className="p-2 text-ash-gray hover:text-canvas-white transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="py-12 flex flex-col items-center text-center space-y-2 opacity-50">
                      <Terminal className="w-8 h-8 mb-2" />
                      <p className="text-sm">No sessions yet.</p>
                      <p className="text-[10px]">Run your first session to see history here.</p>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'sessions' && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-5xl mx-auto space-y-6"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Sessions</h1>
                <button 
                  onClick={() => setActiveTab('home')}
                  className="btn-primary py-2 text-xs flex items-center gap-2"
                >
                  <Play className="w-3 h-3 fill-current" />
                  New Session
                </button>
              </div>

              <div className="flex items-center gap-4 bg-void-black border border-white/5 p-2 rounded-xl">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ash-gray" />
                  <input 
                    type="text" 
                    placeholder="Search sessions..." 
                    className="w-full bg-transparent border-none focus:ring-0 text-sm pl-10 pr-4 py-2"
                  />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 text-xs text-ash-gray hover:text-canvas-white bg-white/5 rounded-lg border border-white/5">
                  <Filter className="w-3 h-3" />
                  Filter
                </button>
              </div>

              <div className="bg-void-black border border-white/5 rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_100px] border-b border-white/5 bg-white/3 p-4 text-[10px] uppercase tracking-wider text-ash-gray font-semibold">
                  <span>Date</span>
                  <span>Session Name</span>
                  <span>Duration</span>
                  <span>Viewers</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="divide-y divide-white/5">
                  {sessions.map((session) => (
                    <SessionRow key={session.id} session={session} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="max-w-2xl mx-auto space-y-12 pb-20"
            >
              <section className="space-y-6">
                <h1 className="text-2xl font-bold">Profile</h1>
                <div className="p-6 bg-void-black border border-white/5 rounded-2xl space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-canvas-white flex items-center justify-center overflow-hidden">
                      <Github className="w-10 h-10 text-void-black" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-canvas-white">Avatar from GitHub</p>
                      <p className="text-xs text-ash-gray">Connected via @chidera-ezeudu</p>
                      <button className="text-xs text-red-400 hover:underline mt-2">Disconnect</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-ash-gray font-bold">Display Name</label>
                      <input 
                        type="text" 
                        defaultValue="Chidera Ezeudu"
                        className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2 text-sm text-canvas-white focus:border-canvas-white transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-ash-gray font-bold">Email Address</label>
                      <input 
                        type="email" 
                        defaultValue="chideraezeudu2@gmail.com"
                        className="w-full bg-void-black border border-white/10 rounded-lg px-4 py-2 text-sm text-canvas-white focus:border-canvas-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Privacy Shield</h2>
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-canvas-white text-void-black font-bold uppercase tracking-widest">Advanced</span>
                </div>
                <div className="p-6 bg-void-black border border-white/5 rounded-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-canvas-white">Pattern Filtering</p>
                      <p className="text-xs text-ash-gray">Automatically mask sensitive patterns in terminal output.</p>
                    </div>
                    <div className="w-10 h-5 bg-canvas-white rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-void-black rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {['AWS_ACCESS_KEY', 'DATABASE_URL', '.env variables'].map(p => (
                      <div key={p} className="flex items-center justify-between p-3 border border-white/5 rounded-xl bg-white/2">
                        <span className="text-xs font-mono text-ash-gray">{p}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Active</span>
                          <button className="text-ash-gray hover:text-white transition-colors"><AlertCircle className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-3 border border-dashed border-white/20 rounded-xl text-xs text-ash-gray hover:border-white/40 hover:text-canvas-white transition-all">
                    + Add Custom Pattern
                  </button>
                </div>
              </section>

              <section className="space-y-6">
                <h2 className="text-xl font-bold text-red-500">Danger Zone</h2>
                <div className="p-6 border border-red-500/20 rounded-2xl bg-red-500/5 space-y-4">
                  <div className="flex items-center justify-between text-canvas-white">
                    <div>
                      <p className="text-sm font-semibold">Export Data</p>
                      <p className="text-xs text-ash-gray">Download all your session logs and viewer history.</p>
                    </div>
                    <button className="px-4 py-2 text-xs font-bold bg-white/10 rounded-lg hover:bg-white/20 transition-colors">Export JSON</button>
                  </div>
                  <div className="h-px bg-red-500/20" />
                  <div className="flex items-center justify-between text-canvas-white">
                    <div>
                      <p className="text-sm font-semibold">Delete Account</p>
                      <p className="text-xs text-ash-gray">Permanently delete your account and all associated data.</p>
                    </div>
                    <button className="px-4 py-2 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete System</button>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              key="billing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <h1 className="text-2xl font-bold">Plan & Billing</h1>
              
              <div className="grid grid-cols-2 gap-8">
                <div className="p-8 bg-void-black border border-white/5 rounded-3xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-ash-gray">CURRENT</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-ash-gray text-[10px] uppercase tracking-widest font-bold">Your Plan</p>
                    <h3 className="text-3xl font-bold text-canvas-white">Basic</h3>
                  </div>
                  <p className="text-ash-gray text-sm">Perfect for individuals and side projects.</p>
                  <ul className="space-y-3">
                    {[
                      'Unlimited public sessions',
                      '1 concurrent viewer',
                      '7-day session history',
                      'Basic privacy shield'
                    ].map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-ash-gray">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm font-bold text-canvas-white">$0 <span className="text-ash-gray font-normal">/ month</span></p>
                </div>

                <div className="p-8 bg-canvas-white text-void-black rounded-3xl space-y-6 relative group transform transition-all hover:scale-[1.02]">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="px-2 py-1 bg-void-black/10 rounded text-[10px] font-bold">RECOMMENDED</div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-void-black/60 text-[10px] uppercase tracking-widest font-bold">The Standard</p>
                    <h3 className="text-3xl font-bold">Pro</h3>
                  </div>
                  <p className="text-void-black/80 text-sm">Everything you need for professional pairing.</p>
                  <ul className="space-y-3">
                    {[
                      'Private session links',
                      'Up to 50 concurrent viewers',
                      'Lifetime session replay',
                      'Advanced privacy shield',
                      'Viewer analytics dashboard'
                    ].map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs px-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-4">
                    <p className="text-2xl font-bold">$12 <span className="text-void-black/60 font-normal text-sm">/ month</span></p>
                    <button className="w-full py-3 bg-void-black text-canvas-white font-bold rounded-xl hover:opacity-90 transition-opacity">
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              </div>

              <section className="space-y-4">
                <h3 className="text-xl font-bold">Invoice History</h3>
                <div className="border border-white/5 rounded-2xl overflow-hidden bg-void-black">
                   <div className="p-12 text-center text-ash-gray space-y-2">
                     <History className="w-8 h-8 opacity-20 mx-auto" />
                     <p className="text-sm">No invoices found yet.</p>
                     <p className="text-[10px]">They'll appear here after your first billing cycle.</p>
                   </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'viewers' && (
            <motion.div
              key="viewers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-5xl mx-auto flex flex-col items-center justify-center py-32 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-iron rounded-3xl flex items-center justify-center relative">
                <Users className="w-8 h-8 text-ash-gray" />
                <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-canvas-white text-void-black text-[8px] font-bold rounded border border-void-black uppercase tracking-widest">PRO</div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Detailed Viewer Analytics</h1>
                <p className="text-ash-gray max-w-md mx-auto text-sm">
                  Understand who's watching your sessions. Track IP trends, session duration per viewer, and returning audience metrics.
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('billing')}
                  className="btn-primary"
                >
                  Unlock with Pro
                </button>
                <button className="btn-secondary">Learn more</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
