import React from 'react'

const planes = [
    {
        id: 1,
        nombre: 'PLAN ESENCIAL',
        sub: 'Facturación Local',
        desc: 'Perfecto para una sola caja. Los datos se guardan de forma segura en el equipo de venta.',
        precio: '250',
        mantenimiento: '20',
        color: '#777777',
        icon: '👤',
        features: [
            'Licencia para 1 Computadora',
            'Base de Datos Local (Dexie)',
            'Control de Inventario y Ventas',
            'Facturación y Comprobantes',
            'Reportes de Ventas Diarios',
            'Garantía de Soporte Técnico'
        ]
    },
    {
        id: 3,
        nombre: 'SISTEMA CLOUD PRO',
        sub: 'Multi-Cajas Sincronizadas',
        desc: 'La solución definitiva para 3 o más computadoras. Sincroniza stock y precios al instante en todas las cajas.',
        precio: '650',
        mantenimiento: '30',
        color: '#dc2626',
        icon: '☁️',
        destacado: true,
        features: [
            'Conexión para 3 o más Computadoras',
            'Base de Datos en la Nube (Supabase)',
            'Sincronización Total de Stock/Precios',
            'Acceso Remoto desde su Celular/Casa',
            'Dashboard de Inteligencia de Negocios',
            'Respaldos Automáticos Diarios'
        ]
    }
]

export default function Planes() {
    return (
        <div className="pb-10 animate-in fade-in duration-500 pr-2">
            <div className="text-center mb-10 p-6">
                <h1 className="text-4xl font-black text-[var(--text-main)] tracking-tighter mb-2 uppercase">Licenciamiento del Sistema</h1>
                <div className="h-1 w-24 bg-[var(--teal)] mx-auto mb-4" />
                <p className="text-[var(--text2)] text-xs tracking-widest uppercase font-black">Tecnología de Vanguardia para tu Negocio</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
                {planes.map(p => (
                    <div key={p.id}
                        className={`panel relative group p-0 rounded-none overflow-hidden transition-none shadow-[var(--win-shadow)] border-2
                        ${p.destacado ? 'border-[var(--teal)] scale-105 z-10' : 'border-[var(--border-var)]'}`}>

                        {p.destacado && (
                            <div className="absolute top-0 right-0 bg-[var(--teal)] text-[10px] font-black text-white px-4 py-1.5 rounded-none tracking-widest uppercase shadow-md">
                                RECOMENDADO
                            </div>
                        )}

                        <div className="p-6 text-center border-b border-[var(--border-var)] bg-[var(--surface2)]">
                            <div className="text-4xl mb-3">{p.icon}</div>
                            <h2 className="font-black text-2xl text-[var(--text-main)] tracking-tighter group-hover:text-[var(--teal)] transition-none uppercase">{p.nombre}</h2>
                            <p className="text-[var(--teal)] font-black text-[10px] tracking-widest uppercase mb-4">{p.sub}</p>

                            <div className="flex items-end justify-center gap-1 mb-1 font-mono">
                                <span className="text-[var(--text2)] text-sm pb-1 font-black">$</span>
                                <span className="text-6xl font-black text-[var(--text-main)] tracking-tighter">{p.precio}</span>
                                <span className="text-[var(--text2)] text-xs pb-1 uppercase tracking-tighter font-black">Único</span>
                            </div>
                            <p className="text-[10px] text-[var(--text2)] font-black tracking-widest mt-2 bg-[var(--surface)] inline-block px-3 py-1 rounded-none border border-[var(--border-var)] shadow-sm uppercase">+ ${p.mantenimiento}/MES SOPORTE</p>
                        </div>

                        <div className="p-6 bg-[var(--surface)]">
                            <p className="text-xs text-[var(--text-main)] leading-relaxed text-center mb-6 italic min-h-[40px] font-bold opacity-80">
                                "{p.desc}"
                            </p>

                            <ul className="space-y-3 mb-8">
                                {p.features.map((f, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-xs text-[var(--text-main)]">
                                        <span className="material-icons-round text-[var(--teal)] text-sm">check_circle</span>
                                        <span className="font-bold tracking-tight uppercase text-[10px]">{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <button className={`w-full py-4 rounded-none font-black text-xs tracking-widest transition-none shadow-[var(--win-shadow)] cursor-pointer uppercase
                                ${p.destacado ? 'bg-[var(--teal)] text-white' : 'bg-[var(--surface2)] text-[var(--text-main)] border border-[var(--border-var)]'}`}>
                                SOLICITAR PLAN
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-12 max-w-3xl mx-auto p-6 bg-[var(--surface2)] border border-[var(--border-var)] rounded-none text-center shadow-[var(--win-shadow)]">
                <h3 className="font-black text-lg text-[var(--teal)] tracking-tighter mb-2 uppercase flex items-center justify-center gap-2">
                    <span className="material-icons-round">support_agent</span> ¿Necesitas una solución a medida?
                </h3>
                <p className="text-[10px] text-[var(--text2)] font-black uppercase tracking-widest leading-loose max-w-xl mx-auto">
                    Todos nuestros planes incluyen instalación inicial remota, capacitación del personal y actualizaciones de seguridad de por vida.
                    Contáctanos directamente para requerimientos especiales de sucursales.
                </p>
            </div>
        </div>
    )
}

