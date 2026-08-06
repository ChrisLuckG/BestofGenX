"use client";

import { useState } from "react";
import { Mail, Check, ChevronLeft } from "lucide-react";
import Image from "next/image";
import GenXLoader from "@/components/GenXLoader";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Failed to send reset email");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-500 mb-6">
            If an account exists for <strong>{email}</strong>, we've sent a password reset link.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            The link will expire in 1 hour. Check your spam folder if you don't see it.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-[#E36B11] hover:bg-[#C4772A] text-white font-semibold rounded-xl transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/images/genxlogo.png" alt="Best of GenX" width={80} height={80} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Forgot Password?</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-cream border border-warm rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-xl">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-11 pr-4 py-3 bg-white border border-warm rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#E36B11]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#E36B11] hover:bg-[#C4772A] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <GenXLoader size="sm" /> : "Send Reset Link"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <a href="/" className="text-[#E36B11] font-semibold hover:underline inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            Back to Login
          </a>
        </p>
      </div>
    </div>
  );
}
