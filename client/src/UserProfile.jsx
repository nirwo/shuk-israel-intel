import { useState, useEffect, useRef } from 'react';
import { signInWithGoogle, logOut } from './firebase';
import { LogOut, User, ChevronDown, Shield } from 'lucide-react';

export default function UserProfile({ user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Sign in failed:', err);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await logOut();
  };

  // Not logged in
  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        disabled={signingIn}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-white disabled:opacity-50"
      >
        {signingIn ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span className="hidden sm:inline">מתחבר...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="hidden sm:inline">התחבר עם Google</span>
            <span className="sm:hidden">התחבר</span>
          </>
        )}
      </button>
    );
  }

  // Logged in
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="w-7 h-7 rounded-full border border-white/20"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
        )}
        <span className="text-sm text-white font-medium hidden sm:block max-w-[120px] truncate">
          {user.displayName || user.email}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-textMuted transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>

      {menuOpen && (
        <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-2 w-72 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn" dir="rtl">
          {/* Profile Header */}
          <div className="p-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-12 h-12 rounded-full border-2 border-primary/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{user.displayName || 'משתמש'}</p>
                <p className="text-xs text-textMuted truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-textMuted">סטטוס חשבון</p>
                <p className="text-sm text-emerald-400 font-medium">מאומת ✓</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
              <User className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-textMuted">מזהה משתמש</p>
                <p className="text-xs text-white font-mono truncate" dir="ltr">{user.uid.slice(0, 16)}...</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2 border-t border-white/5">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              התנתק
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
