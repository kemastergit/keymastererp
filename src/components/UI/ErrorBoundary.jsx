import { useRouteError, useNavigate } from "react-router-dom";

export default function ErrorBoundary() {
    const error = useRouteError();
    console.error("Critical System Error:", error);

    return (
        <div className="min-h-screen bg-[var(--surfaceDark)] flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full panel border-t-4 border-[var(--red-var)] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-[var(--red-var)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-icons-round text-[var(--red-var)] text-4xl">report_problem</span>
                </div>

                <h1 className="text-2xl font-black text-[var(--text-main)] mb-2 uppercase tracking-tight">
                    Oops! Algo salió mal
                </h1>

                <p className="text-[var(--text2)] text-sm mb-8 leading-relaxed">
                    El sistema encontró un error inesperado. No te preocupes, tus datos locales están seguros. Puedes intentar recargar la página para continuar.
                </p>

                <div className="bg-[var(--surface2)] p-4 rounded border border-[var(--border-var)] mb-8 text-left overflow-hidden">
                    <p className="font-mono text-[10px] text-[var(--red-var)] break-all opacity-70">
                        {error?.message || "Error desconocido en el motor de renderizado"}
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="btn bg-[var(--teal)] text-white w-full py-4 shadow-[var(--win-shadow)] font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                    >
                        <span className="material-icons-round text-sm">refresh</span>
                        Recargar Sistema
                    </button>

                    <button
                        onClick={() => window.location.assign('/')}
                        className="text-[10px] text-[var(--text2)] font-bold uppercase hover:text-[var(--text-main)] transition-colors"
                    >
                        Volver al Inicio
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--border-var)]">
                    <div className="flex justify-center items-center gap-2 opacity-30 grayscale">
                        <img src="/logo.png" alt="Guaicaipuro" className="h-4" />
                        <span className="text-[10px] font-bold">KEYMASTER SECURITY</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
