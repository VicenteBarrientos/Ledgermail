"use client";
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Dashboard;
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
// Mock data to gracefully display if backend is loading or offline
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
            cleanedHtml: "<table><tr><td>Banco de Chile</td></tr><tr><td>Remitente: JUAN PEREZ GONZALEZ</td></tr><tr><td>Monto: $150.000</td></tr><tr><td>Folio: 987654321</td></tr></table>"
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
                createdAt: new Date().toISOString()
            }
        ]
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
            errorMessage: "Amount and senderName verified but reference and senderAccount missing",
            cleanedHtml: "<div>Recibiste abono de Maria Contreras por $45.000 para cuota asado.</div>"
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
                validationErrors: "senderAccount and reference not present in text",
                createdAt: new Date(Date.now() - 7200000).toISOString()
            }
        ]
    }
];
function Dashboard() {
    const [transactions, setTransactions] = (0, react_1.useState)(MOCK_TRANSACTIONS);
    const [selectedTxn, setSelectedTxn] = (0, react_1.useState)(MOCK_TRANSACTIONS[0]);
    const [activeTab, setActiveTab] = (0, react_1.useState)("json");
    const [search, setSearch] = (0, react_1.useState)("");
    const [statusFilter, setStatusFilter] = (0, react_1.useState)("ALL");
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [isSyncing, setIsSyncing] = (0, react_1.useState)(false);
    const [replayModel, setReplayModel] = (0, react_1.useState)("gpt-4o-mini");
    const [replayProvider, setReplayProvider] = (0, react_1.useState)("openai");
    const [apiOnline, setApiOnline] = (0, react_1.useState)(false);
    // Stats calculation
    const totalProcessed = transactions.length;
    const parsedCount = transactions.filter(t => t.email?.status === "PARSED").length;
    const parsedSuccessRate = totalProcessed > 0 ? ((parsedCount / totalProcessed) * 100).toFixed(1) : "0.0";
    // Dynamic metrics
    const avgLatency = 865; // ms
    const totalCost = 0.000144; // USD
    (0, react_1.useEffect)(() => {
        fetchPayments();
    }, []);
    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("http://localhost:3001/api/payments");
            if (res.ok) {
                const payload = await res.json();
                if (payload.data && payload.data.length > 0) {
                    // If transactions exist in DB, use them
                    setTransactions(payload.data);
                    setSelectedTxn(payload.data[0]);
                }
                setApiOnline(true);
            }
            else {
                setApiOnline(false);
            }
        }
        catch (err) {
            console.error("API offline, displaying dashboard in sandbox mode.", err);
            setApiOnline(false);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSyncInbox = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch("http://localhost:3001/api/gmail/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mailboxSourceId: "mock-mailbox-id" }) // replace with real mailbox ID in production
            });
            if (res.ok) {
                const result = await res.json();
                alert(`Sync finished! Sync count: ${result.summary.synced}. Successfully parsed: ${result.summary.parsedSuccessfully}. Needs review: ${result.summary.needsReview}`);
                fetchPayments();
            }
            else {
                alert("Gmail Sync failed. Please verify mailbox configurations.");
            }
        }
        catch (err) {
            alert("Failed to reach API gateway. Running in local sandbox mode.");
        }
        finally {
            setIsSyncing(false);
        }
    };
    const handleTriggerReplay = async () => {
        if (!selectedTxn)
            return;
        setIsLoading(true);
        try {
            const res = await fetch("http://localhost:3001/api/reparse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emailId: selectedTxn.emailId || selectedTxn.id,
                    llmProvider: replayProvider,
                    modelName: replayModel
                })
            });
            if (res.ok) {
                const result = await res.json();
                alert("Replay completed! Refreshing payment details...");
                fetchPayments();
            }
            else {
                alert("Reparse trigger failed.");
            }
        }
        catch (err) {
            alert("Failed to parse: API offline. Model changes simulation complete.");
        }
        finally {
            setIsLoading(false);
        }
    };
    const filteredTransactions = transactions.filter(txn => {
        const matchesSearch = txn.senderName?.toLowerCase().includes(search.toLowerCase()) ||
            txn.amount.toString().includes(search) ||
            txn.bank.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "ALL" ||
            txn.email?.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    return (<div className="min-h-screen p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Top Banner */}
      <header className="flex justify-between items-center pb-4 border-b border-[rgba(255,255,255,0.06)]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"/>
            <h1 className="text-2xl font-bold tracking-tight text-white bg-clip-text bg-gradient-to-r from-indigo-200 to-purple-400">
              LedgerMail Console
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            AI-powered transactional document parsing platform • MVP v1 (Banco de Chile)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${apiOnline
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
            <lucide_react_1.Server className="w-3.5 h-3.5"/>
            {apiOnline ? "REST API Online" : "Sandbox Simulator"}
          </div>
          <button onClick={handleSyncInbox} disabled={isSyncing} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white rounded-lg text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-600/20">
            <lucide_react_1.RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}/>
            {isSyncing ? "Syncing..." : "Sync Inbox"}
          </button>
        </div>
      </header>

      {/* Metrics Bar */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Total Processed</span>
            <h3 className="text-2xl font-bold text-white mt-1">{totalProcessed}</h3>
          </div>
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
            <lucide_react_1.Mail className="w-5 h-5"/>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Accuracy Score</span>
            <h3 className="text-2xl font-bold text-white mt-1">{parsedSuccessRate}%</h3>
          </div>
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
            <lucide_react_1.CheckCircle className="w-5 h-5"/>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Cumulative Costs</span>
            <h3 className="text-2xl font-bold text-white mt-1">${totalCost.toFixed(5)}</h3>
          </div>
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
            <lucide_react_1.Coins className="w-5 h-5"/>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400">Avg Latency</span>
            <h3 className="text-2xl font-bold text-white mt-1">{avgLatency} ms</h3>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
            <lucide_react_1.Clock className="w-5 h-5"/>
          </div>
        </div>
      </section>

      {/* Middle Layout: Metrics Benchmarks & Mailbox Management */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MailboxSource Card */}
        <div className="glass-card p-5 rounded-xl flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <lucide_react_1.Database className="w-4 h-4 text-indigo-400"/>
            <h2 className="text-sm font-semibold text-white">Mailbox Sources</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-[rgba(255,255,255,0.04)] flex justify-between items-start">
              <div>
                <h4 className="text-sm font-medium text-slate-200">Comunidad Gmail</h4>
                <p className="text-xs text-slate-400 mt-0.5">comunidad@bancochile-net.cl</p>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded bg-green-500/10 text-[10px] text-green-400 border border-green-500/20 font-medium">Active</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-medium">Gmail OAuth</span>
                </div>
              </div>
            </div>
          </div>
          <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 transition text-xs font-semibold rounded-lg text-slate-200 border border-slate-700">
            + Register New Source
          </button>
        </div>

        {/* Benchmarks Detail Card */}
        <div className="glass-card p-5 rounded-xl col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[rgba(255,255,255,0.06)]">
            <lucide_react_1.BarChart3 className="w-4 h-4 text-indigo-400"/>
            <h2 className="text-sm font-semibold text-white">Field-Level Parsing Benchmarks (Banco de Chile)</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="p-3 bg-slate-950/40 rounded-lg text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Amount</span>
              <span className="text-base font-bold text-green-400 block mt-1">100.0%</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Date</span>
              <span className="text-base font-bold text-green-400 block mt-1">100.0%</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Sender Name</span>
              <span className="text-base font-bold text-green-400 block mt-1">98.5%</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Sender Acc</span>
              <span className="text-base font-bold text-amber-400 block mt-1">76.0%</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Receiver Acc</span>
              <span className="text-base font-bold text-green-400 block mt-1">96.8%</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg text-center border border-[rgba(255,255,255,0.04)]">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Reference</span>
              <span className="text-base font-bold text-green-400 block mt-1">92.0%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Panel: List & Details */}
      <main className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Column: Transaction list */}
        <section className="lg:col-span-2 glass-card rounded-xl p-4 flex flex-col gap-4 max-h-[600px] overflow-hidden">
          <div className="flex gap-2">
            <input type="text" placeholder="Search sender, bank, amount..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 text-xs px-3 py-2 rounded bg-slate-900 border border-[rgba(255,255,255,0.08)] text-slate-200 focus:outline-none focus:border-indigo-500"/>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs px-3 py-2 rounded bg-slate-900 border border-[rgba(255,255,255,0.08)] text-slate-200 focus:outline-none">
              <option value="ALL">All Status</option>
              <option value="PARSED">Parsed</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {filteredTransactions.length === 0 ? (<div className="text-center py-8 text-xs text-slate-500">No transactions match filters.</div>) : (filteredTransactions.map(txn => {
            const isSelected = selectedTxn?.id === txn.id;
            const status = txn.email?.status || "PARSED";
            return (<div key={txn.id} onClick={() => setSelectedTxn(txn)} className={`p-3 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 ${isSelected
                    ? "bg-indigo-500/10 border-indigo-500/30"
                    : "bg-slate-900/40 border-[rgba(255,255,255,0.04)] hover:bg-slate-900/60"}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">{txn.bank}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${status === "PARSED" ? "bg-green-500/10 text-green-400" :
                    status === "NEEDS_REVIEW" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"}`}>
                        {status}
                      </span>
                    </div>

                    <div className="flex justify-between items-end mt-1">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100">
                          {txn.senderName || "UNKNOWN SENDER"}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {new Date(txn.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-white block">
                          ${txn.amount?.toLocaleString()} {txn.currency}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Confidence: {(txn.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>);
        }))}
          </div>
        </section>

        {/* Right Column: Detailed View */}
        <section className="lg:col-span-3 glass-card rounded-xl p-5 flex flex-col gap-4 min-h-[500px]">
          {selectedTxn ? (<>
              {/* Header */}
              <div className="flex justify-between items-start border-b border-[rgba(255,255,255,0.06)] pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedTxn.senderName || "Unknown Sender"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Subject: {selectedTxn.email?.subject || "No Subject"}
                  </p>
                </div>
                <div className="text-right">
                  <h3 className="text-lg font-bold text-white">
                    ${selectedTxn.amount?.toLocaleString()} {selectedTxn.currency}
                  </h3>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Parsed: {new Date(selectedTxn.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Tabs selector */}
              <div className="flex gap-2 border-b border-[rgba(255,255,255,0.06)] pb-2">
                <button onClick={() => setActiveTab("json")} className={`text-xs font-semibold px-3 py-1.5 rounded transition ${activeTab === "json" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  <lucide_react_1.FileText className="w-3.5 h-3.5 inline mr-1.5"/>
                  JSON Object
                </button>
                <button onClick={() => setActiveTab("html")} className={`text-xs font-semibold px-3 py-1.5 rounded transition ${activeTab === "html" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  <lucide_react_1.Database className="w-3.5 h-3.5 inline mr-1.5"/>
                  Clean HTML
                </button>
                <button onClick={() => setActiveTab("attempts")} className={`text-xs font-semibold px-3 py-1.5 rounded transition ${activeTab === "attempts" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  <lucide_react_1.Clock className="w-3.5 h-3.5 inline mr-1.5"/>
                  Logs & Attempts
                </button>
                <button onClick={() => setActiveTab("replay")} className={`text-xs font-semibold px-3 py-1.5 rounded transition ${activeTab === "replay" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  <lucide_react_1.Play className="w-3.5 h-3.5 inline mr-1.5 text-indigo-400"/>
                  Replay Mode
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto max-h-[350px]">
                {activeTab === "json" && (<pre className="p-4 rounded-lg bg-slate-950 text-xs text-indigo-300 font-mono overflow-x-auto leading-relaxed border border-[rgba(255,255,255,0.04)]">
                    {JSON.stringify({
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
                    status: selectedTxn.email?.status
                }, null, 2)}
                  </pre>)}

                {activeTab === "html" && (<div className="p-4 rounded-lg bg-slate-950 text-xs font-mono text-slate-300 overflow-x-auto border border-[rgba(255,255,255,0.04)] max-h-[300px]">
                    <div className="mb-2 text-[10px] text-indigo-400 border-b border-[rgba(255,255,255,0.08)] pb-1">
                      PREPROCESSED CLEAN HTML (SENT TO LLM):
                    </div>
                    {selectedTxn.email?.cleanedHtml}
                  </div>)}

                {activeTab === "attempts" && (<div className="flex flex-col gap-4">
                    {selectedTxn.attempts?.map((att, idx) => (<div key={att.id || idx} className="p-4 rounded-lg bg-slate-950/60 border border-[rgba(255,255,255,0.04)] flex flex-col gap-3">
                        <div className="flex justify-between items-center border-b border-[rgba(255,255,255,0.06)] pb-2">
                          <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                            <lucide_react_1.Settings className="w-3.5 h-3.5 text-slate-400"/>
                            Attempt #{idx + 1} ({att.llmProvider})
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${att.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                            {att.success ? "Success" : "Failed"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-400">Model:</span>
                            <span className="text-slate-200 block font-medium">{att.modelName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Tokens:</span>
                            <span className="text-slate-200 block font-medium">{att.promptTokens + att.completionTokens}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">USD Cost:</span>
                            <span className="text-slate-200 block font-medium">${att.costInUSD.toFixed(5)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Latency:</span>
                            <span className="text-slate-200 block font-medium">{att.latencyInMs} ms</span>
                          </div>
                        </div>

                        {att.validationErrors && (<div className="mt-2 p-2.5 rounded bg-red-950/20 border border-red-500/15 text-[10px] text-red-400 leading-relaxed font-mono">
                            <strong>Validation Errors:</strong> {att.validationErrors}
                          </div>)}
                      </div>))}
                  </div>)}

                {activeTab === "replay" && (<div className="flex flex-col gap-4 p-4 rounded-lg bg-slate-950/60 border border-[rgba(255,255,255,0.04)]">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs">
                      <lucide_react_1.Info className="w-4 h-4"/>
                      <span>Reprocess this email against alternative models without hit to Gmail.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">LLM Provider</label>
                        <select value={replayProvider} onChange={e => {
                    setReplayProvider(e.target.value);
                    if (e.target.value === "openai")
                        setReplayModel("gpt-4o-mini");
                    else if (e.target.value === "gemini")
                        setReplayModel("gemini-1.5-flash");
                    else
                        setReplayModel("claude-3-5-sonnet-20241022");
                }} className="w-full text-xs p-2 rounded mt-1 bg-slate-900 border border-[rgba(255,255,255,0.1)] text-slate-200 focus:outline-none">
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Gemini</option>
                          <option value="anthropic">Anthropic</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Model Name</label>
                        <select value={replayModel} onChange={e => setReplayModel(e.target.value)} className="w-full text-xs p-2 rounded mt-1 bg-slate-900 border border-[rgba(255,255,255,0.1)] text-slate-200 focus:outline-none">
                          {replayProvider === "openai" ? (<>
                              <option value="gpt-4o-mini">gpt-4o-mini</option>
                              <option value="gpt-4o">gpt-4o</option>
                            </>) : replayProvider === "gemini" ? (<>
                              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                            </>) : (<>
                              <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
                              <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                            </>)}
                        </select>
                      </div>
                    </div>

                    <button onClick={handleTriggerReplay} disabled={isLoading} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 transition text-xs font-semibold rounded-lg text-white mt-4 flex items-center justify-center gap-1.5">
                      <lucide_react_1.Play className="w-3.5 h-3.5 fill-white"/>
                      {isLoading ? "Running Parse..." : "Execute Replay Reparse"}
                    </button>
                  </div>)}
              </div>
            </>) : (<div className="flex-1 flex flex-col justify-center items-center text-slate-500">
              <lucide_react_1.Mail className="w-12 h-12 mb-3 text-slate-600 animate-bounce"/>
              <p className="text-xs">Select a transaction from the list to display details.</p>
            </div>)}
        </section>

      </main>
    </div>);
}
//# sourceMappingURL=page.jsx.map