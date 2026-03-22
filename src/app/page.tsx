"use client";

import { useRef, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

type Tab = "mining" | "tasks" | "frens" | "wallet" | "upgrades" | "leaderboard" | "history" | "settings";

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
  const [miningRate, setMiningRate] = useState(10); // Loon per hour
  const [energy, setEnergy] = useState(1000);
  const [maxEnergy] = useState(1000);
  const [lastClaim, setLastClaim] = useState<number>(0);
  const [streak, setStreak] = useState(0);
  const [lastDailyClaim, setLastDailyClaim] = useState<string | null>(null);
  const [userWallet, setUserWallet] = useState<any>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkTarget, setLinkTarget] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [showWithdrawInfo, setShowWithdrawInfo] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [pendingLoon, setPendingLoon] = useState(0);
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  const [mounted, setMounted] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalMined, setTotalMined] = useState(0);
  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);
  const [lbType, setLbType] = useState<"coin" | "referral">("coin");
  const [userRank, setUserRank] = useState<number | null>(null);

  const tonAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();

  // Auto-Link TON Wallet when detected
  useEffect(() => {
    if (tonAddress && userId && userWallet && tonAddress !== userWallet.telegram_wallet_address) {
      const syncTonWallet = async () => {
        const { error } = await supabase
          .from('users')
          .update({ telegram_wallet_address: tonAddress })
          .eq('id', userId);

        if (!error) {
          setUserWallet((prev: any) => ({ ...prev, telegram_wallet_address: tonAddress }));
          if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
            (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            (window as any).Telegram.WebApp.showAlert("💎 TON Wallet auto-linked successfully!");
          }
        }
      };
      syncTonWallet();
    }
  }, [tonAddress, userId, userWallet]);

  // Refs for interval to avoid stale closures
  const lastClaimRef = useRef<number>(0);
  const miningRateRef = useRef<number>(10);
  const energyRef = useRef<number>(1000);

  const fetchHistory = async () => {
    if (!userId) return;
    setIsFetchingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (data) setHistory(data);
    } catch (e) { console.error(e); }
    finally { setIsFetchingHistory(false); }
  };

  const recordTransaction = async (type: string, title: string, amount: number, is_income: boolean = true) => {
    if (!userId) return;
    try {
      await supabase.from('transactions').insert({
        user_id: userId,
        type,
        title,
        amount,
        is_income
      });
      // Refresh local history if tab is open or needed
      if (activeTab === 'history') fetchHistory();
    } catch (e) {
      console.error("Tx recording error:", e);
    }
  };


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

  // Fetch history on tab switch
  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  // Sync coins periodically or on specific actions
  useEffect(() => {
    // init
  }, [userId]);

  const handleTap = (e: React.PointerEvent | React.MouseEvent) => {
    if (energy <= 0) return; // Cannot mine if out of energy
    if (hapticsEnabled && typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
      (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    e.preventDefault();
    e.stopPropagation();

    setEnergy(prev => {
      const next = Math.max(0, prev - 1);
      energyRef.current = next;
      return next;
    });
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Spawn particle
    const id = Date.now();
    setParticles((prev: CoinParticle[]) => [...prev, { id, x, y }]);

    setCoins((prev: number) => {
      const next = prev + 1;
      setTotalMined(t => t + 1);
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

  const calculateClaimable = () => {
    const now = Date.now();
    const secondsSince = Math.max(0, (now - lastClaimRef.current) / 1000);
    return (secondsSince * (miningRateRef.current / 3600));
  };

  const handleClaim = async () => {
    if (isClaiming || !userId) return;
    setIsClaiming(true);

    // Calculate claimable amount base on time
    const amountToClaim = Math.floor(pendingLoon);
    const originalPending = pendingLoon;

    // 1. Spawning multiple particles for visual impact
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const id = Date.now() + i;
        setParticles(prev => [...prev, { id, x: 160 + Math.random() * 80, y: 500 + Math.random() * 50 }]);
        setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 800);
      }, i * 40);
    }

    // 2. Visual "Reverse" Countdown
    let startTime = Date.now();
    const duration = 600; // 0.6 seconds

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Gradually decrease pending, gradually increase displayed coins
      setPendingLoon(originalPending * (1 - progress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        completeClaim(amountToClaim);
      }
    };

    requestAnimationFrame(animate);
  };

  const completeClaim = async (amount: number) => {
    try {
      const now = new Date().toISOString();
      const newTotal = coins + amount;
      const newTotalMined = totalMined + amount;

      await supabase
        .from('users')
        .update({
          coins: newTotal,
          last_claim: now,
          total_mined: newTotalMined
        })
        .eq('id', userId);

      setCoins(newTotal);
      setTotalMined(newTotalMined);
      setPendingLoon(0);
      const nowTs = Date.now();
      setLastClaim(nowTs);
      lastClaimRef.current = nowTs;
      setIsClaiming(false);

      // Record transaction
      recordTransaction('mining', 'Claim Mining Loot', amount, true);

      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
    } catch (e) {
      console.error("Claim error:", e);
      setIsClaiming(false);
    }
  };

  const handleBuyUpgrade = async (id: string, cost: number, rateBoost: number) => {
    if (coins < cost || !userId) return;

    const newTotal = coins - cost;
    const newRate = miningRate + rateBoost;

    try {
      await supabase
        .from('users')
        .update({
          coins: newTotal,
          mining_rate: newRate
        })
        .eq('id', userId);

      setCoins(newTotal);
      setMiningRate(newRate);
      miningRateRef.current = newRate;

      // Record transaction
      recordTransaction('upgrade', `Boost: ${id}`, cost, false);

      // Visual & Haptic Feedback
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        (window as any).Telegram.WebApp.showAlert(`🚀 Upgrade Successful! New Rate: ${newRate}/h`);
      } else {
        alert(`🚀 Upgrade Successful! New Rate: ${newRate}/h`);
      }
    } catch (e) {
      console.error("Purchase error:", e);
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.showAlert("❌ Purchase failed. Please try again.");
      }
    }
  };

  const handleDailyReward = async () => {
    if (!userId) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (lastDailyClaim === today) {
      alert("⚠️ Already claimed today! Come back tomorrow.");
      return;
    }

    const reward = (streak + 1) * 1000;
    const newTotal = coins + reward;
    const newStreak = streak + 1;

    try {
      await supabase
        .from('users')
        .update({
          coins: newTotal,
          streak: newStreak,
          last_daily_claim: today
        })
        .eq('id', userId);

      setCoins(newTotal);
      setStreak(newStreak);
      setLastDailyClaim(today);

      // Record transaction
      recordTransaction('daily_bonus', `Daily Bonus Day ${newStreak}`, reward, true);

      console.log(`✅ Daily reward Day ${newStreak} saved to Supabase.`);
      alert(`🎁 Day ${newStreak} claimed: +${reward.toLocaleString()} $LOON!`);
    } catch (e) {
      console.error("❌ Failed to save daily reward:", e);
      alert("⚠️ Error saving reward—check your database connection.");
    }
  };

  const handleCompleteTask = async (taskId: string, reward: number) => {
    if (!userId || completedTasks.includes(taskId)) return;

    const newTotal = coins + reward;

    try {
      // 1. Record completion (Supabase unique constraint will prevent dupes)
      await supabase.from('user_tasks').insert({ user_id: userId, task_id: taskId });

      // 2. Add reward
      await supabase.from('users').update({ coins: newTotal }).eq('id', userId);

      setCoins(newTotal);
      setCompletedTasks(prev => [...prev, taskId]);

      // Record transaction
      recordTransaction('task', `Task: ${taskId}`, reward, true);

      alert(`🎉 Task Complete: +${reward.toLocaleString()} $LOON!`);
    } catch (e) { console.error(e); }
  };

  const fetchLeaderboard = async (type: "coin" | "referral", currentCoins?: number, currentRef?: number) => {
    try {
      if (type === "coin") {
        const c = currentCoins !== undefined ? currentCoins : coins;
        const { data } = await supabase
          .from('users')
          .select('id, username, first_name, coins, mining_rate, photo_url')
          .order('coins', { ascending: false })
          .limit(50);
        if (data) setLeaderboardUsers(data);

        // Find current user rank (approximate)
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gt('coins', c);
        if (count !== null) setUserRank(count + 1);
      } else {
        const { data, error } = await supabase.rpc('get_top_referrers', { limit_num: 50 });
        if (data) {
          setLeaderboardUsers(data);

          // Find current user rank (approximate) - Simplified for referral mode
          const { count: refRankCount } = await supabase.rpc('get_user_referral_rank', { target_user_id: userId });
          if (refRankCount !== null) setUserRank(refRankCount);
        } else {
          console.error("RPC Error:", error);
        }
      }
    } catch (e) {
      console.error("LB error:", e);
    }
  };



  const handleLinkConfirm = async () => {
    if (!userId || !linkTarget || !linkValue) return;

    setIsLinking(true);
    try {
      const fieldMap: Record<string, string> = {
        'Binance': 'binance_id',
        'Bybit': 'bybit_id',
        'OKX': 'okx_id',
        'Trust Wallet': 'trust_wallet_address',
        'Telegram Wallet': 'telegram_wallet_address'
      };

      const field = fieldMap[linkTarget];
      if (!field) return;

      const { error } = await supabase
        .from('users')
        .update({ [field]: linkValue })
        .eq('id', userId);

      if (!error) {
        setUserWallet((prev: any) => ({ ...prev, [field]: linkValue }));
        setIsLinking(false);
        setLinkTarget(null);
        setLinkValue("");
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          (window as any).Telegram.WebApp.showAlert(`✅ Successfully linked ${linkTarget}!`);
        }
      }
    } catch (e) {
      console.error(e);
      setIsLinking(false);
    }
  };

  const handleReferralCopy = () => {
    const link = `https://t.me/Hedhog_airdrop_bot?start=${userId}`;
    navigator.clipboard.writeText(link);

    // Check if the TMA haptic or alert exists
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.showAlert("🔗 Referral link copied to clipboard!");
    } else {
      alert("🔗 Referral link copied!");
    }
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
            photo_url: tgUser.photo_url,
            last_active: new Date().toISOString()
          }, { onConflict: 'id' })
          .select()
          .single();

        if (data) {
          setCoins(data.coins || 0);
          setStreak(data.streak || 0);
          setLastDailyClaim(data.last_daily_claim);
          setUserWallet({
            binance_id: data.binance_id,
            bybit_id: data.bybit_id,
            okx_id: data.okx_id,
            trust_wallet_address: data.trust_wallet_address,
            telegram_wallet_address: data.telegram_wallet_address
          });

          const claimTime = data.last_claim ? new Date(data.last_claim).getTime() : Date.now();
          setLastClaim(claimTime);
          lastClaimRef.current = claimTime;

          setMiningRate(data.mining_rate || 10);
          miningRateRef.current = data.mining_rate || 10;

          // 3. Fetch Real Referral Count
          const { count: refCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('referer_id', uid);

          if (refCount !== null) setReferralCount(refCount);

          // 4. Fetch Real Referral Data
          const { data: refData } = await supabase
            .from('users')
            .select('id, username, first_name, coins, level')
            .eq('referer_id', uid)
            .order('coins', { ascending: false })
            .limit(10);

          if (refData) setReferrals(refData);

          // 5. Fetch Completed Tasks
          const { data: taskData } = await supabase
            .from('user_tasks')
            .select('task_id')
            .eq('user_id', uid);

          if (taskData) setCompletedTasks(taskData.map(t => t.task_id));

          // Set other stats
          setTotalMined(data.total_mined || data.coins || 0);

          // 6. Init Leaderboard with current data to avoid state lag
          fetchLeaderboard("coin", data.coins || 0);
        }
      } catch (err) {
        console.error("Auth/Fetch error:", err);
      } finally {
        setMounted(true);
      }
    };

    initApp();

    // Set initial lastClaim to now to prevent massive jumps before initApp finishes
    const now = Date.now();
    setLastClaim(prev => prev === 0 ? now : prev);
    lastClaimRef.current = lastClaimRef.current === 0 ? now : lastClaimRef.current;

    // Auto-earn and Energy Refill loop
    const earnInterval = setInterval(() => {
      // 1. Refill Energy 
      setEnergy(prev => {
        const next = Math.min(maxEnergy, prev + 0.02);
        energyRef.current = next;
        return next;
      });

      // 2. Tick Pending Loon in Real-time
      setPendingLoon(calculateClaimable());

      // 3. We use 'claimProgress' to represent Energy % for the UI bar
      setClaimProgress((energyRef.current / maxEnergy) * 100);
    }, 200);

    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(earnInterval);
      document.body.style.overflow = "auto";
    };
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            </div>
            <div className="w-8 h-8 glass-card !p-0 flex items-center justify-center !rounded-xl border-white/10 hover:bg-white/5 transition-colors cursor-pointer active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-[#A3FF12] tracking-tighter -mb-1 opacity-70">Collector</span>
            <span className="text-xl font-black uppercase text-white drop-shadow-sm tracking-tight leading-none">{userName}</span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 mb-1.5 px-3 py-1 bg-[#A3FF12]/10 rounded-full border border-[#A3FF12]/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            <span className="text-xs font-black text-[#A3FF12] leading-none uppercase tracking-tighter cursor-default">+{miningRate >= 1000 ? (miningRate / 1000).toFixed(1) + 'K' : miningRate}/h</span>
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
            src="/character.png"
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
            <span className="text-[10px] font-black uppercase text-zinc-300">Upgrade</span>
          </button>
          <button
            onPointerDown={(e) => { e.stopPropagation(); setActiveTab("leaderboard"); }}
            className="flex-1 glass-card flex flex-col items-center justify-center gap-1.5 py-3 !rounded-2xl border-white/10 hover:bg-white/5 transition-colors active:scale-95 touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55.47.98.97 1.21C11.47 18.44 12 19 12 19s.53-.56 1.03-.79c.5-.23.97-.66.97-1.21v-2.34c0-.52.27-1 .73-1.26a3.57 3.57 0 0 0 1.27-5.4M8 6h8" /></svg>
            <span className="text-[10px] font-black uppercase text-zinc-300">Leaders</span>
          </button>
          <button
            onPointerDown={(e) => { e.stopPropagation(); }}
            className="flex-1 glass-card flex flex-col items-center justify-center gap-1.5 py-3 !rounded-2xl border-white/10 hover:bg-white/5 transition-colors active:scale-95 touch-manipulation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A3FF12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /><path d="M3 11a8 8 0 0 1 18 0" /></svg>
            <span className="text-[10px] font-black uppercase text-zinc-300">Combo Game</span>
          </button>
        </div>
      </div>

      {/* Main Claim Progress */}
      <div className="px-4 space-y-3">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 bg-[#A3FF12]/5 px-3 py-1 rounded-full border border-[#A3FF12]/10 w-fit">
            <div className="w-1.5 h-1.5 bg-[#A3FF12] rounded-full animate-pulse shadow-[0_0_5px_#A3FF12]"></div>
            <span className="text-[10px] font-black text-[#A3FF12] uppercase tracking-wider">+{(miningRate / 3600).toFixed(4)} $LOON / SEC</span>
          </div>
        </div>

        <div className="flex justify-between items-end mb-1 px-1">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Mining Limit Energy</p>
          <p className="text-[10px] font-black text-white">{Math.floor(energy)} / {maxEnergy}</p>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${(energy / maxEnergy) * 100}%` }}></div>
        </div>

        <button
          onClick={handleClaim}
          disabled={pendingLoon < 1}
          className="btn-primary w-full py-4 text-base tracking-wide glow-green hover:brightness-110 active:scale-95 transition-all"
        >
          Claim {Math.floor(pendingLoon)} $LOON
        </button>
      </div>

      {/* Stats Cards Section - Ensuring there's content to scroll/feel balanced */}
      <div className="px-4 grid grid-cols-2 gap-3 pb-8">
        <div className="glass-card !p-4 !rounded-3xl border-white/5 bg-zinc-950/30">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Mined</p>
          <p className="text-sm font-black text-white">{totalMined.toLocaleString()}</p>
        </div>
        <div className="glass-card !p-4 !rounded-3xl border-white/5 bg-zinc-950/30">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Referrals</p>
          <p className="text-sm font-black text-white">{referralCount}</p>
        </div>
      </div>
      <div className="h-20 shrink-0" />
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

            const upgrade = { id: i, cost: price, level: level, boost: boost }; // Define upgrade object

            return (
              <div key={i} className="glass-card flex flex-col items-center text-center !p-4 !rounded-3xl border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20 text-[8px] font-black uppercase">Lv. {level}</div>
                <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
                  <span className="text-4xl">{icons[i % icons.length]}</span>
                </div>
                <p className="font-black text-[10px] text-white uppercase mb-1">{names[i % names.length]} M-{i + 1}</p>
                <p className="text-[9px] text-[#A3FF12] font-bold mb-4">+{boost.toFixed(2)} / Sec</p>
                <button
                  onClick={() => handleBuyUpgrade(String(upgrade.id), upgrade.cost, upgrade.boost * 3600)} // Convert boost/sec to boost/hr
                  disabled={coins < upgrade.cost}
                  className={`w-full py-2 rounded-xl border border-white/5 text-[9px] font-black uppercase tracking-wider transition-colors ${coins >= upgrade.cost ? 'bg-[#A3FF12] text-black' : 'bg-[#1A1A1A] text-zinc-400 cursor-not-allowed opacity-50'}`}
                >
                  Upgrade • {price >= 1000 ? (price / 1000).toFixed(1) + 'K' : price}
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
      {/* Daily Reward Row */}
      <div className="pt-6 px-4">
        <h2 className="text-2xl font-black mb-1">Daily Reward</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-4">Don't break your streak! Claim every 24h.</p>
        <div className="grid grid-cols-4 gap-2 mb-8">
          {Array.from({ length: 8 }).map((_, i) => {
            const dayNum = i + 1;
            const isClaimed = dayNum <= streak;
            const isCurrent = dayNum === streak + 1;
            const amount = dayNum * 1000;
            const today = new Date().toISOString().split('T')[0];
            const todayClaimed = lastDailyClaim === today;

            return (
              <div
                key={i}
                className={`glass-card !p-3 flex flex-col items-center justify-center relative overflow-hidden active:scale-95 transition-transform cursor-pointer ${isClaimed ? 'opacity-40 border-transparent bg-zinc-900' : isCurrent && !todayClaimed ? 'border-[#A3FF12] bg-[#A3FF12]/10 ring-1 ring-[#A3FF12]/20' : isCurrent && todayClaimed ? 'border-zinc-700 bg-zinc-800' : 'border-white/5 bg-zinc-900/50'}`}
                onClick={isCurrent && !todayClaimed ? handleDailyReward : undefined}
              >
                <div className="text-[10px] font-black text-zinc-500 uppercase mb-2">Day {dayNum}</div>
                <div className="w-6 h-6 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20 mb-2">
                  <span className="text-[10px]">{isClaimed ? '✅' : '🪙'}</span>
                </div>
                <span className="text-xs font-black text-white">{amount.toLocaleString()}</span>
                <span className="text-[8px] font-bold text-zinc-600 uppercase mt-1">LOON</span>
                {(isClaimed || isCurrent) && (
                  <div className={`absolute inset-x-0 bottom-0 py-1 text-[7px] font-black uppercase tracking-tighter text-center ${isClaimed || todayClaimed ? 'bg-zinc-700 text-zinc-400' : 'bg-[#A3FF12] text-black'}`}>
                    {isClaimed || todayClaimed ? 'Claimed' : 'Claim'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monetized & Growth Tasks */}
      <div className="px-4 space-y-3 pb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Growth & Rewards</h3>
        </div>

        {[
          { id: "ad_1", icon: "📺", name: "Watch Viral Ad #1", reward: 5000, color: "bg-yellow-500/10", border: "border-yellow-500/20", btn: "Watch", highlight: true },
          { id: "group_1", icon: "✈️", name: "Join Private Group", reward: 1200, color: "bg-blue-500/10", border: "border-blue-500/20", btn: "Join", highlight: false },
          { id: "x_1", icon: "𝕏", name: "Follow Alpha Post", reward: 2000, color: "bg-white/10", border: "border-white/10", btn: "Follow", highlight: false },
          { id: "game_1", icon: "🎮", name: "Try New Game", reward: 8500, color: "bg-purple-500/10", border: "border-purple-500/20", btn: "Play", highlight: false },
          { id: "invite_3", icon: "🤝", name: "Invite 3 Frens", reward: 25000, color: "bg-green-500/10", border: "border-green-500/20", btn: "Invite", highlight: false }
        ].map((task) => {
          const isDone = completedTasks.includes(task.id);

          return (
            <div key={task.id} className={`glass-card flex justify-between items-center bg-zinc-900/40 !rounded-2xl border-white/5 py-4 transition-all ${isDone ? 'opacity-50' : 'active:brightness-125'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${task.color} rounded-xl flex items-center justify-center border ${task.border}`}>
                  <span className="text-xl">{task.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-black text-white">{task.name}</p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">+{task.reward.toLocaleString()} LOON</p>
                </div>
              </div>
              <button
                onClick={() => handleCompleteTask(task.id, task.reward)}
                disabled={isDone}
                className={`${isDone ? 'bg-zinc-800 text-zinc-500' : task.highlight ? 'bg-[#A3FF12] text-black glow-green' : 'bg-white text-black'} text-[9px] font-black uppercase px-4 py-2 rounded-lg active:scale-95 transition-transform`}
              >
                {isDone ? '✅ Done' : task.btn}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderFrens = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="pt-8 px-4 text-center mb-6">
        <div className="w-20 h-20 bg-[#A3FF12]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#A3FF12]/20 shadow-[0_0_50px_rgba(163,255,18,0.15)] glow-green">
          <span className="text-4xl">🎁</span>
        </div>
        <h2 className="text-3xl font-black mb-1 tracking-tight">Invite Frens</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-8 leading-relaxed opacity-60">Refer friends and earn 10% of their earnings forever!</p>
      </div>

      <div className="px-4 mb-6">
        <div className="glass-card !rounded-2xl border-white/10 bg-zinc-950/50 p-4">
          <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex flex-col">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total My Frens</p>
              <p className="text-2xl font-black text-white">{referralCount}</p>
            </div>
            <div className="flex flex-col text-right">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Received Coins</p>
              <p className="text-xl font-black text-[#A3FF12]">{(referralCount * 25000).toLocaleString()}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-2 ml-1">My Referral Link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={`https://t.me/Hedhog_airdrop_bot?start=${userId}`}
                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[10px] text-zinc-300 flex-1 outline-none font-mono"
              />
            </div>
          </div>

          <button
            onClick={handleReferralCopy}
            className="w-full bg-[#A3FF12] py-3.5 rounded-2xl text-black text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(163,255,18,0.2)] hover:scale-[1.01] active:scale-95 transition-all glow-green"
          >
            Copy Link & Invite
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] opacity-80">Top 3 Frens</h3>
        </div>

        <div className="space-y-3">
          {referrals.length > 0 ? referrals.map((ref, i) => (
            <div key={ref.id} className="glass-card flex justify-between items-center py-4 border-white/5 rounded-2xl px-5 bg-zinc-900/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-full border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
                  <span className="font-black text-[11px] text-zinc-400">{ref.username?.[0] || ref.first_name?.[0] || 'U'}</span>
                </div>
                <div>
                  <p className="text-sm font-black text-white tracking-tight">{ref.username || ref.first_name || `User_${ref.id.slice(-4)}`}</p>
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Level {ref.level || 1}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-black text-white tracking-tight">{(ref.coins || 0).toLocaleString()}</span>
                <span className="text-[9px] font-black text-[#A3FF12] uppercase tracking-tighter">Active</span>
              </div>
            </div>
          )) : (
            <div className="text-center py-8 opacity-40">
              <p className="text-xs font-bold uppercase tracking-widest">No Friends Yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500 bg-black/40 min-h-screen">
      <div className="pt-8 px-6 text-center relative">
        <button onClick={() => setActiveTab("mining")} className="absolute top-8 left-6 flex items-center gap-1 text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back
        </button>

        <div className="relative inline-block mb-4">
          <div className="w-24 h-24 mx-auto bg-gradient-to-b from-purple-500/20 to-transparent rounded-full flex items-center justify-center border border-purple-500/10">
            <span className="text-6xl drop-shadow-2xl">🏅</span>
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-500 rounded-full border-4 border-black flex items-center justify-center font-black text-xs text-black shadow-lg">1</div>
        </div>

        <h2 className="text-4xl font-black mb-1 tracking-tight text-white italic">LeaderBoard</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-12 leading-relaxed opacity-80 mb-8">Earn Coins Daily For Login Keep Your Streak To Earn More!</p>

        <div className="glass-card !p-5 !rounded-3xl border-purple-500/20 bg-purple-500/5 mb-8 flex justify-between items-center transition-all hover:bg-purple-500/10 active:scale-95 cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-zinc-700 to-zinc-900 rounded-full border border-white/10 flex items-center justify-center text-xl overflow-hidden">
              {userName[0]}
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white tracking-tight">{userName}</p>
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-yellow-500 rounded-full flex items-center justify-center text-[8px]">🪙</div>
                <span className="text-xs font-black text-zinc-400">{coins.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 bg-white/5 py-1 px-3 rounded-full border border-white/5">
              <span className="text-lg">{userRank && userRank <= 3 ? ["🥇", "🥈", "🥉"][userRank - 1] : "🏅"}</span>
              <span className="text-xl font-black text-zinc-200">{userRank ? (userRank >= 1000 ? (userRank / 1000).toFixed(1) + 'k' : userRank) : '...'}</span>
              <span className="text-[9px] font-black text-zinc-500 uppercase ml-1">/ Your Rank</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-1.5 bg-zinc-900/40 rounded-2xl border border-white/5 mb-10 overflow-hidden">
          <button
            onClick={() => { setLbType("coin"); fetchLeaderboard("coin"); }}
            className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${lbType === "coin" ? 'bg-[#A3FF12] text-black shadow-[0_0_20px_rgba(163,255,18,0.2)]' : 'text-zinc-500 hover:text-white'}`}
          >
            By Coin
          </button>
          <button
            onClick={() => { setLbType("referral"); fetchLeaderboard("referral"); }}
            className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-xl ${lbType === "referral" ? 'bg-[#A3FF12] text-black shadow-[0_0_20px_rgba(163,255,18,0.2)]' : 'text-zinc-500 hover:text-white'}`}
          >
            By Referrals
          </button>
        </div>

        <div className="text-left mb-6">
          <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] opacity-80 pl-2">Top User</h3>
        </div>

        <div className="space-y-3 pb-32">
          {leaderboardUsers.map((user, i) => {
            const isTop3 = i < 3;
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div key={user.id} className="glass-card flex justify-between items-center py-4 border-white/5 rounded-2xl px-5 bg-zinc-900/30 group hover:bg-zinc-900/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-zinc-800 to-black rounded-full border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
                      {user.photo_url ? (
                        <img src={user.photo_url} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-[14px] text-zinc-400">{(user.username || user.first_name || 'U')[0].toUpperCase()}</span>
                      )}
                    </div>
                    {isTop3 && (
                      <div className="absolute -top-1.5 -left-1.5 text-lg drop-shadow-sm">{medals[i]}</div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-white tracking-tight">{user.username || user.first_name || `Hedge_${user.id.slice(-4)}`}</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 bg-yellow-500 rounded-full flex items-center justify-center text-[8px]">🪙</div>
                      <span className="text-xs font-black text-zinc-200">{user.coins.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                       <span className="text-[11px] font-black text-white italic">{lbType === 'coin' ? (user.mining_rate || 0).toFixed(1) : (user.referral_count || 0)}</span>
                       <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter cursor-default">{lbType === 'coin' ? 'Coins/Sec' : 'Frens'}</span>
                    </div>
                  </div>
                  <div className="w-8 text-right font-black text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    {isTop3 ? '' : i + 1}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderWallet = () => {
    const isAnyAccountLinked = tonAddress || 
                               userWallet?.binance_id || 
                               userWallet?.bybit_id || 
                               userWallet?.okx_id || 
                               userWallet?.trust_wallet_address || 
                               userWallet?.telegram_wallet_address;

    return (
      <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="pt-6 px-4">
          <h2 className="text-2xl font-black mb-1 italic tracking-tight">WALLET</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Check balances and manage withdrawals</p>
        </div>

        <div className="px-4 mt-6 mb-3 relative">
           <div className="glass-card !rounded-3xl border-white/10 bg-zinc-950/50 p-6">
              <div className="flex flex-col items-center mb-6">
                 <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">$LOON BALANCE</p>
                 <h3 className="text-4xl font-black text-white">{coins.toLocaleString()}</h3>
                 <p className="text-[10px] font-black text-[#A3FF12] mt-1 select-none">≈ ${(coins * 0.012).toLocaleString()} USD</p>
              </div>
              <div className="flex gap-2">
                 <button 
                   onClick={() => setShowWithdrawInfo(true)}
                   className="flex-1 bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase py-3 rounded-xl active:scale-95 transition-all"
                 >
                   Withdrawal
                 </button>
                 <button 
                   onClick={() => setActiveTab("history")}
                   className="flex-1 bg-[#A3FF12] text-black text-[10px] font-black uppercase py-3 rounded-xl glow-green active:scale-95 transition-all"
                 >
                   History
                 </button>
              </div>
           </div>
        </div>

        <div className="px-4 space-y-3 pb-32">
           <h3 className="px-1 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Connected Accounts</h3>
           {/* TON Connection - Standardized */}
           <div className="glass-card flex justify-between items-center bg-zinc-900/40 !rounded-3xl border-white/5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden">
              <img src="/telegram-wallet.png" alt="Telegram Wallet" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase select-none">Telegram Wallet</h4>
              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Official Airdrop Network</p>
            </div>
          </div>
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!tonAddress) {
                tonConnectUI.openModal();
              }
            }}
            className={`text-[9px] font-black uppercase px-4 py-2.5 rounded-xl transition-all ${tonAddress || userWallet?.telegram_wallet_address ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-500 text-white glow-blue active:scale-95'}`}
          >
            {tonAddress || userWallet?.telegram_wallet_address ? "Linked" : "Connect"}
          </button>
        </div>

        {/* Other Exchanges - Matching Size */}
        {[
          { name: "Binance", img: "/binance-exchange.png", color: "bg-yellow-400/5", border: "border-yellow-400/10", text: "Exchange Listing", field: 'binance_id' },
          { name: "Bybit", img: "/bybit-exchange.png", color: "bg-orange-500/5", border: "border-orange-500/10", text: "Exchange Listing", field: 'bybit_id' },
          { name: "OKX", img: "/okx-exchnage.png", color: "bg-white/5", border: "border-white/5", text: "Exchange Listing", field: 'okx_id' },
          { name: "Trust Wallet", img: "/trust-wallet.webp", color: "bg-blue-600/5", border: "border-blue-600/10", text: "Self-Custody", field: 'trust_wallet_address' }
        ].map((ex) => (
          <div key={ex.name} className="glass-card flex justify-between items-center bg-zinc-900/40 !rounded-3xl border-white/5 py-4 transition-all active:scale-[0.98]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${ex.color} rounded-2xl flex items-center justify-center border ${ex.border} overflow-hidden`}>
                <img src={ex.img} alt={ex.name} className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase select-none">{ex.name}</p>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">{ex.text}</p>
              </div>
            </div>
            <button
              onPointerDown={(e) => { 
                e.stopPropagation(); 
                if (ex.name === "Trust Wallet" || ex.name === "OKX") {
                  if (!tonAddress) tonConnectUI.openModal();
                } else {
                  setLinkTarget(ex.name); setLinkValue(userWallet?.[ex.field] || ""); 
                }
              }}
              className={`text-[10px] font-black uppercase px-4 py-2.5 rounded-xl transition-all ${((ex.name === "Trust Wallet" && tonAddress) || (ex.name === "OKX" && tonAddress) || userWallet?.[ex.field]) ? 'bg-zinc-800 text-zinc-400' : 'bg-[#A3FF12] text-black active:scale-95'}`}
            >
              {((ex.name === "Trust Wallet" && tonAddress) || (ex.name === "OKX" && tonAddress) || userWallet?.[ex.field]) ? "Linked" : ((ex.name === "Trust Wallet" || ex.name === "OKX") ? "Connect" : "Link")}
            </button>
          </div>
        ))}

        {/* Modal Overlay */}
        {linkTarget && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-[320px] glass-card border-white/10 !p-6 !rounded-[2.5rem] bg-zinc-950 shadow-2xl">
              <h3 className="text-xl font-black text-white uppercase mb-1">{linkTarget}</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-6">Enter Your {linkTarget.includes('Wallet') ? 'Address' : 'User ID'}</p>

              <input
                autoFocus
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder={linkTarget.includes('Wallet') ? 'T-Address... or 0x...' : 'Your UID...'}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-[#A3FF12]/50 outline-none mb-6 transition-all"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => { setLinkTarget(null); setLinkValue(""); }}
                  className="flex-1 py-4 rounded-2xl bg-zinc-800 text-zinc-400 text-xs font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkConfirm}
                  disabled={isLinking || !linkValue}
                  className="flex-2 py-4 rounded-2xl bg-[#A3FF12] text-black text-xs font-black uppercase tracking-widest glow-green disabled:opacity-50"
                >
                  {isLinking ? 'Linking...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Withdrawal Feedback Modal */}
          {showWithdrawInfo && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in zoom-in duration-300">
               <div className="w-full max-w-[340px] glass-card border-white/15 !p-8 !rounded-[2.5rem] bg-zinc-950 shadow-2xl overflow-hidden relative">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full"></div>
                  
                  {/* Fanned Logo Deck Banner Inside Announcement */}
                  <div className="flex justify-center h-[100px] items-end mb-8 relative perspective-[1000px]">
                    {[
                      { img: "/binance-exchange.png", rot: "-rotate-12", tx: "-translate-x-12", z: "z-10" },
                      { img: "/okx-exchnage.png", rot: "-rotate-6", tx: "-translate-x-4", z: "z-20" },
                      { img: "/bybit-exchange.png", rot: "rotate-0", tx: "translate-x-0", z: "z-30" },
                      { img: "/telegram-wallet.png", rot: "rotate-6", tx: "translate-x-4", z: "z-20" },
                      { img: "/trust-wallet.webp", rot: "rotate-12", tx: "translate-x-12", z: "z-10" }
                    ].map((card, i) => (
                      <div 
                        key={i} 
                        className={`absolute w-12 h-12 bg-zinc-900 border border-white/20 rounded-xl p-1.5 shadow-xl transition-all ${card.rot} ${card.tx} ${card.z}`}
                      >
                        <img src={card.img} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>

                  <h3 className="text-2xl font-black text-white text-center uppercase mb-2 tracking-tight">
                    {isAnyAccountLinked ? 'Airdrop Pending' : 'Action Required'}
                  </h3>
                  
                  <p className="text-xs font-medium text-zinc-400 text-center leading-relaxed mb-8">
                    {isAnyAccountLinked 
                      ? "Congratulations! Your linked account is registered. All earned $LOON will be automatically transferred to your account on the scheduled Airdrop day." 
                      : "To receive your tokens, you must link an exchange account or connect your TON Wallet first. Please check the Wallet tab."}
                  </p>

                  <button 
                    onClick={() => setShowWithdrawInfo(false)}
                    className="w-full py-4 rounded-2xl bg-[#A3FF12] text-black text-xs font-black uppercase tracking-widest glow-green transition-transform active:scale-95"
                  >
                    Understood
                  </button>
               </div>
            </div>
          )}
         
         <p className="px-4 text-[9px] text-zinc-600 font-medium leading-relaxed italic text-center">Note: It Should Also Be Mentioned That Users Must Complete Tasks Correctly. Each User Will Be Manually Reviewed Before The Airdrop Distribution. Cheaters Will Not Be Rewarded.</p>
      </div>
    </div>
    );
  };
  
  const renderSettings = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pt-6 px-4">
        <h2 className="text-2xl font-black mb-1 italic tracking-tight uppercase">Settings</h2>
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Configure your experience</p>
      </div>

      <div className="px-4 mt-8 space-y-4 pb-32">
         {/* Preferences Section */}
         <div className="glass-card bg-zinc-900/40 border-white/5 !rounded-3xl p-6">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6">General Preferences</h3>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl">📳</div>
                  <div>
                    <p className="text-sm font-black text-white uppercase select-none">Haptic Feedback</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Physical response on interaction</p>
                  </div>
               </div>
               <button 
                onClick={() => setHapticsEnabled(!hapticsEnabled)}
                className={`w-12 h-7 rounded-full transition-all flex items-center px-1 ${hapticsEnabled ? 'bg-[#A3FF12]' : 'bg-zinc-800'}`}
               >
                  <div className={`w-5 h-5 rounded-full bg-black shadow-lg transition-all transform ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
               </button>
            </div>
         </div>

         {/* Project Info Section */}
         <div className="glass-card bg-zinc-900/40 border-white/5 !rounded-3xl p-1 overflow-hidden">
            <button 
              onClick={() => setShowDetailsModal(true)}
              className="w-full h-full p-5 flex items-center justify-between active:bg-white/5 transition-all text-left"
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl">💎</div>
                  <div>
                    <p className="text-sm font-black text-white uppercase select-none">About HedHog</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Tokenomics & Project Roadmap</p>
                  </div>
               </div>
               <span className="text-zinc-600">→</span>
            </button>
            <div className="h-[1px] bg-white/5 mx-6"></div>
            <a 
              href="https://t.me/hedgehog_ai" 
              target="_blank"
              onClick={(e) => {
                if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
                  e.preventDefault();
                  (window as any).Telegram.WebApp.openTelegramLink("https://t.me/hedgehog_ai");
                }
              }}
              className="w-full block p-5 flex items-center justify-between active:bg-white/5 transition-all text-left"
            >
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-xl">📣</div>
                  <div>
                    <p className="text-sm font-black text-white uppercase select-none">Join Channel</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">Daily updates & announcements</p>
                  </div>
               </div>
               <span className="text-zinc-600">→</span>
            </a>
         </div>

         {/* Logout/Reset Row (Informational) */}
         <p className="text-[10px] text-zinc-700 font-black text-center pt-8 uppercase tracking-[0.3em]">Version 1.2.4-Gold</p>
      </div>

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="w-full bg-zinc-950 border-t border-white/10 rounded-t-[3rem] p-8 animate-in slide-in-from-bottom-full duration-500 shadow-2xl overflow-y-auto max-h-[85vh]">
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-8"></div>
              
              <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Project Details</h3>
              <p className="text-[10px] text-[#A3FF12] font-black uppercase tracking-[0.3em] mb-8">Official Documentation Preview</p>

              <div className="space-y-8">
                 <div>
                    <h4 className="text-lg font-black text-white uppercase mb-3 px-1 border-l-2 border-[#A3FF12] pl-3">Tokenomics</h4>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
                          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Supply</p>
                          <p className="text-lg font-black text-white">10.0B $LOON</p>
                       </div>
                       <div className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
                          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Airdrop Pool</p>
                          <p className="text-lg font-black text-white">75% (7.5B)</p>
                       </div>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-4 leading-relaxed font-bold uppercase tracking-wider px-2">The Airdrop distribution is scheduled for late 2024. Active miners, task completers, and top referrers will receive the largest share based on their $LOON holdings.</p>
                 </div>

                 <div>
                    <h4 className="text-lg font-black text-white uppercase mb-3 px-1 border-l-2 border-blue-500 pl-3">Roadmap</h4>
                    <div className="space-y-3">
                       <div className="flex gap-4 items-start bg-zinc-900/30 p-4 rounded-3xl border border-white/5 opacity-50">
                          <div className="text-xl">✅</div>
                          <div>
                             <p className="text-sm font-black text-white uppercase">Phase 1: Launch</p>
                             <p className="text-[9px] text-zinc-500 font-bold uppercase">Bot Launch, Mining, Basic Tasks</p>
                          </div>
                       </div>
                       <div className="flex gap-4 items-start bg-zinc-900/30 p-4 rounded-3xl border border-white/10 glow-green">
                          <div className="text-xl">🛠️</div>
                          <div>
                             <p className="text-sm font-black text-white uppercase italic">Phase 2: Growth (CURRENT)</p>
                             <p className="text-[9px] text-zinc-400 font-bold uppercase">Exchanges, Leaderboards, Daily Combo</p>
                          </div>
                       </div>
                       <div className="flex gap-4 items-start bg-zinc-900/10 p-4 rounded-3xl border border-dashed border-white/10 opacity-30">
                          <div className="text-xl">🚀</div>
                          <div>
                             <p className="text-sm font-black text-white uppercase">Phase 3: TGE</p>
                             <p className="text-[9px] text-zinc-500 font-bold uppercase">Token Listing, Liquidity, Staking</p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <button 
                onClick={() => setShowDetailsModal(false)}
                className="w-full py-5 rounded-[2rem] bg-white text-black text-xs font-black uppercase tracking-widest mt-10 active:scale-95 transition-all shadow-xl"
              >
                Close Details
              </button>
           </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="page-container animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="pt-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => setActiveTab("wallet")}
            className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:scale-95 transition-all"
          >
            ←
          </button>
          <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Reward History</h2>
           <button 
            onClick={() => fetchHistory()}
            className="w-10 h-10 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-400 active:scale-95 transition-all"
          >
            ↻
          </button>
        </div>

        <div className="space-y-4 px-2 pb-32">
           {history.length === 0 ? (
             <div className="text-center pt-20">
                <div className="w-16 h-16 bg-zinc-900 mx-auto rounded-full flex items-center justify-center text-2xl mb-4 border border-white/5 grayscale opacity-50">📜</div>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">No transactions recorded yet</p>
             </div>
           ) : (
             history.map((item, i) => (
               <div key={i} className="glass-card flex justify-between items-center bg-zinc-900/40 !rounded-3xl border-white/5 py-5 px-6 group active:bg-zinc-900/60 transition-all">
                  <div className="flex gap-4 items-center">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${item.is_income ? 'bg-[#A3FF12]/5 text-[#A3FF12] border border-[#A3FF12]/10' : 'bg-red-500/5 text-red-400 border border-red-500/10'}`}>
                        {item.type === 'mining' ? '⛏️' : 
                         item.type === 'daily_bonus' ? '🎁' : 
                         item.type === 'task' ? '📋' : 
                         item.type === 'referral' ? '🤝' : '⚡'}
                     </div>
                     <div>
                        <p className="text-sm font-black text-white uppercase select-none">{item.title}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                          {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className={`text-sm font-black ${item.is_income ? 'text-[#A3FF12]' : 'text-zinc-400'}`}>
                       {item.is_income ? '+' : '-'}{item.amount.toLocaleString()}
                     </p>
                     <p className="text-[8px] text-zinc-600 font-black uppercase">$LOON</p>
                  </div>
               </div>
             ))
           )}
           
           {history.length > 0 && <p className="text-[10px] text-zinc-700 font-black text-center pt-8 uppercase tracking-[0.3em]">No more transactions</p>}
        </div>
      </div>
    </div>
  );

  if (!mounted) return renderSkeleton();

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
        {activeTab === "history" && renderHistory()}
        {activeTab === "settings" && renderSettings()}
        {activeTab === "leaderboard" && renderLeaderboard()}
      </main>


      {/* Bottom Navigation */}
      <nav className="fixed bottom-12 left-6 right-6 max-w-[360px] mx-auto bg-zinc-900 border border-white/10 py-2.5 px-3 rounded-2xl flex items-center justify-around z-50 pointer-events-auto select-none transition-all duration-300">
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
        <NavButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          icon="⚙️"
          label="Options"
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

