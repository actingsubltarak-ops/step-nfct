import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, LogIn, User, Briefcase, Building2, Shield, Loader2, ChevronRight, ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { cn, getRoleDisplayName } from '../lib/utils';
import { toast } from 'sonner';
import { auth, loginWithEmail, loginWithGoogle, loginWithGoogleRedirect, registerWithEmail, resetPassword, Timestamp, db } from '../firebase';
import { userService } from '../services/userService';
import { doc, getDoc, collection, query, where, getDocs, limit, getCountFromServer } from 'firebase/firestore';

interface LoginScreenProps {
  departments: any[];
  taskOwners: any[];
}

export function LoginScreen({ departments, taskOwners }: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<'Staff' | 'Supervisor' | 'Administrator'>('Staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0 });

  // Detect In-App Browser or AI Studio Editor Environment
  const browserInfo = React.useMemo(() => {
    if (typeof window === 'undefined') return { isInApp: false, isEditor: false, isMobile: false };
    const ua = navigator.userAgent || navigator.vendor;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isEditor = window.location.hostname.includes('aistudio.google.com') || window.self !== window.top;
    const isInApp = (
      ua.includes('FBAN') || ua.includes('FBAV') || // Facebook
      ua.includes('Line') || // LINE
      ua.includes('Instagram') || // Instagram
      ua.includes('MicroMessenger') || // WeChat
      (ua.includes('Android') && ua.includes('Version/')) // Android Webview
    );
    return { isInApp, isEditor, isMobile };
  }, []);

  const [formId] = useState(() => Math.random().toString(36).substring(7));

  const copySharedUrl = () => {
    // Attempt to get the clean shared URL
    const url = window.location.origin;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('คัดลอกลิงก์เรียบร้อยแล้ว', {
        description: 'กรุณานำไปกดวางใน Chrome หรือ Safari เพื่อเข้าใช้งาน'
      });
    }).catch(() => {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast.success('คัดลอกลิงก์เรียบร้อยแล้ว');
    });
  };

  // Fetch stats for the landing page
  React.useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const statsRef = doc(db, 'stats', 'dashboard');
        const statsSnap = await getDoc(statsRef);
        
        if (isMounted && statsSnap.exists()) {
          const data = statsSnap.data();
          setStats({ 
            total: Math.max(0, data.total || 0), 
            completed: Math.max(0, data.completed || 0) 
          });
        }
      } catch (error) {
        // Only log warning, as public stats might be blocked or not yet exists
        if (isMounted) {
          console.warn("Public stats fetch failed:", error);
          setStats({ total: 0, completed: 0 });
        }
      }
    };
    
    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setIsSubmitting(true);
    console.log("Email Login: Attempting...", { email: email.toLowerCase().trim() });
    try {
      await loginWithEmail(email, password);
      console.log("Email Login: Success");
      toast.success('เข้าสู่ระบบสำเร็จ');
    } catch (error: any) {
      console.error("Email Login: Failed", error);
      const errorCode = error.code;
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
        toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (errorCode === 'auth/too-many-requests') {
        toast.error('คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอกรณีครู่แล้วลองใหม่');
      } else if (errorCode === 'auth/operation-not-allowed') {
        toast.error('ระบบ Email Login ยังไม่ถูกเปิดใช้งาน', {
          description: 'กรุณาไปที่ Firebase Console -> Authentication -> Sign-in method แล้วเปิดใช้งาน Email/Password ครับ'
        });
      } else if (errorCode === 'auth/network-error') {
        toast.error('เกิดข้อผิดพลาดทางเครือข่าย', {
          description: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต และตรวจสอบว่าค่า VITE_FIREBASE_API_KEY ใน Vercel ถูกต้อง'
        });
      } else {
        toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', {
          description: `Error Code: ${errorCode}\nMessage: ${error.message || 'กรุณาลองใหม่อีกครั้ง'}`
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('กรุณากรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน');
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim());
      toast.success('ส่งลิงก์รีเซ็ตรหัสผ่านเรียบร้อยแล้ว');
      setIsForgotPassword(false);
    } catch (error: any) {
      console.error('Reset Password Error:', error);
      toast.error('ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isSubmitting) {
      console.log("Google Login: Already submitting, ignoring click.");
      return;
    }
    
    console.log("Google Login: Start", { 
      hostname: window.location.hostname,
      isVercel: window.location.hostname.includes('vercel.app'),
      isEditor: browserInfo.isEditor,
      isMobile: browserInfo.isMobile
    });

    setIsSubmitting(true);
    
    // Safety timeout: Reset submitting state if it takes too long
    const timeout = setTimeout(() => {
      setIsSubmitting(false);
      console.warn("Google Login: Timeout reached, resetting isSubmitting");
    }, 10000);

    // Check if we should use redirect instead of popup
    // Vercel and mobile browsers often prefer redirect to avoid popup blocking
    const isVercel = window.location.hostname.includes('vercel.app');
    // Based on analysis, Popup works better on Vercel to avoid cross-origin cookie issues with Redirect
    const shouldRedirect = browserInfo.isMobile && !isVercel;

    try {
      if (shouldRedirect && !browserInfo.isEditor) {
        toast.info('กำลังเปิดหน้าเข้าสู่ระบบแบบ Redirect...', { duration: 3000 });
        console.log("Google Login: Calling Redirect");
        await loginWithGoogleRedirect();
        // The page will redirect, if it doesn't, the timeout will reset the state
      } else {
        console.log("Google Login: Calling Popup");
        const result = await loginWithGoogle();
        clearTimeout(timeout);
        if (result) {
          toast.success('เข้าสู่ระบบสำเร็จ');
        }
        setIsSubmitting(false);
      }
    } catch (error: any) {
      clearTimeout(timeout);
      setIsSubmitting(false);
      
      const errorCode = error.code || 'unknown';
      const errorMessage = error.message || 'Unknown error';
      
      console.error('Google Login Error Details:', error);
      console.error('Google Login Error Summary:', { code: errorCode, message: errorMessage });
      
      const isBlocked = errorCode === 'auth/popup-blocked' || errorCode === 'auth/popup-closed-by-user';
      const isIframe = window.self !== window.top;
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const is403 = errorMessage.includes('403') || errorCode.includes('permission-denied') || errorMessage.includes('network-error');
      const isUnauthorizedDomain = errorCode === 'auth/unauthorized-domain' || errorMessage.includes('domain is not authorized');
      const isStorage = errorMessage.includes('storage') || errorMessage.includes('cross-origin') || (errorCode === 'auth/internal-error' && errorMessage.toLowerCase().includes('storage'));

      if (isUnauthorizedDomain) {
        if (isLocalhost) {
          toast.error('Domain "localhost" ยังไม่ได้รับอนุญาต', {
            description: 'กรุณาไปที่ Firebase Console -> Authentication -> Settings -> Authorized domains แล้วเพิ่ม "localhost" ลงไปครับ'
          });
        } else {
          toast.error('Domain นี้ยังไม่ได้รับอนุญาต', {
            description: `กรุณาเพิ่ม "${window.location.hostname}" ใน Authorized Domains ของ Firebase Console ก่อนครับ`
          });
        }
      } else if (is403 && isIframe) {
        toast.error('Google ปฏิเสธการเชื่อมต่อ (403)', { 
          description: 'เกิดจากข้อจำกัดของ Google ใน Iframe กรุณากดปุ่ม "เปิดในเบราว์เซอร์" ด้านล่าง หรือปุ่มขวาบนของหน้า Preview เพื่อเข้าใช้งาน',
          duration: 10000
        });
      } else if (is403) {
        toast.error('Google ปฏิเสธการเชื่อมต่อ (403)', { 
          description: 'กรุณาตรวจสอบว่าเปิดใช้ Google Sign-in ใน Firebase Console หรือตรวจสอบ Authorized Domains' 
        });
      } else if (isBlocked) {
        toast.error('หน้าต่างถูกบล็อกหรือปิด', {
          description: isIframe ? 'กรุณาอนุญาตให้เปิดป๊อปอัพ หรือ "เปิดในเบราว์เซอร์" ที่หน้าต่างใหม่' : 'กรุณาอนุญาตให้เปิดป๊อปอัพเพื่อเข้าสู่ระบบ'
        });
      } else if (isStorage) {
        toast.error('ข้อจำกัดความปลอดภัยของเบราว์เซอร์ (Incognito?)', {
          description: 'เบราว์เซอร์บล็อกการเข้าถึงข้อมูลข้ามไซต์ มักเกิดขึ้นในโหมดไม่ระบุตัวตน กรุณาเปลี่ยนไปใช้การ "เข้าด้วยอีเมลและรหัสผ่าน" แทน หรืออนุญาตไฟล์คุกกี้บุคคลที่สาม'
        });
      } else if (error.code !== 'auth/cancelled-popup-request') {
        toast.error('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', { 
          description: error.message || 'กรุณาลองเข้าสู่ระบบในหน้าต่างใหม่' 
        });
      }
    }
  };

  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [lastCheckedEmail, setLastCheckedEmail] = useState('');

  // Auto-fill from manual profile when email is entered
  const handleEmailLookup = async (inputEmail: string) => {
    const cleanedEmail = inputEmail.toLowerCase().trim();
    if (!cleanedEmail || !cleanedEmail.includes('@') || cleanedEmail === lastCheckedEmail) return;

    setLastCheckedEmail(cleanedEmail);
    setIsEmailLoading(true);
    console.log("[Registration] Looking up manual profile for:", cleanedEmail);
    
    try {
      // 1. Try direct lookup by email (ID) first
      const manualDocRef = doc(db, 'users', cleanedEmail);
      const manualDocSnap = await getDoc(manualDocRef);
      
      let manualData: any = null;

      if (manualDocSnap.exists()) {
        const data = manualDocSnap.data();
        if (data.isManual === true || data.isManual === "true") {
          manualData = data;
          console.log("[Registration] Found manual profile via ID lookup:", cleanedEmail);
        }
      } 
      
      if (!manualData) {
        // 2. Fallback to query
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', cleanedEmail), limit(5));
        const querySnapshot = await getDocs(q);
        
        // Find the one marked as manual
        const found = querySnapshot.docs.find(d => {
          const dData = d.data();
          return dData.isManual === true || dData.isManual === "true";
        });

        if (found) {
          manualData = found.data();
          console.log("[Registration] Found manual profile via Query lookup:", cleanedEmail);
        }
      }

      if (manualData) {
        console.log("[Registration] Found manual profile data:", manualData);
        
        // Fill data - overwrite to provide visual confirmation that the profile was found
        if (manualData.name) setName(manualData.name);
        if (manualData.jobTitle) setJobTitle(manualData.jobTitle);
        if (manualData.role) setRole(manualData.role);
        
        // Map department and owner
        if (manualData.department) {
          setDepartment(manualData.department);
          console.log("[Registration] Auto-set department:", manualData.department);
        }
        
        if (manualData.ownerId) {
          setOwnerId(manualData.ownerId);
          console.log("[Registration] Auto-set ownerId:", manualData.ownerId);
        }

        toast.success(`พบข้อมูลของคุณในระบบแล้ว (${manualData.name})`, {
          description: 'ระบบเตรียมข้อมูลตำแหน่งและหน่วยงานให้คุณเรียบร้อยแล้ว'
        });
      } else {
        console.log("[Registration] No manual profile entry found for:", cleanedEmail);
      }
    } catch (error: any) {
      console.error("[Registration] Email lookup error:", error);
      // Don't toast error for lookup as it might be a normal new user
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Debounced email lookup
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (email && email.includes('@') && isRegistering) {
        handleEmailLookup(email);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [email, isRegistering]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Manual validation to avoid hidden browser tooltips in scrolled forms
    if (!name) return toast.error('กรุณากรอก ชื่อ-นามสกุล');
    if (!email) return toast.error('กรุณากรอก อีเมล');
    if (!password) return toast.error('กรุณากรอก รหัสผ่าน');
    if (!confirmPassword) return toast.error('กรุณายืนยันรหัสผ่าน');
    if (!jobTitle) return toast.error('กรุณากรอก ตำแหน่งงาน');
    if (!department) return toast.error('กรุณาเลือก หน่วยงาน / สำนัก');
    if (!ownerId) return toast.error('กรุณาเลือก ส่วนงาน');

    if (password !== confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    // Simplify password check for easier registration during testing
    if (password.length < 8) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    
    setIsSubmitting(true);
    console.log("Registration: Start", { email: email.trim().toLowerCase(), role, department });
    try {
      console.log("Starting registration for:", email);
      const userCredential = await registerWithEmail(email, password);
      console.log("Auth user created:", userCredential.user?.uid);
      
      // Prepare user data without null fields to avoid rules issues
      const userData: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department,
        ownerId,
        jobTitle: jobTitle.trim(),
        role,
        status: 'Inactive',
        lastActive: Timestamp.now(),
        provider: 'email',
        isManual: false
      };

      console.log("Saving user profile to Firestore...");
      await userService.createUser(userCredential.user.uid, userData);
      console.log("Firestore user profile saved successfully");
      
      toast.success('ลงทะเบียนสำเร็จ กรุณารอผู้ดูแลระบบอนุมัติการใช้งาน');
      setIsRegistering(false);
    } catch (error: any) {
      console.error("Registration Detailed Error:", error);
      let errorMessage = 'ไม่ทราบสาเหตุ';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'รหัสผ่านไม่ปลอดภัยพอ';
      } else if (error.message && error.message.includes('{')) {
        // This is likely our JSON error from handleFirestoreError
        try {
          const innerError = JSON.parse(error.message);
          errorMessage = `Firestore Error: ${innerError.error}`;
        } catch (e) {
          errorMessage = error.message;
        }
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      toast.error(`ลงทะเบียนไม่สำเร็จ: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-navy-base flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-64 -mt-64" />
        <div className="max-w-md w-full bg-navy-surface p-10 rounded-[3rem] border border-border-navy shadow-2xl relative z-10">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-black text-white">ลืมรหัสผ่าน?</h2>
            <p className="text-slate-400 text-sm">ระบุอีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน</p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">อีเมล</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
            </button>
            <button
              type="button"
              onClick={() => setIsForgotPassword(false)}
              className="w-full py-4 bg-transparent text-slate-500 font-bold hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> กลับหน้าเข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-base flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-64 -mt-64 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[120px] rounded-full -ml-64 -mb-64 animate-pulse" />
      
      <div className="max-w-[1000px] w-full grid md:grid-cols-2 bg-navy-surface rounded-[3rem] border border-border-navy shadow-2xl relative z-10 overflow-hidden">
        {/* Left Side: Illustration / Brand */}
        <div className="hidden md:flex flex-col justify-center p-12 bg-white/5 backdrop-blur-3xl relative border-r border-white/10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-400/15 via-white/10 to-indigo-500/5" />
          <div className="relative z-10 space-y-6">
            <div className="w-16 h-16 bg-white rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-white/10 transition-transform duration-500 hover:scale-105">
              <span className="text-blue-600 font-black text-xl tracking-tighter">STEP</span>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight whitespace-nowrap">
              สำนักงานสภาเกษตรกรแห่งชาติ
            </h1>
            <p className="text-white text-lg leading-relaxed font-semibold mb-12 drop-shadow-md">
              ระบบติดตามเชิงกลยุทธ์ และประเมินผลสัมฤทธิ์ (Strategic Tracking of Employment & Performance: STEP)
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111625]/80 backdrop-blur-2xl rounded-[2.8rem] p-8 border border-white/5 hover:border-orange-500/40 transition-all group relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                {/* Advanced Gantt Decoration - Circuit Style */}
                <div className="absolute top-4 right-4 w-40 h-32 opacity-40 pointer-events-none select-none">
                  <svg width="100%" height="100%" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="orange-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    
                    {/* Vertical Grid Lines */}
                    {[20, 40, 60, 80, 100, 120, 140].map(x => (
                      <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="white" strokeWidth="0.5" strokeOpacity="0.05" />
                    ))}
                    
                    {/* Circuit Path */}
                    <path d="M30 20 H60 V45 H90 V70 H120 V90" stroke="white" strokeWidth="1" strokeOpacity="0.1" strokeLinecap="round" />
                    
                    {/* Gantt Segments */}
                    <rect x="20" y="15" width="25" height="10" rx="5" fill="#f97316" fillOpacity="0.8" filter="url(#orange-glow)" />
                    <rect x="50" y="40" width="35" height="10" rx="5" fill="#ea580c" fillOpacity="0.8" />
                    <rect x="80" y="65" width="30" height="10" rx="5" fill="#f97316" fillOpacity="0.8" />
                    <rect x="110" y="85" width="40" height="10" rx="5" fill="#ea580c" fillOpacity="0.8" />

                    {/* Luminous Interaction Nodes */}
                    <circle cx="30" cy="20" r="3.5" fill="#fff" className="animate-pulse" filter="url(#orange-glow)" />
                    <circle cx="60" cy="45" r="3.5" fill="#fff" filter="url(#orange-glow)" />
                    <circle cx="90" cy="70" r="3" fill="#fb923c" fillOpacity="0.6" />
                  </svg>
                </div>

                <div className="relative z-10">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-6xl font-black text-white mb-1 tracking-tighter drop-shadow-[0_0_30px_rgba(251,146,60,0.5)] group-hover:scale-105 transition-transform duration-700 origin-left"
                  >
                    {stats.total}
                  </motion.div>
                  <div className="text-blue-100/50 text-[9px] uppercase font-black tracking-[0.25em] mb-8 drop-shadow-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    ปริมาณงานทั้งหมด
                  </div>
                  
                  {/* Digital Segmented Scale */}
                  <div className="flex gap-2.5 h-3">
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        className={cn(
                          "flex-1 rounded-sm transition-all duration-700 relative overflow-hidden",
                          stats.total > 0
                            ? "bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.6)]" 
                            : "bg-white/5"
                        )}
                      >
                         {/* Scan Highlight */}
                         <motion.div 
                           animate={{ x: ['-100%', '200%'] }}
                           transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                           className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                         />
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                {/* Edge Accent */}
                <div className="absolute top-0 left-0 w-full h-full border-t border-l border-white/10 rounded-[2.8rem] pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
              </div>

              <div className="bg-[#111625]/80 backdrop-blur-2xl rounded-[2.8rem] p-8 border border-white/5 hover:border-emerald-500/40 transition-all group relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
                {/* Advanced Gantt Decoration - Circuit Style */}
                <div className="absolute top-4 right-4 w-40 h-32 opacity-40 pointer-events-none select-none">
                  <svg width="100%" height="100%" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="green-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>
                    
                    {/* Circuit Path */}
                    <path d="M40 25 H80 V60 H120 V85" stroke="white" strokeWidth="1" strokeOpacity="0.1" strokeLinecap="round" />
                    
                    {/* Gantt Segments */}
                    <rect x="35" y="18" width="50" height="12" rx="6" fill="#10b981" fillOpacity="0.7" filter="url(#green-glow)" />
                    <rect x="75" y="52" width="40" height="12" rx="6" fill="#059669" fillOpacity="0.7" />
                    <rect x="115" y="78" width="30" height="12" rx="6" fill="#10b981" fillOpacity="0.7" />

                    {/* Nodes */}
                    <circle cx="40" cy="25" r="4" fill="#fff" className="animate-pulse" filter="url(#green-glow)" />
                    <circle cx="80" cy="60" r="4" fill="#34d399" />
                  </svg>
                </div>

                <div className="relative z-10">
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-6xl font-black text-white mb-1 tracking-tighter drop-shadow-[0_0_30px_rgba(52,211,153,0.5)] group-hover:scale-105 transition-transform duration-700 origin-left"
                  >
                    {stats.completed}
                  </motion.div>
                  <div className="text-blue-100/50 text-[9px] uppercase font-black tracking-[0.25em] mb-8 drop-shadow-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    งานที่เสร็จสิ้นแล้ว
                  </div>
                  
                  {/* Digital Segmented Scale */}
                  <div className="flex gap-2.5 h-3">
                    {[...Array(6)].map((_, i) => {
                      const progressRatio = stats.total > 0 ? (stats.completed / stats.total) : 0;
                      const activeSegments = Math.round(progressRatio * 6);
                      return (
                        <motion.div
                          key={i}
                          className={cn(
                            "flex-1 rounded-sm transition-all duration-700 relative overflow-hidden",
                            i < activeSegments 
                              ? "bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.6)]" 
                              : "bg-white/5"
                          )}
                        >
                           {/* Scan Highlight */}
                           <motion.div 
                             animate={{ x: ['-100%', '200%'] }}
                             transition={{ duration: 2.5, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
                             className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                           />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Edge Accent */}
                <div className="absolute top-0 left-0 w-full h-full border-t border-l border-white/10 rounded-[2.8rem] pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 md:p-12">
              {(browserInfo.isInApp || browserInfo.isEditor) && (
                <div className="mb-6 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-in fade-in slide-in-from-top duration-700">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-amber-500/20 rounded-xl shrink-0">
                        <Shield className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-amber-500 text-sm font-bold">⚠️ พบข้อจำกัดด้านความปลอดภัย</p>
                        <p className="text-amber-200/70 text-[11px] leading-relaxed">
                          คุณกำลังเปิดผ่านระบบแก้ไขโค้ดหรือแอป (LINE/FB) ซึ่ง <span className="text-amber-400 font-bold underline">บล็อกการเข้าด้วย Google</span> เพื่อความปลอดภัยของข้อมูล
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={copySharedUrl}
                        className="py-3 bg-navy-base border border-amber-500/30 text-amber-500 text-[11px] font-bold rounded-xl hover:bg-amber-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Copy className="w-3.5 h-3.5" /> คัดลอกลิงก์เข้าใช้จริง
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(window.location.origin, '_blank')}
                        className="py-3 bg-amber-500 text-navy-base text-[11px] font-black rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> เปิดในเบราว์เซอร์
                      </button>
                    </div>

                    <p className="text-[10px] text-amber-500/60 text-center italic">
                      * หลังกดเปิด/วางลิงก์ใน Chrome/Safari แล้ว จะใช้งานได้ตามปกติครับ
                    </p>
                  </div>
                </div>
              )}
          {!isRegistering ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">เข้าสู่ระบบ</h2>
                <p className="text-slate-400">กรุณาระบุข้อมูลเพื่อเข้าใช้งานระบบ</p>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => handleGoogleLogin()}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-white text-navy-base font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-all shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  เข้าสู่ระบบด้วย Google
                </button>
                
                <div className="flex items-center gap-4 text-slate-700 py-2">
                  <div className="h-px flex-1 bg-border-navy" />
                  <span className="text-xs font-bold uppercase tracking-widest">หรือใช้อีเมลส่วนงาน</span>
                  <div className="h-px flex-1 bg-border-navy" />
                </div>

                <form aria-autocomplete="none" autoComplete="off" onSubmit={handleLogin} className="space-y-4">
                  {/* Invisible fields to capture unwanted autofill */}
                  <div className="sr-only" aria-hidden="true" style={{ position: 'absolute', opacity: 0, height: 0, overflow: 'hidden' }}>
                    <input type="text" name={`user_${formId}`} tabIndex={-1} autoComplete="off" />
                    <input type="password" name={`pass_${formId}`} tabIndex={-1} autoComplete="off" />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">อีเมล</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="email"
                        name={`email_${formId}_auth`}
                        value={email}
                        autoComplete="new-password"
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">รหัสผ่าน</label>
                      <button 
                        type="button" 
                        onClick={() => setIsForgotPassword(true)}
                        className="text-xs font-bold text-blue-500 hover:text-blue-400"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="password"
                        name={`pwd_${formId}_auth`}
                        value={password}
                        autoComplete="new-password"
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-4 py-4 bg-navy-base border border-border-navy rounded-2xl text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LogIn className="w-5 h-5" /> เข้าสู่ระบบ</>}
                  </button>
                </form>

                <p className="text-center text-slate-400 text-sm pt-4">
                  ยังไม่มีบัญชีผู้ใช้งาน?{' '}
                  <button
                    onClick={() => setIsRegistering(true)}
                    className="text-blue-500 font-black hover:underline"
                  >
                    ลงทะเบียนเข้าใช้งาน
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white">ลงทะเบียน</h2>
                <p className="text-slate-400">สร้างบัญชีผู้ใช้งานใหม่เพื่อเริ่มติดตามงาน</p>
              </div>

              <div className="space-y-4">
                <form id="registerForm" onSubmit={handleRegister} noValidate className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-4 pb-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="พิชิต ชัยชนะ"
                          className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                          อีเมลงาน {isEmailLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onBlur={(e) => handleEmailLookup(e.target.value)}
                          placeholder="name@dpim.go.th"
                          className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">รหัสผ่าน</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ยืนยันรหัสผ่าน</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ตำแหน่งงาน</label>
                      <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="นักทรัพยากรบุคคลชำนาญการ"
                        className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">หน่วยงาน / สำนัก</label>
                        <select
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value="">เลือกหน่วยงาน...</option>
                          {departments && departments.length > 0 ? (
                            departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                          ) : (
                            <option value="สำนักบริหารกลาง">สำนักบริหารกลาง (ค่าเริ่มต้น)</option>
                          )}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ส่วนงาน</label>
                        <select
                          value={ownerId}
                          onChange={(e) => setOwnerId(e.target.value)}
                          className="w-full px-4 py-3 bg-navy-base border border-border-navy rounded-xl text-white focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value="">เลือกส่วนงาน...</option>
                          {taskOwners && taskOwners.length > 0 ? (
                            taskOwners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)
                          ) : (
                            <option value="default-owner">ส่วนสารสนเทศ (ค่าเริ่มต้น)</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">ระดับสิทธิ์ {role !== 'Staff' ? '(ได้รับสิทธิ์พิเศษ)' : '(เริ่มต้น)'}</label>
                      <div className="flex gap-2">
                        <div className="flex-1 p-3 bg-blue-600/20 border border-blue-600/30 rounded-xl text-blue-400 text-xs font-black flex items-center justify-center gap-2">
                          <Shield className="w-3 h-3" />
                          {getRoleDisplayName(role)}
                        </div>
                        <div className="flex-[2] text-[10px] text-slate-500 flex items-center leading-tight">
                          {role === 'Staff' 
                            ? 'สิทธิ์ระดับ "เจ้าหน้าที่" สำหรับเริ่มต้นการใช้งาน กรุณาติดต่อผู้ดูแลระบบหากต้องการเปลี่ยนระดับสิทธิ์'
                            : 'ระบบพบว่าคุณได้รับสิทธิ์ระดับสูงกว่าพนักงานทั่วไปตามที่ผู้ดูแลระบบกำหนดไว้ล่วงหน้า'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'สร้างบัญชีใหม่'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsRegistering(false)}
                      className="w-full py-3 mt-4 bg-transparent text-slate-500 font-bold hover:text-white transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" /> กลับหน้าเข้าสู่ระบบ
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
