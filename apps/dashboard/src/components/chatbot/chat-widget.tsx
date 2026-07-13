"use client";

import { useState, useRef, useEffect } from "react";

type Mensaje = { role: "user" | "assistant"; content: string };

const SALUDO: Mensaje = {
  role: "assistant",
  content: "¡Hola! 👋 Soy el asistente de LedgerMail. Pregúntame cómo conectar tu Gmail, cómo funciona la detección de bancos, el score de confianza, o sobre el modo replay.",
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/ledger-api";

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatearMensaje(text: string) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Negrita (**texto**)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Cursiva (*texto*)
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Formatear viñetas de markdown a listas
  html = html.replace(/^\s*[\*\-]\s+(.*?)$/gm, "• $1");

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [burbujaVisible, setBurbujaVisible] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([SALUDO]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem("ledgermail_chat_burbuja_vista")) return;
    const timer = setTimeout(() => setBurbujaVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  function cerrarBurbuja() {
    setBurbujaVisible(false);
    sessionStorage.setItem("ledgermail_chat_burbuja_vista", "1");
  }

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, abierto]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido || enviando) return;

    const historial = [...mensajes, { role: "user" as const, content: contenido }];
    setMensajes(historial);
    setTexto("");
    setError(null);
    setEnviando(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historial.filter((m) => m !== SALUDO) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo responder. Intenta de nuevo.");
        return;
      }
      setMensajes((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setError("No se pudo conectar con el chat. Revisa que el servidor API esté corriendo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-45 print:hidden sm:bottom-6 sm:right-6">
      {abierto && (
        <div className="mb-3 flex h-[30rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-white/95 backdrop-blur-md shadow-2xl transition-all duration-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#236b5f] to-[#2aa08e] px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-semibold text-white">Soporte LedgerMail</p>
            </div>
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="text-white/80 transition hover:text-white text-lg font-light leading-none"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4 bg-slate-50/50">
            {mensajes.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] shadow-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-[#236b5f] text-white rounded-tr-none font-medium"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                  )}
                >
                  {formatearMensaje(m.content)}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-none bg-white border border-slate-100 px-3.5 py-2.5 text-[13px] text-slate-400 flex items-center gap-1.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" />
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center">
                <p className="rounded-lg bg-red-50 px-3 py-1.5 text-center text-xs text-red-600 border border-red-100">
                  ⚠️ {error}
                </p>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {/* Form */}
          <form onSubmit={enviar} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pregúntame sobre LedgerMail..."
              maxLength={2000}
              disabled={enviando}
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-xs outline-none focus:border-[#236b5f] focus:ring-1 focus:ring-[#236b5f] disabled:bg-slate-50 text-slate-800"
            />
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="shrink-0 rounded-full bg-[#236b5f] px-4.5 py-2 text-xs font-semibold text-white transition hover:bg-[#1d5b51] disabled:opacity-40 shadow-sm"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* Callout popover */}
      {!abierto && burbujaVisible && (
        <div className="absolute bottom-[4.5rem] right-0 w-64 animate-[bubble-in_0.25s_ease-out] rounded-2xl rounded-br-sm border border-slate-200 bg-white px-4 py-3.5 shadow-xl">
          <button
            onClick={cerrarBurbuja}
            aria-label="Cerrar mensaje"
            className="absolute right-2 top-2 text-slate-300 transition hover:text-slate-500 text-sm"
          >
            ✕
          </button>
          <p className="pr-3 text-[13px] leading-snug text-slate-600">
            👋 <span className="font-semibold text-slate-800">¿Tienes dudas?</span> Pregúntame cómo usar LedgerMail
          </p>
        </div>
      )}

      {/* Unread badge indicator */}
      {!abierto && !burbujaVisible && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 z-50">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2aa08e] opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#236b5f]" />
        </span>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          setAbierto((v) => !v);
          cerrarBurbuja();
        }}
        aria-label={abierto ? "Cerrar ayuda" : "Abrir ayuda"}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-[#236b5f] text-2xl text-white shadow-lg transition hover:bg-[#1d5b51] hover:scale-105 hover:shadow-xl active:scale-95 duration-150",
          !abierto && "animate-[bounce_3s_ease-in-out_infinite]"
        )}
      >
        {abierto ? "✕" : "💬"}
      </button>
    </div>
  );
}
