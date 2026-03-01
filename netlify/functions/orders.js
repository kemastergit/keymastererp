
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    // Configuración de CORS para que el catálogo pueda enviar datos desde otro dominio
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    };

    // Manejar preflight de CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers });
    }

    const store = getStore("pedidos_web");

    // POST: Recibir pedido del catálogo
    if (req.method === "POST") {
        try {
            const pedido = await req.json();
            const id = `ped-${Date.now()}`;

            // Guardamos el pedido con una duración limitada (ej. 24 horas) o permanente
            await store.setJSON(id, {
                ...pedido,
                id,
                fecha: new Date().toISOString(),
                estado: 'PENDIENTE'
            });

            return new Response(JSON.stringify({ message: "Pedido en buzón", id }), {
                status: 200,
                headers: { ...headers, "Content-Type": "application/json" },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...headers, "Content-Type": "application/json" },
            });
        }
    }

    // GET: El ERP consulta pedidos pendientes
    if (req.method === "GET") {
        try {
            const { blobs } = await store.list();
            const pedidos = await Promise.all(
                blobs.map(async (b) => await store.getJSON(b.key))
            );

            // Devolvemos ordenados por fecha
            const ordenados = pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            return new Response(JSON.stringify(ordenados), {
                status: 200,
                headers: { ...headers, "Content-Type": "application/json" },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { ...headers, "Content-Type": "application/json" },
            });
        }
    }

    // DELETE: El ERP borra o marca como procesado
    if (req.method === "DELETE") {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        if (id) {
            await store.delete(id);
            return new Response("Procesado", { headers });
        }
    }

    return new Response("Método no permitido", { status: 405, headers });
};

export const config = {
    path: "/api/pedidos"
};
