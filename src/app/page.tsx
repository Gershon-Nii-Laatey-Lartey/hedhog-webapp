"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "mining" | "tasks" | "frens" | "wallet" | "upgrades";

interface CoinParticle {
  id: number;
  x: number;
  y: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("mining");
  const [coins, setCoins] = useState(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimProgress, setClaimProgress] = useState(65); // Just for demo
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Collector");
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  const [mounted, setMounted] = useState(false);

  // Sync coins periodically or on specific actions
  const syncCoins = async (newAmount: number) => {
    if (!userId) return;
    try {
      await supabase
        .from('users')
        .update({ coins: newAmount, last_active: new Date().toISOString() })
        .eq('id', userId);
    } catch (e) {
      console.error("Sync error:", e);
    }
  };

  const handleTap = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Spawn particle
    const id = Date.now();
    setParticles((prev: CoinParticle[]) => [...prev, { id, x, y }]);
    
    setCoins((prev: number) => {
      const next = prev + 1;
      // Throttled sync or sync every 10 clicks could be better, but simple for now
      if (next % 10 === 0) syncCoins(next);
      return next;
    });

    // Haptic Feedback (TMA Support)
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
      (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50); // Fallback for standard browsers
    }

    // Remove particle after animation
    setTimeout(() => {
      setParticles((prev: CoinParticle[]) => prev.filter(p => p.id !== id));
    }, 1000);
  };

  useEffect(() => {
    const initApp = async () => {
      // 1. Get User Data from Telegram
      let tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
      
      // Fallback for development
      if (!tgUser) {
        const params = new URLSearchParams(window.location.search);
        const devId = params.get("user_id") || "dev_user_123";
        tgUser = { id: devId, first_name: "Dev", username: "dev" };
      }

      const uid = String(tgUser.id);
      setUserId(uid);
      setUserName(tgUser.first_name || "Collector");

      // 2. Upsert User in Supabase
      try {
        const { data, error } = await supabase
          .from('users')
          .upsert({ 
            id: uid, 
            username: tgUser.username, 
            first_name: tgUser.first_name,
            last_active: new Date().toISOString()
          }, { onConflict: 'id' })
          .select()
          .single();

        if (data) {
          setCoins(data.coins || 0);
        }
      } catch (err) {
        console.error("Auth/Fetch error:", err);
      } finally {
        setMounted(true);
      }
    };

    initApp();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  const renderSkeleton = () => (
    <div className="tma-container bg-zinc-950 p-6 space-y-8 animate-pulse">
      <div className="flex justify-between items-center pt-4">
        <div className="flex gap-3 items-center">
          <div className="w-10 h-10 rounded-full bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-2 w-16 bg-zinc-800 rounded" />
            <div className="h-3 w-24 bg-zinc-800 rounded" />
          </div>
        </div>
        <div className="h-8 w-24 bg-zinc-800 rounded-full" />
      </div>
      <div className="h-64 w-full bg-zinc-900/50 rounded-3xl" />
      <div className="flex justify-center flex-col items-center space-y-4">
        <div className="h-10 w-48 bg-zinc-800 rounded-2xl" />
        <div className="h-4 w-32 bg-zinc-900 rounded" />
      </div>
    </div>
  );

  const renderMining = () => (
    <div className="page-container-compact animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Info */}
      <div className="flex justify-between items-center pt-6 px-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 glass-card !p-0 flex items-center justify-center !rounded-xl border-white/10 hover:bg-white/5 transition-colors cursor-pointer active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <div className="w-8 h-8 glass-card !p-0 flex items-center justify-center !rounded-xl border-white/10 hover:bg-white/5 transition-colors cursor-pointer active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-[#A3FF12] tracking-tighter -mb-1 opacity-70">Collector</span>
            <span className="text-xl font-black uppercase text-white drop-shadow-sm tracking-tight leading-none">{userName}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 mb-1.5 px-3 py-1 bg-[#A3FF12]/10 rounded-full border border-[#A3FF12]/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span className="text-xs font-black text-[#A3FF12] leading-none uppercase tracking-tighter cursor-default">+12.5K/h</span>
          </div>
          <div className="bg-[#111111]/80 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/5 shadow-xl flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <span className="text-[10px]">🪙</span>
            </div>
            <span className="text-xl font-black tracking-tight text-white leading-none">{coins.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Hero Character Section */}
      <div className="relative flex flex-col items-center">
        {/* Decorative Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 border border-white/5 rounded-full -z-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-white/5 rounded-full -z-20 opacity-50"></div>
        
        {/* Character Image */}
        <div 
          className="w-80 h-80 relative mb-4 cursor-pointer active:scale-105 transition-transform duration-75 touch-none"
          onPointerDown={handleTap}
          onClick={handleTap as any} /* Fallback */
        >
          {/* Floating Particles */}
          {particles.map(p => (
            <div 
              key={p.id}
              className="absolute pointer-events-none animate-float-up-to-balance z-50 flex items-center gap-1.5"
              style={{ left: p.x, top: p.y }}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 rounded-full border border-yellow-200/50 shadow-[0_0_20px_#FFD700] flex items-center justify-center">
                <span className="text-[12px]">🪙</span>
              </div>
              <span className="text-xl font-black text-[#A3FF12] drop-shadow-lg shadow-black">+1</span>
            </div>
          ))}
          <img 
            src="/character.png?v=2" 
            alt="Character" 
            className="w-full h-full object-contain pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 w-full px-4 justify-center">
          <button 
            onPointerDown={(e) => { e.stopPropagation(); setActiveTab("upgrades"); }}
            className="flex-1 glass-card flex flex-col items-center justify-center gap-1.5 py-3 !rounded-2xl border-white/10 hover:bg-white/5 transition-colors active:scale-95 touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            <span className="text-[10px] font-black uppercase text-zinc-300">Upgrade</span>
          </button>
          <button 
            onPointerDown={(e) => { e.stopPropagation(); }}
            className="flex-1 glass-card flex flex-col items-center justify-center gap-1.5 py-3 !rounded-2xl border-white/10 hover:bg-white/5 transition-colors active:scale-95 touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55.47.98.97 1.21C11.47 18.44 12 19 12 19s.53-.56 1.03-.79c.5-.23.97-.66.97-1.21v-2.34c0-.52.27-1 .73-1.26a3.57 3.57 0 0 0 1.27-5.4M8 6h8"/></svg>
            <span className="text-[10px] font-black uppercase text-zinc-300">Leaders</span>
          </button>
          <button 
            onPointerDown={(e) => { e.stopPropagation(); }}
            className="flex-1 glass-card flex flex-col items-center justify-center gap-1.5 py-3 !rounded-2xl border-white/10 hover:bg-white/5 transition-colors active:scale-95 touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/><path d="M3 11a8 8 0 0 1 18 0"/></svg>
            <span className="text-[10px] font-black uppercase text-zinc-300">Combo Game</span>
          </button>
        </div>
      </div>

      {/* Main Claim Progress */}
      <div className="px-4 space-y-3">
        <div className="flex justify-between items-end px-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1 bg-[#A3FF12]/5 px-2 py-0.5 rounded-full border border-[#A3FF12]/10 w-fit">
               <div className="w-1.5 h-1.5 bg-[#A3FF12] rounded-full animate-pulse shadow-[0_0_5px_#A3FF12]"></div>
               <span className="text-[10px] font-black text-[#A3FF12] uppercase tracking-wider">+0.15 $LOON / SEC</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-500 font-bold italic">Progress</span>
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">6.791 / 10,000</span>
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar-fill w-[65%]"></div>
        </div>

        <button className="btn-primary w-full py-3.5 text-base tracking-wide glow-green hover:brightness-110 active:scale-95 transition-all">
          Claim 6,795 $LOON
        </button>
      </div>

      {/* Stats Cards Section - Ensuring there's content to scroll/feel balanced */}
      <div className="px-4 grid grid-cols-2 gap-3 pb-32">
         <div className="glass-card !p-4 !rounded-3xl border-white/5 bg-zinc-950/30">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Mined</p>
            <p className="text-sm font-black text-white">482,150.25</p>
         </div>
         <div className="glass-card !p-4 !rounded-3xl border-white/5 bg-zinc-950/30">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Referrals</p>
            <p className="text-sm font-black text-white">1,248</p>
         </div>
      </div>
      <div className="h-40 shrink-0" />
    </div>
  );

  const renderUpgrades = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pt-6 px-4">
        <h2 className="text-2xl font-black mb-1">Upgrades</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Invest In New Equipment To Increase Passive Income</p>
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 mb-4 pl-1">
           <div className="w-1 h-3 bg-[#A3FF12] rounded-full"></div>
           <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Active Mining Equipment</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 100 }).map((_, i) => {
            const level = Math.floor(i / 10) + 1;
            const price = (i + 1) * 1500;
            const boost = (i + 1) * 0.25;
            const icons = ["📶", "💾", "💻", "⛓️‍💥", "🔌", "🖥️", "📡", "⚡", "🐧", "🚀"];
            const names = ["Router", "Memory", "Laptop", "GPU", "Power", "Server", "Satelite", "Voltage", "Linux Box", "Rocket"];
            
            return (
              <div key={i} className="glass-card flex flex-col items-center text-center !p-4 !rounded-3xl border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20 text-[8px] font-black uppercase">Lv. {level}</div>
                <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
                  <span className="text-4xl">{icons[i % icons.length]}</span>
                </div>
                <p className="font-black text-[10px] text-white uppercase mb-1">{names[i % names.length]} M-{i+1}</p>
                <p className="text-[9px] text-[#A3FF12] font-bold mb-4">+{boost.toFixed(2)} / Sec</p>
                <button className={`w-full py-2 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-wider transition-colors ${i % 3 === 0 ? 'bg-[#A3FF12] text-black' : 'bg-[#1A1A1A] text-zinc-400'}`}>
                  Upgrade • {price >= 1000 ? (price/1000).toFixed(1) + 'K' : price}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pt-6 px-4">
        <h2 className="text-2xl font-black mb-1">Daily Rewards</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Earn Coins Daily For Log In. Keep Your Streak To Earn More!</p>
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-3 gap-3 px-4">
        {[100, 200, 500, 1000, 1500, 3000, 7000, 10050, 50000].map((amount, i) => (
          <div key={i} className={`glass-card !p-3 flex flex-col items-center text-center !rounded-2xl border-white/5 relative overflow-hidden ${i === 2 ? 'border-[#A3FF12]/30 bg-[#A3FF12]/5' : ''}`}>
             <span className="text-[9px] font-black text-zinc-500 uppercase mb-2">Day {i + 1}</span>
             <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mb-2 shadow-inner">
               <span className="text-xs">🪙</span>
             </div>
             <span className="text-xs font-black text-white">{amount.toLocaleString()}</span>
             <span className="text-[8px] font-bold text-zinc-600 uppercase mt-1">LOON</span>
             {i === 2 && (
               <div className="absolute inset-x-0 bottom-0 bg-[#A3FF12] py-1 text-[8px] font-black text-black uppercase tracking-tighter">Claim</div>
             )}
          </div>
        ))}
      </div>

      {/* Monetized & Growth Tasks */}
      <div className="px-4 space-y-3 pb-8">
        <div className="flex items-center gap-2 mb-2">
           <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
           <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Growth & Rewards</h3>
        </div>
        
        {Array.from({ length: 20 }).map((_, i) => {
          const types = [
            { icon: "📺", name: "Watch Viral Ad #" + (i + 1), reward: "+5,000", color: "bg-yellow-500/10", border: "border-yellow-500/20", btn: "Watch", highlight: true },
            { icon: "✈️", name: "Join Private Group #" + (i + 1), reward: "+1,200", color: "bg-blue-500/10", border: "border-blue-500/20", btn: "Join", highlight: false },
            { icon: "𝕏", name: "Follow Alpha Post #" + (i + 1), reward: "+2,000", color: "bg-white/10", border: "border-white/10", btn: "Follow", highlight: false },
            { icon: "🎮", name: "Try New Game #" + (i + 1), reward: "+8,500", color: "bg-purple-500/10", border: "border-purple-500/20", btn: "Play", highlight: false }
          ];
          const task = types[i % types.length];

          return (
            <div key={i} className="glass-card flex justify-between items-center bg-zinc-900/40 !rounded-2xl border-white/5 py-4 transition-all active:brightness-125">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${task.color} rounded-xl flex items-center justify-center border ${task.border}`}>
                  <span className="text-xl">{task.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-black text-white">{task.name}</p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">{task.reward} LOON</p>
                </div>
              </div>
              <button 
                onPointerDown={(e) => { e.stopPropagation(); }}
                className={`${task.highlight ? 'bg-[#A3FF12] text-black glow-green' : 'bg-white text-black'} text-[9px] font-black uppercase px-4 py-2 rounded-lg active:scale-95 transition-transform`}
              >
                {task.btn}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderFrens = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pt-6 px-4 text-center">
        <div className="w-24 h-24 bg-[#A3FF12]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#A3FF12]/20 glow-green">
           <span className="text-5xl">🎁</span>
        </div>
        <h2 className="text-2xl font-black mb-2">Invite Frens</h2>
        <p className="text-xs text-zinc-500 font-medium px-8 leading-relaxed">Refer your friends and earn 10% of their earnings forever!</p>
      </div>

      <div className="px-4">
        <div className="glass-card flex flex-col gap-4 !rounded-3xl border-white/10 bg-zinc-950/50">
           <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                 <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Total My Frens</p>
                 <p className="text-2xl font-black text-white">12,482</p>
              </div>
              <div className="text-right">
                 <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Received Coins</p>
                 <p className="text-xl font-black text-[#A3FF12]">15,483,158</p>
              </div>
           </div>
           <button className="btn-primary w-full py-4 text-sm glow-green">Invite Frens</button>
        </div>
      </div>

      <div className="px-4">
         <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-4">Top 3 Frens</h3>
         <div className="space-y-2">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="glass-card flex justify-between items-center py-3 border-white/5 rounded-2xl">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-full border border-white/10 overflow-hidden">
                       <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center font-black text-[10px]">U{i}</div>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-white tracking-tight">Cooper_Hedge_{i}</p>
                       <p className="text-[8px] font-bold text-zinc-500 uppercase">Level {10 - i}</p>
                    </div>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-white">1,500K</span>
                    <span className="text-[8px] font-bold text-[#A3FF12] uppercase tracking-tighter cursor-pointer underline">Claim 150K</span>
                 </div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pt-6 px-4">
        <h2 className="text-2xl font-black mb-1">Wallet</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Check balances and withdraw rewards</p>
      </div>

      <div className="px-4 space-y-3">
         <div className="glass-card !rounded-3xl border-white/10 bg-zinc-950/50 p-6">
            <div className="flex flex-col items-center mb-6">
               <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">$LOON BALANCE</p>
               <h3 className="text-4xl font-black text-white">153,490,751</h3>
               <p className="text-[10px] font-black text-[#A3FF12] mt-1 select-none">≈ $1,248.50 USD</p>
            </div>
            <div className="flex gap-2">
               <button 
                 onPointerDown={(e) => { e.stopPropagation(); }}
                 className="flex-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase py-3 rounded-xl cursor-not-allowed"
               >
                 Withdrawal
               </button>
               <button 
                 onPointerDown={(e) => { e.stopPropagation(); }}
                 className="flex-1 bg-[#A3FF12] text-black text-[10px] font-black uppercase py-3 rounded-xl glow-green"
               >
                 History
               </button>
            </div>
         </div>

         {/* TON Connection - Standardized */}
         <div className="glass-card flex justify-between items-center bg-zinc-900/40 !rounded-3xl border-white/5 py-4">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                 <span className="text-xl">🐬</span>
               </div>
               <div>
                 <h4 className="text-sm font-black text-white uppercase select-none">Telegram Wallet</h4>
                 <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Official Airdrop Network</p>
               </div>
            </div>
            <button 
             onPointerDown={(e) => { e.stopPropagation(); }}
             className="bg-blue-500 text-white text-[9px] font-black uppercase px-4 py-2.5 rounded-xl glow-blue active:scale-95 transition-transform"
            >
              Connect
            </button>
         </div>

         {/* Other Exchanges - Matching Size */}
         {[
           { name: "Binance", icon: "🟡", color: "bg-yellow-400/10", border: "border-yellow-400/20", text: "Exchange Listing" },
           { name: "Bybit", icon: "🟠", color: "bg-orange-500/10", border: "border-orange-500/20", text: "Exchange Listing" },
           { name: "OKX", icon: "⚫", color: "bg-white/5", border: "border-white/10", text: "Exchange Listing" },
           { name: "Trust Wallet", icon: "🔵", color: "bg-blue-600/10", border: "border-blue-600/20", text: "Self-Custody" }
         ].map((ex) => (
           <div key={ex.name} className="glass-card flex justify-between items-center bg-zinc-900/40 !rounded-3xl border-white/5 py-4">
             <div className="flex items-center gap-3">
               <div className={`w-10 h-10 ${ex.color} rounded-2xl flex items-center justify-center border ${ex.border}`}>
                 <span className="text-xl">{ex.icon}</span>
               </div>
               <div>
                 <p className="text-sm font-black text-white uppercase select-none">{ex.name}</p>
                 <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">{ex.text}</p>
               </div>
             </div>
             <button 
               onPointerDown={(e) => { e.stopPropagation(); }}
               className="bg-zinc-800 text-zinc-300 text-[10px] font-black uppercase px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
             >
               Link
             </button>
           </div>
         ))}
         
         <p className="px-4 text-[9px] text-zinc-600 font-medium leading-relaxed italic text-center">Note: It Should Also Be Mentioned That Users Must Complete Tasks Correctly. Each User Will Be Manually Reviewed Before The Airdrop Distribution. Cheaters Will Not Be Rewarded.</p>
      </div>
    </div>
  );

  if (!mounted) return <div className="tma-container bg-zinc-950 flex items-center justify-center font-black uppercase text-zinc-800">Loading...</div>;

  return (
    <div className="tma-container bg-transparent text-white">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#A3FF12]/2 to-transparent -z-10 pointer-events-none"></div>
      <div className="fixed top-[20%] right-[-10%] w-64 h-64 bg-blue-500/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      
      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-2 touch-auto">
        {activeTab === "mining" && renderMining()}
        {activeTab === "upgrades" && renderUpgrades()}
        {activeTab === "tasks" && renderTasks()}
        {activeTab === "frens" && renderFrens()}
        {activeTab === "wallet" && renderWallet()}
      </main>


      {/* Bottom Navigation */}
      <nav className="fixed bottom-4 left-6 right-6 max-w-[360px] mx-auto bg-[#1a1a1a]/95 backdrop-blur-3xl border border-white/5 py-2.5 px-3 rounded-[1.5rem] flex items-center justify-around shadow-[0_10px_50px_rgba(0,0,0,1)] z-[999999] pointer-events-auto select-none transition-all duration-300">
        <NavButton 
          active={activeTab === "mining"} 
          onClick={() => setActiveTab("mining")} 
          icon="⛏️" 
          label="Mining" 
        />
        <NavButton 
          active={activeTab === "upgrades"} 
          onClick={() => setActiveTab("upgrades")} 
          icon="⚡" 
          label="Boost" 
        />
        <NavButton 
          active={activeTab === "tasks"} 
          onClick={() => setActiveTab("tasks")} 
          icon="📋" 
          label="Tasks" 
        />
        <NavButton 
          active={activeTab === "frens"} 
          onClick={() => setActiveTab("frens")} 
          icon="🤝" 
          label="Frens" 
        />
        <NavButton 
          active={activeTab === "wallet"} 
          onClick={() => setActiveTab("wallet")} 
          icon="👛" 
          label="Wallet" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <div 
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex flex-col items-center gap-1 transition-all duration-300 py-1 flex-1 cursor-pointer pointer-events-auto active:scale-90 touch-manipulation ${active ? 'opacity-100' : 'opacity-40 grayscale'}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-2xl ${active ? 'bg-[#A3FF12] text-black shadow-[0_0_12px_rgba(163,255,18,0.3)]' : 'text-zinc-500 bg-zinc-900/40'}`}>
        <span>{icon}</span>
      </div>
      <span className={`text-[8px] font-black uppercase tracking-tighter ${active ? 'text-[#A3FF12]' : 'text-zinc-500'}`}>{label}</span>
    </div>
  );
}

