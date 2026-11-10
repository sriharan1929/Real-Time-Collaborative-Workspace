import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Shield,
  Layers,
  Database,
} from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#2f3437] flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      <nav className="border-b border-[#e9e9e8] bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-[#1a1a1a]">
              Collaborative Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-[#5f6368] hover:text-[#1a1a1a] px-3.5 py-2 rounded-lg transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-[#2383e2] hover:bg-[#1d70c2] text-white px-4 py-2 rounded-lg shadow-xs transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center flex-1 flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-6 border border-blue-100">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-Time Collaborative Document Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#1a1a1a] max-w-3xl leading-[1.15]">
          A Notion-style workspace for modern, fast teams.
        </h1>

        <p className="mt-6 text-lg text-[#787774] max-w-2xl leading-relaxed">
          Create shared workspaces, organize hierarchical documents, and persist data
          reliably with PostgreSQL and Prisma.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            id="hero-register-btn"
            href="/register"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2383e2] hover:bg-[#1d70c2] text-white font-medium text-base shadow-sm hover:shadow-md transition cursor-pointer w-full sm:w-auto"
          >
            <span>Start Free Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            id="hero-login-btn"
            href="/login"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-[#d3d1cb] hover:bg-black/5 text-[#2f3437] font-medium text-base shadow-xs transition cursor-pointer w-full sm:w-auto"
          >
            <span>Log in to existing account</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 text-left w-full">
          <div className="bg-white border border-[#e9e9e8] rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#1a1a1a] mb-1">
              Workspaces & Pages
            </h3>
            <p className="text-sm text-[#787774] leading-relaxed">
              Organize notes, team projects, and documentation hierarchically with clean navigation.
            </p>
          </div>

          <div className="bg-white border border-[#e9e9e8] rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#1a1a1a] mb-1">
              PostgreSQL Persistence
            </h3>
            <p className="text-sm text-[#787774] leading-relaxed">
              Prisma-managed relational models for users, workspaces, memberships, and document pages.
            </p>
          </div>

          <div className="bg-white border border-[#e9e9e8] rounded-2xl p-6 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-[#1a1a1a] mb-1">
              Role-Based Access
            </h3>
            <p className="text-sm text-[#787774] leading-relaxed">
              Granular roles: Owner, Editor, Commenter, and Viewer with robust server authorization.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#e9e9e8] py-8 text-center text-xs text-[#9b9a97]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Real-Time Collaborative Workspace • Day 1 Foundation</span>
          <span>Next.js 16 • React 19 • PostgreSQL • Prisma</span>
        </div>
      </footer>
    </div>
  );
}
