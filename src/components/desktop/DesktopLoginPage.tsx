"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { Mail, Lock, Eye, EyeOff, User, Globe, ChevronDown, ArrowRight, ArrowLeft, Check, Trophy, Gift, Star, PartyPopper, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { COUNTRIES } from "@/utils/countries";

interface DesktopLoginPageProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialView?: 'login' | 'signup';
  showBack?: boolean;
}

const countries = COUNTRIES;
type SignupStep = 1 | 2 | 3 | 4 | 5;

export default function DesktopLoginPage({ onClose, onSuccess, initialView = 'login', showBack = true }: DesktopLoginPageProps) {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(initialView === 'login');
  const [showPassword, setShowPassword] = useState(false);
  
  // Sign-up wizard state
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  
  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    setIsLogin(initialView === 'login');
    setSignupStep(1);
    setError("");
  }, [initialView]);

  // Password strength
  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, text: "", color: "bg-gray-200", textColor: "text-gray-400" };
    if (password.length < 6) return { level: 1, text: "Weak password", color: "bg-red-500", textColor: "text-red-500" };
    if (password.length < 8) return { level: 2, text: "Medium password", color: "bg-yellow-500", textColor: "text-yellow-600" };
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 4, text: "Strong password", color: "bg-green-500", textColor: "text-green-600" };
    return { level: 3, text: "Good password", color: "bg-cyan-500", textColor: "text-cyan-600" };
  };
  const passwordStrength = getPasswordStrength();

  // Check username availability
  useEffect(() => {
    if (name.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(name)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [name]);

  // Check email availability
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (!email || !email.includes('@')) {
      setEmailAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        setEmailAvailable(data.available);
      } catch {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(email, password);
      if (result.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else if (result.needsVerification) {
        setError(""); // Clear any error
        setNeedsVerification(true);
        setVerificationEmail(result.email || email);
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle signup step navigation
  const nextStep = () => {
    setError("");
    if (signupStep === 1 && !country) {
      setError("Please select your country.");
      return;
    }
    if (signupStep === 2 && (!email || !email.includes('@'))) {
      setError("Please enter a valid email.");
      return;
    }
    if (signupStep === 2 && emailAvailable === false) {
      setError("This email is already registered. Please log in.");
      return;
    }
    if (signupStep === 3 && (name.length < 3 || usernameAvailable === false)) {
      setError("Please choose an available username (min 3 characters).");
      return;
    }
    if (signupStep === 4 && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (signupStep < 5) {
      setSignupStep((signupStep + 1) as SignupStep);
    }
  };

  const prevStep = () => {
    setError("");
    if (signupStep > 1) {
      setSignupStep((signupStep - 1) as SignupStep);
    } else {
      setIsLogin(true);
    }
  };

  // Handle final signup
  const handleSignup = async () => {
    if (!agreeTerms) {
      setError("Please agree to the Terms of Service.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const selectedCountry = countries.find(c => c.code === country);
      const result = await register(name, email, password, selectedCountry?.name, selectedCountry?.flag);
      if (result.success) {
        setVerificationEmail(email);
        setShowVerificationModal(true);
      } else {
        setError(result.error || "Registration failed. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Verification email sent!");
      } else {
        setError(data.error || "Failed to send email.");
      }
    } catch {
      setError("Failed to send email.");
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/desktop' });
    } catch {
      setError('Failed to sign in with Google');
      setLoading(false);
    }
  };

  const selectedCountry = countries.find(c => c.code === country);

  // Progress dots for signup wizard
  const ProgressDots = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3, 4, 5].map((step) => (
        <div
          key={step}
          className={`w-3 h-3 rounded-full transition-all ${
            step < signupStep ? 'bg-[#D4873A]' : 
            step === signupStep ? 'bg-[#D4873A] ring-4 ring-[#D4873A]/20' : 
            'bg-gray-300'
          }`}
        />
      ))}
    </div>
  );

  // ============ LOGIN VIEW ============
  if (isLogin) {
    return (
      <div className="h-full flex flex-col bg-cream">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm">
          <img src="/images/genxlogo1.png" alt="BOGX" className="h-8" />
          {showBack && (
            <button onClick={onClose} className="flex items-center gap-1 text-gray-600 text-sm hover:text-[#D4873A] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-10 flex flex-col items-center justify-center">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h1 className="font-display text-4xl text-gray-900 mb-2">Welcome back!</h1>
              <p className="text-gray-500">Sign in to continue your journey.</p>
            </div>

            {error && !needsVerification && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                {error}
              </div>
            )}

            {needsVerification && (
              <div className="mb-6 p-4 bg-[#D4873A]/10 border border-[#D4873A]/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#D4873A] mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Email Verification Required</h3>
                    <p className="text-gray-600 text-xs mt-1">We sent a verification link to <strong>{verificationEmail}</strong></p>
                    <p className="text-gray-500 text-xs mt-1">Check your inbox (and spam folder) to verify your account.</p>
                    <button onClick={handleResendVerification} disabled={resendingEmail} className="mt-2 text-[#D4873A] text-xs font-semibold hover:underline">
                      {resendingEmail ? "Sending..." : "Didn't receive it? Resend email"}
                    </button>
                    {successMessage && <p className="text-green-600 text-xs mt-1">{successMessage}</p>}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none transition-colors"
                  placeholder="Your password"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#D4873A] rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:bg-[#C4772A] transition-all disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign In"} <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-warm"></div></div>
              <div className="relative flex justify-center"><span className="px-4 bg-cream text-gray-500 text-sm">or</span></div>
            </div>

            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white border border-warm rounded-xl hover:bg-gray-50 transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-medium text-gray-700">Continue with Google</span>
            </button>

            <p className="text-center mt-8 text-gray-500">
              Don't have an account?{" "}
              <button onClick={() => { setIsLogin(false); setSignupStep(1); }} className="text-[#D4873A] font-bold hover:underline">
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============ SIGNUP WIZARD ============
  return (
    <div className="h-full flex flex-col bg-cream">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-warm">
        <img src="/images/genxlogo1.png" alt="BOGX" className="h-8" />
        <span className="text-sm text-gray-500">Step <span className="text-[#D4873A] font-bold">{signupStep}</span> of 5</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-10 flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <ProgressDots />

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          {/* Step 1: Country */}
          {signupStep === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <Globe className="w-10 h-10 text-[#D4873A]" />
              </div>
              <h1 className="font-display text-3xl text-gray-900 mb-2">Where are you from?</h1>
              <p className="text-gray-500 mb-10">Help us show you the right content and challenges.</p>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="w-full flex items-center justify-between px-5 py-4 bg-white border border-warm rounded-xl text-left hover:border-[#D4873A]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    {selectedCountry ? (
                      <span className="flex items-center gap-2 text-gray-900">
                        <img src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} alt="" className="w-6 h-4 object-cover rounded" />
                        {selectedCountry.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">Select your country</span>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showCountryDropdown && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-warm rounded-xl overflow-hidden z-20 max-h-60 overflow-y-auto shadow-xl">
                    {countries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { setCountry(c.code); setShowCountryDropdown(false); }}
                        className="w-full px-5 py-3 text-left text-gray-900 hover:bg-[#D4873A]/10 flex items-center gap-3 transition-colors"
                      >
                        <img src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`} alt="" className="w-6 h-4 object-cover rounded" />
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Email */}
          {signupStep === 2 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <Mail className="w-10 h-10 text-[#D4873A]" />
              </div>
              <h1 className="font-display text-3xl text-gray-900 mb-2">What's your email?</h1>
              <p className="text-gray-500 mb-10">We'll use it to keep you posted on your rankings and rewards.</p>

              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 bg-white border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>
          )}

          {/* Step 3: Username */}
          {signupStep === 3 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <User className="w-10 h-10 text-[#D4873A]" />
              </div>
              <h1 className="font-display text-3xl text-gray-900 mb-2">Pick your GenX username</h1>
              <p className="text-gray-500 mb-10">This is how other players will know you.</p>

              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-14 pr-5 py-4 bg-white border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none transition-colors"
                  placeholder="Bacon77"
                />
              </div>
              {name.length >= 3 && (
                <div className={`flex items-center justify-center gap-2 mt-4 text-sm ${usernameAvailable ? 'text-green-600' : usernameAvailable === false ? 'text-red-500' : 'text-gray-400'}`}>
                  {checkingUsername ? (
                    <span>Checking...</span>
                  ) : usernameAvailable ? (
                    <><Check className="w-4 h-4" /> {name} is available</>
                  ) : usernameAvailable === false ? (
                    <span>Username is taken</span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Password */}
          {signupStep === 4 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <Lock className="w-10 h-10 text-[#D4873A]" />
              </div>
              <h1 className="font-display text-3xl text-gray-900 mb-2">Create your password</h1>
              <p className="text-gray-500 mb-10">Make it strong. Make it you.</p>

              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-14 py-4 bg-white border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:border-[#D4873A] outline-none transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {password.length > 0 && (
                <>
                  <div className="flex gap-1.5 mt-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`flex-1 h-2 rounded-full transition-all ${i <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className={`text-sm mt-2 ${passwordStrength.textColor}`}>{passwordStrength.text}</p>
                </>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {signupStep === 5 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <PartyPopper className="w-10 h-10 text-[#D4873A]" />
              </div>
              <h1 className="font-display text-3xl text-gray-900 mb-2">You're almost in!</h1>
              <p className="text-gray-500 mb-8">One last step and you're ready to join the challenge.</p>

              <div className="bg-white border border-warm rounded-xl p-5 mb-8 text-left space-y-4">
                <div className="flex items-center gap-4">
                  <Trophy className="w-6 h-6 text-[#D4873A]" />
                  <span className="text-gray-700">Vote on your favorites</span>
                </div>
                <div className="flex items-center gap-4">
                  <Star className="w-6 h-6 text-[#D4873A]" />
                  <span className="text-gray-700">Climb the rankings</span>
                </div>
                <div className="flex items-center gap-4">
                  <Gift className="w-6 h-6 text-[#D4873A]" />
                  <span className="text-gray-700">Win epic prizes</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAgreeTerms(!agreeTerms)}
                className="flex items-start gap-4 text-left w-full"
              >
                <div className={`w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${agreeTerms ? 'bg-[#D4873A] border-[#D4873A]' : 'border-gray-300'}`}>
                  {agreeTerms && <Check className="w-4 h-4 text-white" />}
                </div>
                <p className="text-sm text-gray-600">
                  I agree to the <span className="text-[#D4873A]">Terms of Service</span> and <span className="text-[#D4873A]">Privacy Policy</span>
                </p>
              </button>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-10">
            {signupStep < 5 ? (
              <button
                onClick={nextStep}
                className="w-full py-4 bg-[#D4873A] rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:bg-[#C4772A] transition-all"
              >
                Continue <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSignup}
                disabled={loading || !agreeTerms}
                className="w-full py-4 bg-[#D4873A] rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:bg-[#C4772A] transition-all disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create My Account"} <ArrowRight className="w-5 h-5" />
              </button>
            )}

            <button onClick={prevStep} className="w-full py-3 text-gray-500 text-sm flex items-center justify-center gap-1 mt-3 hover:text-[#D4873A] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            {signupStep === 1 && (
              <p className="text-center mt-6 text-gray-500">
                Already have an account?{" "}
                <button onClick={() => setIsLogin(true)} className="text-[#D4873A] font-bold hover:underline">Log in</button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Footer */}
      <div className="px-8 py-4 bg-[#F5F0E8] border-t border-warm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-gray-400" />
          <div>
            <p className="text-xs font-semibold text-gray-700">Your data is safe with us.</p>
            <p className="text-[10px] text-gray-500">We'll never share your information with third parties.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-700">Privacy First</p>
          <p className="text-[10px] text-gray-500">Always.</p>
        </div>
      </div>

      {/* Email Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-cream rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
              <Mail className="w-12 h-12 text-[#D4873A]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Check Your Email!</h2>
            <p className="text-gray-600 mb-4">We sent a verification link to:</p>
            <p className="font-semibold text-[#D4873A] text-lg mb-8 break-all">{verificationEmail}</p>
            <div className="bg-[#D4873A]/5 rounded-xl p-5 mb-8">
              <p className="text-gray-600">Click the link in the email to activate your account.</p>
            </div>
            <button onClick={handleResendVerification} disabled={resendingEmail} className="text-[#D4873A] font-semibold mb-6">
              {resendingEmail ? "Sending..." : "Didn't receive it? Resend email"}
            </button>
            {successMessage && <p className="text-green-600 mb-4">{successMessage}</p>}
            <button
              onClick={() => { setShowVerificationModal(false); setIsLogin(true); }}
              className="w-full py-4 bg-[#D4873A] hover:bg-[#c06a2a] text-white font-bold rounded-xl transition-colors"
            >
              Got it, I'll check my email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
