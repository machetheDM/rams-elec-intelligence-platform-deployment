"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/layout/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === "CredentialsSignin" ? "Invalid email or password." : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Logo className="h-12 w-auto mx-auto" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-white">
            Sign in to your portal
          </h1>
          <p className="mt-2 text-sm text-industrial-400">
            Access your equipment, service history, and compliance documents.
          </p>
        </div>

        {/* Login form */}
        <div className="bg-industrial-900 rounded-2xl border border-industrial-800 p-8">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-industrial-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-industrial-500"
                placeholder="you@company.co.za"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-industrial-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 rounded-xl border border-industrial-700 bg-industrial-800 text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-industrial-500"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full px-4 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-industrial-700 disabled:text-industrial-500 text-white text-sm font-semibold rounded-xl transition-all"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-industrial-800 text-center">
            <p className="text-xs text-industrial-500">
              Portal access is for Rams @Elec customers only.
              <br />
              Need an account? Call{" "}
              <a href="tel:+27711018493" className="text-brand-400 hover:text-brand-300">
                +27 71 101 8493
              </a>
            </p>
          </div>
        </div>

        {/* Back to main site */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-industrial-400 hover:text-white transition-colors">
            Back to main site
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
