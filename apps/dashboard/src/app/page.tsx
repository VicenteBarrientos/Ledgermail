"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Mail,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Coins,
  Clock,
  Database,
  Play,
  Server,
  Settings,
  Info,
  BarChart3,
  Search,
  Inbox,
  Link2,
  X,
  Copy,
  Check,
  Zap,
  Shield,
  Activity,
  ChevronRight,
} from "lucide-react";
import { ChatWidget } from "../components/chatbot/chat-widget";
// Datos de muestra cuando la API no esta disponible.
const MOCK_TRANSACTIONS = [
  {
    id: "txn_1",
    bank: "Banco de Chile",
    amount: 150000,
    currency: "CLP",
    senderName: "JUAN PEREZ GONZALEZ",
    senderAccount: "1234567890",
    receiverAccount: "9876543210",
    reference: "987654321",
    description: "Pago de arriendo julio",
    confidence: 1.0,
    createdAt: new Date().toISOString(),
    email: {
      subject: "Aviso de Transferencia Recibida",
      receivedAt: new Date(Date.now() - 3600000).toISOString(),
      status: "PARSED",
      errorMessage: null,
      cleanedHtml:
        "<table><tr><td>Banco de Chile</td></tr><tr><td>Remitente: JUAN PEREZ GONZALEZ</td></tr><tr><td>Monto: $150.000</td></tr><tr><td>Folio: 987654321</td></tr></table>",
    },
    attempts: [
      {
        id: "att_1",
        llmProvider: "openai",
        modelName: "gpt-4o-mini",
        promptVersion: "banco-chile/v1",
        promptTokens: 320,
        completionTokens: 85,
        costInUSD: 0.000099,
        latencyInMs: 820,
        amountValid: true,
        dateValid: true,
        senderNameValid: true,
        senderAccountValid: true,
        receiverAccountValid: true,
        referenceValid: true,
        success: true,
        validationErrors: null,
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "txn_2",
    bank: "Banco de Chile",
    amount: 45000,
    currency: "CLP",
    senderName: "MARIA CONTRERAS DIAZ",
    senderAccount: null,
    receiverAccount: "9876543210",
    reference: null,
    description: "Abono cuota asado",
    confidence: 0.75,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    email: {
      subject: "Felicidades! Recibiste un abono",
      receivedAt: new Date(Date.now() - 7200000).toISOString(),
      status: "NEEDS_REVIEW",
      errorMessage:
        "Monto y remitente verificados, pero faltan referencia y cuenta origen",
      cleanedHtml:
        "<div>Recibiste abono de Maria Contreras por $45.000 para cuota asado.</div>",
    },
    attempts: [
      {
        id: "att_2",
        llmProvider: "gemini",
        modelName: "gemini-1.5-flash",
        promptVersion: "banco-chile/v1",
        promptTokens: 290,
        completionTokens: 60,
        costInUSD: 0.000045,
        latencyInMs: 910,
        amountValid: true,
        dateValid: true,
        senderNameValid: true,
        senderAccountValid: false,
        receiverAccountValid: true,
        referenceValid: false,
        success: false,
        validationErrors: "cuenta origen y referencia no aparecen en el texto",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
  },
];

const BENCHMARKS = [
  { label: "Monto", value: 100.0 },
  { label: "Fecha", value: 100.0 },
  { label: "Remitente", value: 98.5 },
  { label: "Cta. origen", value: 76.0 },
  { label: "Cta. destino", value: 96.8 },
  { label: "Referencia", value: 92.0 },
];

type Toast = { type: "success" | "error" | "info"; message: string } | null;
type Tab = "fields" | "json" | "html" | "attempts" | "replay";

// Prefer same-origin proxy (see next.config.js rewrites → port 3002).
// Set NEXT_PUBLIC_API_URL only if you must call the API on another host.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/ledger-api";

function statusBadgeClass(status: string) {
  if (status === "PARSED") return "badge badge-success";
  if (status === "NEEDS_REVIEW") return "badge badge-warning";
  return "badge badge-danger";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "PARSED") return <CheckCircle className="w-3 h-3" />;
  if (status === "NEEDS_REVIEW") return <AlertTriangle className="w-3 h-3" />;
  return <XCircle className="w-3 h-3" />;
}

function statusLabel(status: string) {
  if (status === "PARSED") return "Analizado";
  if (status === "NEEDS_REVIEW") return "Revisar";
  if (status === "FAILED") return "Fallido";
  return status.replace("_", " ");
}

function formatCurrency(amount: number | null | undefined, currency = "CLP") {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("es-CL")} ${currency}`;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "recién";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function confidenceColor(c: number) {
  if (c >= 0.9) return "text-emerald-700";
  if (c >= 0.7) return "text-amber-700";
  return "text-red-700";
}

function confidenceBarColor(c: number) {
  if (c >= 0.9) return "bg-emerald-400";
  if (c >= 0.7) return "bg-amber-400";
  return "bg-red-400";
}

function benchmarkColor(v: number) {
  if (v >= 95) return "bg-emerald-400";
  if (v >= 85) return "bg-teal-400";
  if (v >= 70) return "bg-amber-400";
  return "bg-red-400";
}

function benchmarkTextColor(v: number) {
  if (v >= 95) return "text-emerald-700";
  if (v >= 85) return "text-teal-700";
  if (v >= 70) return "text-amber-700";
  return "text-red-700";
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<any[]>(MOCK_TRANSACTIONS);
  const [selectedTxn, setSelectedTxn] = useState<any>(MOCK_TRANSACTIONS[0]);
  const [activeTab, setActiveTab] = useState<Tab>("fields");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [replayModel, setReplayModel] = useState("gpt-4o-mini");
  const [replayProvider, setReplayProvider] = useState("openai");
  const [apiOnline, setApiOnline] = useState(false);
  const [mailboxSources, setMailboxSources] = useState<any[]>([]);
  const [showTestParser, setShowTestParser] = useState(false);
  const [testFrom, setTestFrom] = useState("bancochile-informa@bancochile.cl");
  const [testSubject, setTestSubject] = useState(
    "Aviso de transferencia de fondos"
  );
  const [testBodyHtml, setTestBodyHtml] = useState("");
  const [isParsingTest, setIsParsingTest] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [copied, setCopied] = useState(false);

  const showToast = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      setToast({ type, message });
      window.setTimeout(() => setToast(null), 5200);
    },
    []
  );

  const stats = useMemo(() => {
    const total = transactions.length;
    const parsed = transactions.filter(
      (t) => t.email?.status === "PARSED"
    ).length;
    const needsReview = transactions.filter(
      (t) => t.email?.status === "NEEDS_REVIEW"
    ).length;
    const failed = transactions.filter(
      (t) => t.email?.status === "FAILED"
    ).length;
    const successRate =
      total > 0 ? ((parsed / total) * 100).toFixed(1) : "0.0";

    let totalCosto = 0;
    let totalLatencia = 0;
    let attemptCount = 0;
    for (const t of transactions) {
      for (const a of t.attempts || []) {
        totalCosto += a.costInUSD || 0;
        totalLatencia += a.latencyInMs || 0;
        attemptCount += 1;
      }
    }
    const avgLatencia =
      attemptCount > 0 ? Math.round(totalLatencia / attemptCount) : 0;

    return {
      total,
      parsed,
      needsReview,
      failed,
      successRate,
      totalCosto,
      avgLatencia,
    };
  }, [transactions]);

  useEffect(() => {
    fetchPagos();
    fetchMailboxes();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state") || "gmail";
      if (code) {
        if (state === "outlook") {
          connectOAuthProvider("outlook", code);
        } else {
          connectOAuthProvider("gmail", code);
        }
      }
    }
  }, []);

  const fetchMailboxes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mailboxes`);
      if (res.ok) {
        const data = await res.json();
        setMailboxSources(data);
      }
    } catch (err) {
      console.error("No se pudieron cargar las casillas:", err);
    }
  };

  const connectOAuthProvider = async (
    provider: "gmail" | "outlook",
    code: string
  ) => {
    setIsLoading(true);
    const endpoint =
      provider === "outlook" ? "/api/outlook/connect" : "/api/gmail/connect";
    const label = provider === "outlook" ? "Outlook / Hotmail" : "Gmail";
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name:
            provider === "outlook"
              ? "Outlook / Hotmail"
              : "Gmail personal (bridge)",
        }),
      });
      if (res.ok) {
        showToast("success", `Cuenta de ${label} conectada correctamente.`);
        const cleanUrl =
          window.location.protocol +
          "//" +
          window.location.host +
          window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
        fetchMailboxes();
        fetchPagos();
      } else {
        const error = await res.json();
        showToast("error", `No se pudo conectar ${label}: ${error.error}`);
      }
    } catch (err: any) {
      showToast("error", `Error al conectar ${label}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startOAuth = async (provider: "gmail" | "outlook") => {
    try {
      const path =
        provider === "outlook"
          ? "/api/outlook/auth-url"
          : "/api/gmail/auth-url";
      const res = await fetch(`${API_BASE}${path}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        const error = await res.json().catch(() => ({}));
        showToast(
          "error",
          error.error ||
            (provider === "outlook"
              ? "No se pudo obtener la URL de Microsoft. Configura OUTLOOK_CLIENT_ID/SECRET."
              : "No se pudo obtener la URL de autorizacion de Google.")
        );
      }
    } catch (err: any) {
      showToast(
        "error",
        `No se pudo conectar con la API de LedgerMail: ${err.message}`
      );
    }
  };

  const handleRegisterSource = async () => startOAuth("gmail");
  const handleRegisterOutlook = async () => startOAuth("outlook");

  const handleParseTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mailboxSources.length === 0) {
      showToast(
        "error",
        "Conecta primero una casilla para tener un ID de propietario para esta prueba."
      );
      return;
    }
    if (!testBodyHtml) {
      showToast("error", "Pega primero HTML o texto del correo.");
      return;
    }

    setIsParsingTest(true);
    try {
      const res = await fetch(`${API_BASE}/api/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: testFrom,
          subject: testSubject,
          bodyHtml: testBodyHtml,
          mailboxSourceId: mailboxSources[0].id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("success", "Correo analizado correctamente. Actualizando lista…");
        setShowTestParser(false);
        setTestBodyHtml("");
        fetchPagos();
      } else {
        showToast(
          "error",
          `Falló el análisis: ${data.error || "Error de validación"}`
        );
      }
    } catch (err: any) {
      showToast("error", `Error de red al llamar al parser: ${err.message}`);
    } finally {
      setIsParsingTest(false);
    }
  };

  const fetchPagos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/payments`);
      if (res.ok) {
        const payload = await res.json();
        if (payload.data && payload.data.length > 0) {
          setTransactions(payload.data);
          setSelectedTxn(payload.data[0]);
        }
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }
    } catch (err) {
      console.error("API fuera de línea; mostrando el panel en modo demo.", err);
      setApiOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncInbox = async () => {
    if (mailboxSources.length === 0) {
      showToast(
        "error",
        "No hay casillas activas. Conecta Gmail primero."
      );
      return;
    }

    const mailboxId = mailboxSources[0].id;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/gmail/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxSourceId: mailboxId, maxResults: 10 }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(
          "success",
          `Sincronización lista: ${result.summary.synced} sincronizados, ${result.summary.parsedSuccessfully} analizados, ${result.summary.needsReview} requieren revisión.`
        );
        fetchPagos();
      } else {
        showToast(
          "error",
          "Falló la sincronización de Gmail. Revisa la configuración de la casilla."
        );
      }
    } catch {
      showToast(
        "error",
        "No se pudo alcanzar la API. Ejecutando en modo demo."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerReprocesar = async () => {
    if (!selectedTxn) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reparse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: selectedTxn.emailId || selectedTxn.id,
          llmProvider: replayProvider,
          modelName: replayModel,
        }),
      });
      if (res.ok) {
        showToast("success", "Reproceso completado. Actualizando detalles del pago…");
        fetchPagos();
      } else {
        showToast("error", "No se pudo iniciar el reproceso.");
      }
    } catch {
      showToast(
        "info",
        "API fuera de línea: reproceso simulado. Conecta la API para reprocesar en vivo."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyJson = async () => {
    if (!selectedTxn) return;
    const payload = {
      id: selectedTxn.id,
      bank: selectedTxn.bank,
      amount: selectedTxn.amount,
      currency: selectedTxn.currency,
      senderName: selectedTxn.senderName,
      senderAccount: selectedTxn.senderAccount,
      receiverAccount: selectedTxn.receiverAccount,
      reference: selectedTxn.reference,
      description: selectedTxn.description,
      confidence: selectedTxn.confidence,
      status: selectedTxn.email?.status,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("error", "No se pudo copiar al portapapeles.");
    }
  };

  const filteredTransactions = transactions.filter((txn) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      txn.senderName?.toLowerCase().includes(q) ||
      txn.amount?.toString().includes(search) ||
      txn.bank?.toLowerCase().includes(q) ||
      txn.reference?.toLowerCase().includes(q) ||
      txn.email?.subject?.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "ALL" || txn.email?.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const fieldRows = selectedTxn
    ? [
        { label: "Banco", value: selectedTxn.bank },
        {
          label: "Monto",
          value: formatCurrency(selectedTxn.amount, selectedTxn.currency),
        },
        { label: "Remitente", value: selectedTxn.senderName || "—" },
        { label: "Cuenta origen", value: selectedTxn.senderAccount || "—" },
        {
          label: "Cuenta destino",
          value: selectedTxn.receiverAccount || "—",
        },
        { label: "Referencia", value: selectedTxn.reference || "—" },
        { label: "Descripción", value: selectedTxn.description || "—" },
        {
          label: "Confianza",
          value: `${((selectedTxn.confidence ?? 0) * 100).toFixed(0)}%`,
        },
      ]
    : [];

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-xl">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-12 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#236b5f] text-white flex items-center justify-center shadow-sm shrink-0">
              <Mail className="w-4 h-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-950 truncate">
                  LedgerMail
                </h1>
                <span className="badge badge-info hidden sm:inline-flex">
                  MVP · Banco de Chile
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Consola de lectura de notificaciones bancarias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                apiOnline
                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 border-amber-500/20"
              }`}
            >
              <span className={apiOnline ? "dot-live" : "dot-offline"} />
              <Server className="w-3.5 h-3.5" />
              {apiOnline ? "API conectada" : "Modo demo"}
            </div>

            <button
              onClick={() => setShowTestParser((v) => !v)}
              className={`btn btn-secondary ${
                showTestParser ? "border-teal-700/40 text-teal-700" : ""
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {showTestParser ? "Ocultar parser" : "Probar parser"}
              </span>
              <span className="sm:hidden">Test</span>
            </button>

            <button
              onClick={fetchPagos}
              disabled={isLoading}
              className="btn btn-ghost"
              title="Actualizar pagos"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>

            <button
              onClick={handleSyncInbox}
              disabled={isSyncing}
              className="btn btn-primary"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Sincronizando…" : "Sincronizar bandeja"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-12 py-7 flex flex-col gap-6">
        {/* Toast */}
        {toast && (
          <div
            className={`toast toast-${toast.type} flex items-start justify-between gap-3`}
            role="status"
          >
            <div className="flex items-start gap-2.5">
              {toast.type === "success" && (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {toast.type === "error" && (
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {toast.type === "info" && (
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="opacity-70 hover:opacity-100 p-0.5"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Probar parser panel */}
        {showTestParser && (
          <section className="glass-card p-6 rounded-lg border border-teal-400/24 bg-teal-400/[0.04] animate-slideDown">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950 flex items-center gap-2">
                  <Zap className="text-teal-700 w-4 h-4" />
                  Parser manual de correos
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Pega una notificación bancaria para ejecutar el flujo completo
                  sin sincronizar Gmail.
                </p>
              </div>
              <button
                onClick={() => setShowTestParser(false)}
                className="btn btn-ghost p-2"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={handleParseTestEmail}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="field-label">Remitente</label>
                <input
                  type="text"
                  value={testFrom}
                  onChange={(e) => setTestFrom(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="field-label">Asunto del correo</label>
                <input
                  type="text"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="field-label">
                  Cuerpo del correo (HTML o texto)
                </label>
                <textarea
                  value={testBodyHtml}
                  onChange={(e) => setTestBodyHtml(e.target.value)}
                  placeholder="Pega el HTML o texto de una notificación bancaria…"
                  rows={6}
                  className="input-field font-mono"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowTestParser(false)}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isParsingTest}
                  className="btn btn-primary"
                >
                  {isParsingTest ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Analizando…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Analizar correo
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Procesados",
              value: stats.total,
              sub: `${stats.parsed} analizados · ${stats.needsReview} por revisar`,
              icon: Inbox,
              iconClass: "bg-teal-500/15 text-teal-700",
            },
            {
              label: "Precisión",
              value: `${stats.successRate}%`,
              sub: stats.failed ? `${stats.failed} fallidos` : "Todo correcto",
              icon: Shield,
              iconClass: "bg-emerald-500/15 text-emerald-700",
            },
            {
              label: "Costo LLM",
              value: `$${stats.totalCosto.toFixed(5)}`,
              sub: "Gasto acumulado de análisis",
              icon: Coins,
              iconClass: "bg-cyan-500/12 text-cyan-700",
            },
            {
              label: "Latencia prom.",
              value: stats.avgLatencia ? `${stats.avgLatencia} ms` : "—",
              sub: "En todos los intentos",
              icon: Activity,
              iconClass: "bg-sky-500/15 text-sky-700",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="glass-card glass-card-hover p-5 sm:p-6 rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-slate-500 uppercase">
                    {m.label}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mt-1 tabular-nums">
                    {m.value}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                    {m.sub}
                  </p>
                </div>
                <div className={`p-2.5 rounded-lg shrink-0 ${m.iconClass}`}>
                  <m.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Sources + benchmarks */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="glass-card p-6 rounded-lg flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-semibold text-slate-950">
                  Casillas conectadas
                </h2>
              </div>
              <span className="badge badge-neutral">
                {mailboxSources.length}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-0.5">
              {mailboxSources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white px-5 py-9 text-center">
                  <Link2 className="w-7 h-7 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    No hay casillas conectadas.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Conecta Gmail u Outlook/Hotmail para clientes y bancos.
                  </p>
                </div>
              ) : (
                mailboxSources.map((source) => (
                  <div
                    key={source.id}
                    className="p-4 rounded-lg bg-white border border-[var(--border)] flex justify-between items-start gap-3"
                  >
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-slate-900 truncate">
                        {source.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {source.emailAddress}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        <span className="badge badge-success">Activa</span>
                        <span className="badge badge-neutral">
                          {source.type === "GMAIL_OAUTH"
                            ? "Gmail OAuth"
                            : source.type === "OUTLOOK_OAUTH"
                              ? "Outlook OAuth"
                              : source.type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleRegisterSource}
                className="btn btn-secondary w-full"
                disabled={isLoading}
              >
                <Link2 className="w-3.5 h-3.5" />
                Conectar Gmail
              </button>
              <button
                onClick={handleRegisterOutlook}
                className="btn btn-secondary w-full"
                disabled={isLoading}
              >
                <Link2 className="w-3.5 h-3.5" />
                Conectar Outlook / Hotmail
              </button>
            </div>
          </div>

          <div className="glass-card p-6 rounded-lg lg:col-span-2 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-semibold text-slate-950">
                  Precisión por campo
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                Banco de Chile · pruebas internas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {BENCHMARKS.map((b) => (
                <div
                  key={b.label}
                  className="p-4 rounded-lg bg-white border border-[var(--border)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">
                      {b.label}
                    </span>
                    <span
                      className={`text-sm font-bold tabular-nums ${benchmarkTextColor(
                        b.value
                      )}`}
                    >
                      {b.value.toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${benchmarkColor(b.value)}`}
                      style={{ width: `${b.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Main split */}
        <main className="grid grid-cols-1 xl:grid-cols-5 gap-5 min-h-[560px]">
          {/* List */}
          <section className="xl:col-span-2 glass-card rounded-lg flex flex-col overflow-hidden max-h-[720px]">
            <div className="p-5 border-b border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-950 flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-teal-700" />
                  Pagos
                </h2>
                <span className="badge badge-neutral">
                  {filteredTransactions.length}
                  {filteredTransactions.length !== transactions.length
                    ? ` / ${transactions.length}`
                    : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar remitente, banco o monto…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field pl-9"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-field w-auto min-w-[7.5rem]"
                >
                  <option value="ALL">Todos</option>
                  <option value="PARSED">Analizados</option>
                  <option value="NEEDS_REVIEW">Revisar</option>
                  <option value="FAILED">Fallidos</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {isLoading && transactions.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-[88px] w-full" />
                ))
              ) : filteredTransactions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-14 text-center px-6">
                  <Search className="w-8 h-8 text-slate-400 mb-3" />
                  <p className="text-sm text-slate-500">No hay pagos coincidentes</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Prueba otra búsqueda o limpia el filtro.
                  </p>
                </div>
              ) : (
                filteredTransactions.map((txn) => {
                  const isSelected = selectedTxn?.id === txn.id;
                  const status = txn.email?.status || "PARSED";
                  const conf = txn.confidence ?? 0;
                  return (
                    <button
                      key={txn.id}
                      type="button"
                      onClick={() => {
                        setSelectedTxn(txn);
                        setActiveTab("fields");
                      }}
                      className={`txn-item text-left w-full ${
                        isSelected ? "txn-item-selected" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase truncate">
                          {txn.bank}
                        </span>
                        <span className={statusBadgeClass(status)}>
                          <StatusIcon status={status} />
                          {statusLabel(status)}
                        </span>
                      </div>

                      <div className="flex justify-between items-end gap-3 mt-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {txn.senderName || "Remitente desconocido"}
                          </h4>
                          <span className="text-[11px] text-slate-500">
                            {formatRelativeTime(txn.createdAt)}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-slate-950 tabular-nums block">
                            {formatCurrency(txn.amount, txn.currency)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="progress-track flex-1">
                          <div
                            className={`progress-fill ${confidenceBarColor(
                              conf
                            )}`}
                            style={{ width: `${conf * 100}%` }}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-semibold tabular-nums ${confidenceColor(
                            conf
                          )}`}
                        >
                          {(conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Detail */}
          <section className="xl:col-span-3 glass-card rounded-lg flex flex-col overflow-hidden min-h-[500px] max-h-[720px]">
            {selectedTxn ? (
              <>
                <div className="p-6 border-b border-[var(--border)]">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={statusBadgeClass(
                            selectedTxn.email?.status || "PARSED"
                          )}
                        >
                          <StatusIcon
                            status={selectedTxn.email?.status || "PARSED"}
                          />
                          {statusLabel(selectedTxn.email?.status || "PARSED")}
                        </span>
                        <span className="badge badge-neutral">
                          {selectedTxn.bank}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-slate-950 truncate">
                        {selectedTxn.senderName || "Remitente desconocido"}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        {selectedTxn.email?.subject || "Sin asunto"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <h3 className="text-xl font-bold text-slate-950 tabular-nums">
                        {formatCurrency(
                          selectedTxn.amount,
                          selectedTxn.currency
                        )}
                      </h3>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {new Date(selectedTxn.createdAt).toLocaleString("es-CL")}
                      </span>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <span className="text-[10px] text-slate-500">
                          Confianza
                        </span>
                        <span
                          className={`text-xs font-bold tabular-nums ${confidenceColor(
                            selectedTxn.confidence ?? 0
                          )}`}
                        >
                          {((selectedTxn.confidence ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedTxn.email?.errorMessage && (
                    <div className="mt-3 toast toast-error py-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span className="text-xs">
                        {selectedTxn.email.errorMessage}
                      </span>
                    </div>
                  )}
                </div>

                <div className="px-6 pt-4">
                  <div className="tab-list overflow-x-auto">
                    {(
                      [
                        ["fields", FileText, "Campos"],
                        ["json", Database, "JSON"],
                        ["html", FileText, "HTML"],
                        ["attempts", Clock, "Intentos"],
                        ["replay", Play, "Reprocesar"],
                      ] as const
                    ).map(([id, Icon, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        className={`tab-btn ${
                          activeTab === id ? "tab-btn-active" : ""
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 animate-fadeIn">
                  {activeTab === "fields" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fieldRows.map((f) => (
                        <div key={f.label} className="field-card">
                          <div className="field-label">{f.label}</div>
                          <div className="field-value">{f.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "json" && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={copyJson}
                        className="btn btn-secondary absolute top-2 right-2 z-10 py-1.5 px-2.5 text-[11px]"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copiar
                          </>
                        )}
                      </button>
                      <pre className="code-block">
                        {JSON.stringify(
                          {
                            id: selectedTxn.id,
                            bank: selectedTxn.bank,
                            amount: selectedTxn.amount,
                            currency: selectedTxn.currency,
                            senderName: selectedTxn.senderName,
                            senderAccount: selectedTxn.senderAccount,
                            receiverAccount: selectedTxn.receiverAccount,
                            reference: selectedTxn.reference,
                            description: selectedTxn.description,
                            confidence: selectedTxn.confidence,
                            status: selectedTxn.email?.status,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                  {activeTab === "html" && (
                    <div className="code-block text-slate-400">
                      <div className="mb-3 text-[10px] text-teal-700 border-b border-[var(--border)] pb-2 font-semibold uppercase">
                        HTML limpio preprocesado (enviado al LLM)
                      </div>
                      <div className="whitespace-pre-wrap break-all">
                        {selectedTxn.email?.cleanedHtml || (
                          <span className="text-slate-500 italic">
                            No hay HTML limpio disponible.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "attempts" && (
                    <div className="flex flex-col gap-3">
                      {!selectedTxn.attempts?.length ? (
                        <div className="text-center py-10 text-xs text-slate-500">
                          No hay intentos de análisis registrados para este pago.
                        </div>
                      ) : (
                        selectedTxn.attempts.map((att: any, idx: number) => (
                          <div
                            key={att.id || idx}
                            className="p-5 rounded-lg bg-white border border-[var(--border)] flex flex-col gap-4"
                          >
                            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[var(--border)] pb-2.5">
                              <span className="text-xs font-bold text-slate-950 uppercase flex items-center gap-1.5">
                                <Settings className="w-3.5 h-3.5 text-slate-500" />
                                Intento #{idx + 1}
                                <ChevronRight className="w-3 h-3 text-slate-500" />
                                <span className="text-teal-700 font-medium normal-case">
                                  {att.llmProvider}
                                </span>
                              </span>
                              <span
                                className={
                                  att.success
                                    ? "badge badge-success"
                                    : "badge badge-danger"
                                }
                              >
                                {att.success ? "Correcto" : "Fallido"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-slate-500 text-[10px] uppercase font-semibold">
                                  Modelo
                                </span>
                                <span className="text-slate-800 block font-medium mt-0.5">
                                  {att.modelName}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] uppercase font-semibold">
                                  Tokens
                                </span>
                                <span className="text-slate-800 block font-medium mt-0.5 tabular-nums">
                                  {(att.promptTokens || 0) +
                                    (att.completionTokens || 0)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] uppercase font-semibold">
                                  Costo
                                </span>
                                <span className="text-slate-800 block font-medium mt-0.5 tabular-nums">
                                  ${(att.costInUSD || 0).toFixed(5)}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[10px] uppercase font-semibold">
                                  Latencia
                                </span>
                                <span className="text-slate-800 block font-medium mt-0.5 tabular-nums">
                                  {att.latencyInMs} ms
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {(
                                [
                                  ["amount", att.amountValid],
                                  ["date", att.dateValid],
                                  ["sender", att.senderNameValid],
                                  ["senderAcc", att.senderAccountValid],
                                  ["receiver", att.receiverAccountValid],
                                  ["ref", att.referenceValid],
                                ] as const
                              ).map(([label, ok]) => (
                                <span
                                  key={label}
                                  className={
                                    ok
                                      ? "badge badge-success"
                                      : "badge badge-danger"
                                  }
                                >
                                  {ok ? (
                                    <Check className="w-2.5 h-2.5" />
                                  ) : (
                                    <X className="w-2.5 h-2.5" />
                                  )}
                                  {label}
                                </span>
                              ))}
                            </div>

                            {att.validationErrors && (
                              <div className="p-2.5 rounded-lg bg-red-50 border border-red-500/20 text-[11px] text-red-700 leading-relaxed font-mono">
                                <strong className="font-semibold">
                                  Validación:
                                </strong>{" "}
                                {att.validationErrors}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === "replay" && (
                    <div className="flex flex-col gap-5 p-5 rounded-lg bg-white border border-[var(--border)]">
                      <div className="flex items-start gap-2.5 text-teal-700 text-xs">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          Reprocesa este correo con otro modelo, sin volver a
                          consultar Gmail. Útil para comparar precisión y costo.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="field-label">Proveedor LLM</label>
                          <select
                            value={replayProvider}
                            onChange={(e) => {
                              setReplayProvider(e.target.value);
                              if (e.target.value === "openai")
                                setReplayModel("gpt-4o-mini");
                              else if (e.target.value === "gemini")
                                setReplayModel("gemini-1.5-flash");
                              else
                                setReplayModel("claude-3-5-sonnet-20241022");
                            }}
                            className="input-field mt-1"
                          >
                            <option value="openai">OpenAI</option>
                            <option value="gemini">Gemini</option>
                            <option value="anthropic">Anthropic</option>
                          </select>
                        </div>

                        <div>
                          <label className="field-label">Modelo</label>
                          <select
                            value={replayModel}
                            onChange={(e) => setReplayModel(e.target.value)}
                            className="input-field mt-1"
                          >
                            {replayProvider === "openai" ? (
                              <>
                                <option value="gpt-4o-mini">gpt-4o-mini</option>
                                <option value="gpt-4o">gpt-4o</option>
                              </>
                            ) : replayProvider === "gemini" ? (
                              <>
                                <option value="gemini-1.5-flash">
                                  gemini-1.5-flash
                                </option>
                                <option value="gemini-1.5-pro">
                                  gemini-1.5-pro
                                </option>
                              </>
                            ) : (
                              <>
                                <option value="claude-3-5-sonnet-20241022">
                                  claude-3-5-sonnet
                                </option>
                                <option value="claude-3-5-haiku-20241022">
                                  claude-3-5-haiku
                                </option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleTriggerReprocesar}
                        disabled={isLoading}
                        className="btn btn-primary w-full py-2.5 mt-1"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        {isLoading ? "Analizando…" : "Ejecutar reproceso"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center text-slate-500 p-8">
                <div className="w-16 h-16 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center mb-4">
                  <Mail className="w-7 h-7 text-slate-500" />
                </div>
                <p className="text-sm text-slate-500">Selecciona un pago</p>
                <p className="text-xs text-slate-500 mt-1 text-center max-w-xs">
                  Elige una transacción de la lista para revisar campos, HTML,
                  registros y opciones de reproceso.
                </p>
              </div>
            )}
          </section>
        </main>

        <footer className="pt-2 pb-6 text-center text-[11px] text-slate-500">
          LedgerMail · Lectura inteligente de notificaciones bancarias · MVP
          v1
        </footer>
        <ChatWidget />
      </div>
    </div>
  );
}
